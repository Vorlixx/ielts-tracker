'use strict';
/* ============ IELTS Tracker — 4.5 → 7.0+ ============ */

const LS_KEY = 'ieltsTrackerV1';

const CODES = {
  L: {
    L1: 'Eşitmədim (sürət, akcent, səs-küy)',
    L2: 'Spelling / rəqəm səhvi (13 vs 30, "th" səsləri)',
    L3: 'Parafraz tanımadım ("expensive" → "costly")',
    L4: 'Predict etmədim (sualları əvvəlcədən oxumadım)',
    L5: 'Signpost qaçdı ("but / however / actually" sonrası cavab)',
    L6: 'Diqqət yayındı, sualı qaçırdım',
    L7: 'Qrammatik uyğunluq ("5 o\'clock" yox "at 5 o\'clock")'
  },
  R: {
    R1: 'Parafraz tanımadım',
    R2: 'Scanning bacarmadım (açar sözü tapa bilmədim)',
    R3: 'Hamısını oxudum, skim etmədim → vaxt itkisi',
    R4: 'True/False/Not Given məntiq səhvi (False ≠ Not Given)',
    R5: 'Naməlum söz blok etdi',
    R6: 'Sual tipini tanımadım (matching headings və s.)',
    R7: 'Vaxt keçdi (20 dəq/passage)'
  }
};

const QTYPES = {
  L: ['Map', 'Form', 'Table', 'Note Completion', 'Sentence Completion', 'Multiple Choice', 'Short Answer', 'Matching'],
  R: ['T/F/NG', 'Y/N/NG', 'Matching Headings', 'Matching Information', 'Multiple Choice', 'Summary Completion', 'Sentence Completion', 'Short Answer', 'Diagram', 'List Selection']
};

const BAND_MAP = [
  [0, 12, 4.0], [13, 17, 4.5], [18, 22, 5.0], [23, 25, 5.5],
  [26, 29, 6.0], [30, 31, 6.5], [32, 34, 7.0], [35, 36, 7.5],
  [37, 38, 8.0], [39, 40, 8.5]
];
function bandFromScore(n) {
  n = Math.max(0, Math.min(40, Number(n) || 0));
  const r = BAND_MAP.find(x => n >= x[0] && n <= x[1]);
  return r[2].toFixed(1);
}

const WEEKS = [
  {
    n: 1, title: 'Texnika qurma — I hissə',
    goal: 'Format, prediction, signpost və parafrazı öyrən. Tam mock YOXDUR — məqsəd texnikanı işə salmaqdır.',
    daily: [
      ['30 dəq', 'Vokabulyar: 15–20 söz kontekstdə (cümlə ilə) — vokabulyar bölməsinə yaz'],
      ['45 dəq', 'Listening texnikası: format, prediction, signpost, parafraz (IELTS-up + E2 video) + 1 section məşqi'],
      ['60 dəq', 'Reading texnikası: skim/scan, parafraz, T/F/NG məntiqi + 1 passage məşqi'],
      ['30 dəq', 'Speaking: 1 Part mövzusu — cavabı səsə yaz, dinlə, qeyd et']
    ],
    weekend: 'Yoxlama məşqi: 1 Listening section + 1 Reading passage (vaxtsız). Məqsəd bal deyil — texnikanı işə salmaqdır.',
    focus: 'L1–L7 və R1–R7 kodlarının mənasını öyrən',
    mock: null
  },
  {
    n: 2, title: 'Texnika qurma — II hissə',
    goal: 'Texnikanı avtomatlaşdır. Sürət yox — dəqiqlik.',
    daily: [
      ['30 dəq', 'Vokabulyar: 15–20 söz kontekstdə (cümlə ilə)'],
      ['45 dəq', 'Listening texnikası + 1 section məşqi'],
      ['60 dəq', 'Reading texnikası + 1 passage məşqi'],
      ['30 dəq', 'Speaking: 1 Part mövzusu — cavabı səsə yaz, dinlə']
    ],
    weekend: 'Həftə 1-də səhv etdiyin sual tiplərini yenidən et. 1 vaxtlı Listening section cəhd et.',
    focus: 'Həftə 1-də ən çox səhv etdiyin kod',
    mock: null
  },
  {
    n: 3, title: 'İlk tam mock + error analizi başlayır',
    goal: 'İlk real nəticəni al və error analizi sistemini tam işə sal.',
    daily: [
      ['30 dəq', 'Hədəfli texnika məşqi (ən zəif hissəyə daha çox vaxt)'],
      ['20 dəq', '1 vaxtlı Listening section'],
      ['20 dəq', '1 vaxtlı Reading passage'],
      ['30 dəq', 'Speaking + vokabulyar təkrarı']
    ],
    weekend: 'Şənbə: İlk TAM MOCK — IELTS Online platformasında, real vaxt məhdudiyyəti (pauzasız, ~2.5 saat). Bazar: Tam error analizi (2–3 saat): error log doldur, kodları say, hədəfi seç, vokabulyar topla, speaking səsyazmanı dinlə.',
    focus: 'Error analizi — ilk dəfə tam',
    mock: 'Mock #1'
  },
  {
    n: 4, title: 'Zəif nöqtəni hədəflə',
    goal: 'Həftə 3-ün ən böyük səhv kodunu gündəlik hədəfli məşq et.',
    daily: [
      ['30 dəq', 'Hədəfli məşq: ən böyük səhv kodundan 10 sual'],
      ['45 dəq', 'Listening + 1 section'],
      ['60 dəq', 'Reading + 1 passage'],
      ['30 dəq', 'Speaking + vokabulyar']
    ],
    weekend: 'Şənbə: Mock #2. Bazar: Analiz + Həftə 3 ilə müqayisə (hansı kod azalıb, hansı yox?).',
    focus: 'Həftə 3-ün top kodu (məs. R4)',
    mock: 'Mock #2'
  },
  {
    n: 5, title: 'Bölmə ixtisaslaşması',
    goal: 'Ən zəif bölməyə gündə 90 dəq ayır.',
    daily: [
      ['90 dəq', 'Ən zəif bölmə (əksərən Reading) — dərin məşq'],
      ['20 dəq', 'Listening transkripsiyası (həftədə 3 dəfə: 1 dəq audio → hər sözü yaz → müqayisə)'],
      ['30 dəq', 'Speaking: həftədə 3 tam Part 1–2–3 səsyazma sessiyası'],
      ['15 dəq', 'Vokabulyar təkrarı']
    ],
    weekend: 'Şənbə: Mock #3. Bazar: Analiz.',
    focus: 'Ən zəif bölmə',
    mock: 'Mock #3'
  },
  {
    n: 6, title: 'Sürət və dəqiqlik',
    goal: 'Reading-i 20 → 17 dəq/passage-ə endir, prediction-u saniyəölçənlə məşq et.',
    daily: [
      ['30 dəq', 'Sürət məşqi: passage başına 17 dəq limiti'],
      ['45 dəq', 'Listening: sualları əvvəlcədən predict et (saniyəölçən)'],
      ['45 dəq', 'Hədəfli məşq: 3 həftədir təkrarlanan səhv tipi'],
      ['30 dəq', 'Speaking + vokabulyar']
    ],
    weekend: 'Şənbə: Mock #4. Bazar: Analiz + band izləmə cədvəlini yenilə.',
    focus: 'Təkrarlanan səhv kodları',
    mock: 'Mock #4'
  },
  {
    n: 7, title: 'İmtahan simulyasiyası (2 mock)',
    goal: '2 tam mock — real imtahan şərtlərində: səssiz otaq, qulaqlıq, kağız/qələm, pauza yox.',
    daily: [
      ['45 dəq', 'Listening + 1 section (imtahan rejimi)'],
      ['45 dəq', 'Reading + 1 passage (kağız/qələm)'],
      ['30 dəq', 'Speaking: həftədə 2 tam səsyazma + dinləmə'],
      ['30 dəq', 'Vokabulyar + köhnə səhvlər']
    ],
    weekend: 'Çərşənbə: Mock #5 (real şərtlər). Şənbə: Mock #6. Bazar: hər iki mock-un error analizi + speaking 2 tam səsyazma.',
    focus: 'İmtahan rejimi',
    mock: 'Mock #5 və #6'
  },
  {
    n: 8, title: 'Final cilalama',
    goal: 'Köhnə səhvləri yenidən et, azalmanı yoxla, imtahana hazırlaş.',
    daily: [
      ['45 dəq', 'Köhnə səhv suallarını yenidən et (həftə 3-dən bu yana) — bunlar artıq "dostun"dur'],
      ['30 dəq', 'Azalmayan səhv kateqoriyasına xüsusi baxış'],
      ['30 dəq', 'Speaking + vokabulyar'],
      ['15 dəq', 'İmtahan günü checklist-ini nəzərdən keçir']
    ],
    weekend: 'Çərşənbə: yarım mock (yalnız Listening + Reading). İmtahan günü: kimlik, su, vaxt paylaması (L: 30 dəq, R: 60 dəq) — hər suala cavab yaz, boş qoyma (təxmin etmək cərimə deyil!).',
    focus: 'Köhnə səhvlər + imtahan günü checklist',
    mock: 'Yarım mock (L+R)'
  }
];

const RESOURCES = [
  { name: 'IELTS-up.com', use: 'Texnika dərsləri — Listening/Reading üçün addım-addım strategiyalar', link: 'https://ielts-up.com' },
  { name: 'IELTS Advantage', use: 'Texnika + məsləhətlər (sayt + YouTube kanalı)', link: 'https://www.ieltsadvantage.com' },
  { name: 'E2 IELTS (YouTube)', use: 'Hər sual tipi üçün ayrıca video metodologiya', link: 'https://www.youtube.com/@E2IELTS' },
  { name: 'IELTS Simon blog', use: 'Texnika qeydləri (writing hissəsini keç)', link: 'https://ielts-simon.com' },
  { name: 'British Council — takeielts', use: 'Rəsmi testlər və nümunələr', link: 'https://takeielts.britishcouncil.org' },
  { name: 'IDP — ielts.idp.com', use: 'IELTS Ready + pulsuz mock testlər', link: 'https://ielts.idp.com' },
  { name: 'mini-ielts.com', use: 'Yüzlərlə Listening/Reading testi — izahlı cavablar', link: 'https://mini-ielts.com' },
  { name: 'IELTS Online', use: 'Həftə 3-dən: tam mock testlər, real vaxt rejimi', link: 'https://ieltsonlinetests.com' }
];

/* ============ State ============ */
function defaults() {
  return {
    settings: { name: '', target: '7.0', start: todayStr(), mockCount: 0 },
    errors: [],
    weeks: {},
    mocks: [],
    words: [],
    speaking: [],
    days: {},
    journal: {}
  };
}
function hasAnyData(d) {
  if (!d) return false;
  return !!(d.journal && Object.keys(d.journal).length) ||
         !!(d.days && Object.keys(d.days).length) ||
         !!(d.errors && d.errors.length) ||
         !!(d.mocks && d.mocks.length) ||
         !!(d.words && d.words.length) ||
         !!(d.speaking && d.speaking.length);
}
function mergeState(d) {
  const base = defaults();
  const today = toISO(new Date());
  let src = d || {};
  if (src.settings && src.settings.start && src.settings.start < today && !hasAnyData(src)) {
    src = Object.assign({}, src, { settings: Object.assign({}, src.settings, { start: today }) });
  }
  const merged = Object.assign(base, src, { settings: Object.assign(base.settings, src.settings || {}) });
  if (!merged.journal) merged.journal = {};
  return merged;
}
function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaults();
    return mergeState(JSON.parse(raw));
  } catch (e) { return defaults(); }
}

/* ============ DISK FILE STORAGE ============ */
/* Məlumat həm brauzer yaddaşına, həm də kompüterindəki JSON fayla yazılır.
   Fayl bağlı olanda F5, brauzer yaddaşının silinməsi və ya incognito rejim
   belə heç nə itməz — fayl hər dəfə yenidən bağlana bilər. */

const LS_HANDLE = 'ieltsTrackerHandleV1';
const LS_PROMPT = 'ieltsTrackerPromptSeen';
let disk = { state: 'none', handle: null, name: '' }; // none | ready | err | unsupported
let lsWarned = false;

function fsSupported() {
  if (typeof window === 'undefined' || typeof location === 'undefined') return false;
  // Chrome file:// səhifələrində File System Access API-ni bloklayır (SecurityError) —
  // IndexedDB hər halda işləyir, ona görə disk funksiyasını file://-də sadəcə gizlətmir, yoxlamırıq.
  if (location.protocol === 'file:') return false;
  return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window && 'indexedDB' in window;
}
function lsGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function lsSet(key, v) { try { localStorage.setItem(key, v); } catch (e) {} }

function idbOpen() {
  return new Promise((res, rej) => {
    const rq = indexedDB.open('ieltsTrackerDB', 1);
    rq.onupgradeneeded = () => { try { rq.result.createObjectStore('kv'); } catch (e) {} };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
function idbGet(key) {
  return idbOpen().then(db => new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readonly');
    const rq = tx.objectStore('kv').get(key);
    rq.onsuccess = () => { res(rq.result); db.close(); };
    rq.onerror = () => { rej(rq.error); db.close(); };
  }));
}
function idbSet(key, val) {
  return idbOpen().then(db => new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(val, key);
    tx.oncomplete = () => { res(); db.close(); };
    tx.onerror = () => { rej(tx.error); db.close(); };
  }));
}
function idbDel(key) {
  return idbOpen().then(db => new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').delete(key);
    tx.oncomplete = () => { res(); db.close(); };
    tx.onerror = () => { rej(tx.error); db.close(); };
  }));
}
/* IndexedDB məlumat güzgüsü — F5-də heç nə itməsinin əsas təminatı.
   localStorage 4.5 MB limitinə çatanda (məs. jurnal fotoları) setItem xəta
   verir və son qeydlər itirdi. IndexedDB praktik olaraq limitsizdir və
   file:// səhifələrdə də işləyir — bütün məlumat bura da yazılır. */
const IDB_DATA_KEY = 'ieltsTrackerDataV1';
let idbTimer = null;
function idbSaveData(data) {
  if (idbTimer) clearTimeout(idbTimer);
  idbTimer = setTimeout(() => {
    idbTimer = null;
    idbSet(IDB_DATA_KEY, data).catch(() => {});
  }, 250);
}
function idbLoadData() {
  return idbGet(IDB_DATA_KEY).then(v => v || null).catch(() => null);
}
function idbFlush() {
  if (idbTimer) { clearTimeout(idbTimer); idbTimer = null; }
  try { idbSet(IDB_DATA_KEY, state).catch(() => {}); } catch (e) {}
}
async function restoreFileHandle() {
  if (!fsSupported()) { disk.state = 'unsupported'; return; }
  try {
    const h = await idbGet(LS_HANDLE);
    if (!h) { disk.state = 'none'; return; }
    const perm = h.queryPermission ? await h.queryPermission({ mode: 'readwrite' }) : 'granted';
    if (perm === 'granted') {
      disk.handle = h;
      disk.name = h.name || '';
      disk.state = 'ready';
    } else {
      disk.name = h.name || '';
      disk.state = 'none';
    }
  } catch (e) { disk.state = 'none'; }
}
async function connectDisk(h) {
  disk.handle = h;
  disk.name = h.name || 'fayl';
  disk.state = 'ready';
  try { await idbSet(LS_HANDLE, h); } catch (e) {}
  await writeDisk();
  updateStorageUI();
}
async function pickDiskFile() {
  if (!fsSupported()) {
    toast(location.protocol === 'file:'
      ? 'Chrome file:// səhifələrində fayl yaddaşını açmır — məlumat IndexedDB-də təhlükəsizdir ✔'
      : 'Bu brauzer fayl yaddaşını dəstəkləmir — Chrome və ya Edge ilə aç', 'err');
    return;
  }
  try {
    let h;
    if (disk.handle) {
      const perm = await disk.handle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') { await connectDisk(disk.handle); return; }
    }
    h = await window.showSaveFilePicker({
      suggestedName: 'ielts-tracker-data.json',
      types: [{ description: 'IELTS Tracker yaddaş faylı', accept: { 'application/json': ['.json'] } }]
    });
    await connectDisk(h);
    toast('Məlumat fayla bağlandı: ' + (h.name || '') + ' ✔');
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    if (e && e.name === 'SecurityError') {
      disk.state = 'unsupported';
      updateStorageUI();
      toast('Bu brauzer bu səhifədə fayl yaddaşını açmır (file:// məhdudiyyəti) — məlumat IndexedDB-də təhlükəsizdir ✔');
      return;
    }
    toast('Fayl bağlanmadı: ' + (e.message || 'xəta'), 'err');
  }
}
async function disconnectDisk() {
  disk.handle = null;
  disk.name = '';
  disk.state = 'none';
  try { await idbDel(LS_HANDLE); } catch (e) {}
  updateStorageUI();
  toast('Fayl bağlantısı kəsildi — məlumat brauzer yaddaşında qalır');
}
async function readDisk() {
  if (disk.state !== 'ready' || !disk.handle) return null;
  try {
    const f = await disk.handle.getFile();
    const txt = await f.text();
    if (!txt.trim()) return null;
    return mergeState(JSON.parse(txt));
  } catch (e) { return null; }
}
let diskBusy = false, diskQueued = false;
async function writeDisk() {
  if (disk.state !== 'ready' || !disk.handle) return;
  if (diskBusy) { diskQueued = true; return; }
  diskBusy = true;
  try {
    const w = await disk.handle.createWritable();
    await w.write(JSON.stringify(state, null, 2));
    await w.close();
  } catch (e) {
    disk.state = 'err';
    updateStorageUI();
  } finally {
    diskBusy = false;
    if (diskQueued) { diskQueued = false; writeDisk(); }
  }
}
function unionById(a, b) {
  const m = new Map();
  (a || []).forEach(x => m.set((x && x.id) || JSON.stringify(x), x));
  (b || []).forEach(x => m.set((x && x.id) || JSON.stringify(x), x));
  return Array.from(m.values());
}
function mergeStates(a, b) {
  const out = mergeState(JSON.parse(JSON.stringify(a || {})));
  const o2 = mergeState(JSON.parse(JSON.stringify(b || {})));
  out.errors = unionById(out.errors, o2.errors);
  out.mocks = unionById(out.mocks, o2.mocks);
  out.words = unionById(out.words, o2.words);
  out.speaking = unionById(out.speaking, o2.speaking);
  out.weeks = Object.assign({}, o2.weeks, out.weeks);
  out.days = Object.assign({}, o2.days, out.days);
  out.journal = Object.assign({}, o2.journal, out.journal);
  out.settings = Object.assign({}, o2.settings, out.settings);
  return out;
}
function storageLabel() {
  if (disk.state === 'ready') return '💾 Fayl: ' + (disk.name || 'bağlı');
  if (disk.state === 'err') return '⚠️ Fayla yazılmadı';
  return '💾 Brauzer yaddaşı';
}
function updateStorageUI() {
  const el = document.getElementById('sfSave');
  if (!el) return;
  el.textContent = storageLabel();
  el.classList.toggle('ok', disk.state === 'ready');
  el.classList.toggle('warn', disk.state !== 'ready' && disk.state !== 'unsupported');
}
function save() {
  const json = JSON.stringify(state);
  try { localStorage.setItem(LS_KEY, json); }
  catch (e) {
    if (!lsWarned) {
      lsWarned = true;
      toast(disk.state === 'ready'
        ? 'Brauzer localStorage doldu/bağlandı — məlumat fayla və IndexedDB-yə yazılır ✔'
        : 'Brauzer localStorage doldu — məlumat IndexedDB-də saxlanılır ✔', 'err');
    }
  }
  idbSaveData(state);
  writeDisk();
  updateStorageUI();
}
let state = loadLocal();

const ui = { active: 'dashboard', day: todayStr(), editErr: null, errSec: '', errCode: '', errStatus: '', errQ: '', milestoneShown: '' };
const timers = {};

/* ============ Utils ============ */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function pad(n) { return String(n).padStart(2, '0'); }
function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function todayStr() { return toISO(new Date()); }
function addDays(iso, n) { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return toISO(d); }
function daysSince(iso) { return Math.round((new Date(todayStr() + 'T00:00:00') - new Date(iso + 'T00:00:00')) / 86400000); }
function fmtDate(iso) { return new Date(iso + 'T00:00:00').toLocaleDateString('az-AZ', { day: 'numeric', month: 'short' }); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function weekStart(iso) { const d = new Date(iso + 'T00:00:00'); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return toISO(d); }

function currentWeek() {
  const start = new Date(state.settings.start + 'T00:00:00');
  const diff = Math.floor((new Date(todayStr() + 'T00:00:00') - start) / 86400000);
  return Math.max(1, Math.min(8, Math.floor(diff / 7) + 1));
}
function weekLabel(w) {
  return 'Həftə ' + w + ' — ' + WEEKS[w - 1].title;
}
function dailyTasks(week) {
  const base = [
    { id: 'vocab', label: 'Vokabulyar — 15–20 söz, cümlə ilə', mins: 30 },
    { id: 'listening', label: 'Listening — texnika + 1 section', mins: 45 },
    { id: 'reading', label: 'Reading — texnika + 1 passage', mins: 60 },
    { id: 'speaking', label: 'Speaking — cavabı səsə yaz, dinlə', mins: 30 }
  ];
  const tasks = base.slice();
  if (week >= 3) tasks.push({ id: 'focused', label: 'Hədəfli məşq — ən zəif səhv kodu', mins: 30 });
  if (week >= 5) tasks.push({ id: 'transc', label: 'Listening transkripsiyası (həftədə 3 dəfə)', mins: 20 });
  if (week === 7) tasks.push({ id: 'sim', label: 'İmtahan simulyasiyası / mock hazırlığı', mins: 120 });
  if (week === 8) tasks.push({ id: 'old', label: 'Köhnə səhv suallarını yenidən et', mins: 45 });
  return tasks;
}
function dayDoneCount(iso, tasks) {
  const d = state.days[iso] || {};
  return tasks.filter(t => d[t.id]).length;
}
function streak() {
  const core = ['vocab', 'listening', 'reading', 'speaking'];
  function ok(iso) { const d = state.days[iso] || {}; return core.filter(k => d[k]).length >= 3; }
  let d = new Date();
  let iso = toISO(d);
  let n = 0;
  if (!ok(iso)) d.setDate(d.getDate() - 1);
  iso = toISO(d);
  while (ok(iso)) { n++; d.setDate(d.getDate() - 1); iso = toISO(d); }
  return n;
}
function topCodeLast(days) {
  const from = addDays(todayStr(), -days);
  const cnt = {};
  state.errors.forEach(e => { if (e.date >= from) cnt[e.code] = (cnt[e.code] || 0) + 1; });
  const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
  return top.length ? { code: top[0], count: cnt[top[0]] } : null;
}
function codeDesc(code) {
  const sec = code[0] === 'L' ? 'L' : 'R';
  return (CODES[sec] && CODES[sec][code]) || '';
}

/* ============ Toast / timers ============ */
function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (type || 'ok');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 2400);
}
function fmtRem(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
}
function tick() {
  const now = Date.now();
  Object.keys(timers).forEach(k => {
    const t = timers[k];
    if (now >= t.end) {
      delete timers[k];
      const tasks = dailyTasks(currentWeek());
      const task = tasks.find(x => x.id === t.taskId);
      const d = state.days[t.date] || {};
      d[t.taskId] = 1;
      state.days[t.date] = d;
      save();
      if (ui.active === 'daily' || ui.active === 'dashboard') render();
      toast('Tapşırıq tamamlandı: ' + (task ? task.label : t.taskId));
    } else {
      const el = document.getElementById('timer-' + t.taskId);
      if (el) el.textContent = fmtRem(t.end - now);
    }
  });
}
setInterval(tick, 1000);

/* ============ Render infrastructure ============ */
const PANELS = {
  dashboard: { title: 'İdarə Paneli', fn: renderDashboard },
  daily: { title: 'Gündəlik Plan', fn: renderDaily },
  journal: { title: 'Gündəlik Jurnal', fn: renderJournal },
  errors: { title: 'Səhv Analizi', fn: renderErrors },
  roadmap: { title: '8 Həftəlik Yol Xəritəsi', fn: renderRoadmap },
  mocks: { title: 'Proqres & Mock Testlər', fn: renderMocks },
  vocab: { title: 'Vokabulyar', fn: renderVocab },
  speaking: { title: 'Speaking Analizi', fn: renderSpeaking }
};
function render() {
  const p = PANELS[ui.active];
  document.getElementById('tbTitle').textContent = p.title;
  document.getElementById('panels').innerHTML = p.fn();
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === ui.active));
  document.getElementById('tbDate').textContent = new Date().toLocaleDateString('az-AZ', { weekday: 'long', day: 'numeric', month: 'long' });
  const st = streak();
  document.getElementById('tbStreakChip').textContent = st + ' gün';
  document.getElementById('sfStreak').textContent = st + ' gün';
  document.getElementById('sfWeek').textContent = currentWeek() + ' / 8';
  const wDone = Object.keys(state.weeks).filter(k => state.weeks[k] === 'done').length;
  document.getElementById('sfProg').style.width = (wDone / 8 * 100) + '%';
  const _ms = journalMilestone(todayStr());
  if (_ms && ui.milestoneShown !== todayStr()) {
    ui.milestoneShown = todayStr();
    setTimeout(() => celebrateMilestone(_ms.n), 500);
  }
  bindAll();
  updateStorageUI();
}
function go(tab) { ui.active = tab; render(); window.scrollTo({ top: 0 }); }
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}
document.addEventListener('click', e => {
  const nav = e.target.closest('.nav-item');
  if (nav) { go(nav.dataset.tab); closeSidebar(); }
  const goEl = e.target.closest('[data-go]');
  if (goEl) { go(goEl.dataset.go); }
});
document.getElementById('menuBtn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('show');
});
document.getElementById('overlay').addEventListener('click', closeSidebar);

/* ============ ICONS ============ */
const IC = {
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1"/><path d="M12 18v4"/></svg>',
  trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m23 6-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m20 6-11 11-5-5"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  journal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M12 18.4c-2.3-1.5-3.8-2.9-3.8-4.3 0-1.2.9-2.1 2-2.1.7 0 1.4.4 1.7 1 .3-.6 1-1 1.7-1 1.1 0 2 .9 2 2.1 0 1.4-1.5 2.8-3.8 4.3z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2z"/></svg>',
  photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>'
};

/* ============ DASHBOARD ============ */
function renderDashboard() {
  const w = currentWeek();
  const today = todayStr();
  const tasks = dailyTasks(w);
  const d = state.days[today] || {};
  const done = tasks.filter(t => d[t.id]).length;
  const tot = tasks.length;
  const wDone = Object.keys(state.weeks).filter(k => state.weeks[k] === 'done').length;
  const lastMock = state.mocks[state.mocks.length - 1];
  const top = topCodeLast(7);
  const js = journalStats();
  const jDayCount = js.count;
  const jPct = Math.min(100, Math.round(js.count / Math.max(1, daysSince(state.settings.start) + 1) * 100));
  const retestDue = state.errors
    .filter(e => e.status !== 'solved' && daysSince(e.date) >= 3)
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const recent = state.errors.slice(-5).reverse();
  const todoTask = tasks.find(t => !d[t.id]);
  const firstIncomplete = todoTask ? todoTask.label : null;

  const checklist = tasks.map(t => `
    <label class="task-row ${d[t.id] ? 'done' : ''}">
      <input type="checkbox" data-task="${t.id}" ${d[t.id] ? 'checked' : ''}>
      <span class="task-dot dot-c-${t.id}"></span>
      <span class="task-label">${esc(t.label)}</span>
      <span class="task-mins">${t.mins} dəq</span>
    </label>`).join('');

  const trendHtml = weeklyTrendHtml();

  return `
  <div class="welcome">
    <div>
      <h1>Salam${state.settings.name ? ', ' + esc(state.settings.name) : ''}!</h1>
      <p>${weekLabel(w)} — bugünkü hədəf: <b>${firstIncomplete ? esc(firstIncomplete) : 'hər şey tamamlandı — əla iş!'}</b></p>
    </div>
    <div class="w-actions">
      <button class="btn btn-ghost btn-sm" id="btnName">${IC.edit} Adı dəyiş</button>
      <button class="btn btn-primary btn-sm" data-go="daily">${IC.check} Bugünkü plan</button>
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat"><div class="stat-ico c-green">${IC.flame}</div><div><div class="stat-val">${streak()} gün</div><div class="stat-lbl">ardıcıl tam gün</div></div></div>
    <div class="stat"><div class="stat-ico c-blue">${IC.check}</div><div><div class="stat-val">${done}/${tot}</div><div class="stat-lbl">bugünkü tapşırıq</div></div></div>
    <div class="stat"><div class="stat-ico c-red">${IC.alert}</div><div><div class="stat-val">${state.errors.length}</div><div class="stat-lbl">error log qeydi</div></div></div>
    <div class="stat"><div class="stat-ico c-purple">${IC.trend}</div><div><div class="stat-val">${lastMock ? 'Mock #' + lastMock.num : '—'}</div><div class="stat-lbl">${lastMock ? 'Band: L ' + bandFromScore(lastMock.listening) + ' / R ' + bandFromScore(lastMock.reading) : 'hələ mock yox'}</div></div></div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-head">
        <div class="card-title"><span class="ico">${IC.check}</span>Bugünkü plan <span class="chip chip-accent">${wDone}/8 həftə</span></div>
        <span class="card-sub">${fmtDate(today)}</span>
      </div>
      <div class="progress" style="margin-top:0;margin-bottom:12px"><div class="progress-fill" style="width:${tot ? (done / tot * 100) : 0}%"></div></div>
      ${checklist}
    </div>

    <div>
      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="ico">${IC.trend}</span>Yol xəritəsi</div>
          <span class="chip ${wDone >= 8 ? 'chip-green' : 'chip-amber'}">${wDone}/8 bitdi</span>
        </div>
        <p class="hint" style="margin-bottom:10px">Hal-hazırda <b>Həftə ${w}</b> — ${esc(WEEKS[w - 1].title)}</p>
        <div class="progress" style="margin-top:0"><div class="progress-fill" style="width:${wDone / 8 * 100}%"></div></div>
        <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" data-go="roadmap">${IC.list} Yol xəritəsinə bax</button>
          <button class="btn btn-ghost btn-sm" data-go="mocks">${IC.trend} Mocks</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title"><span class="ico">${IC.target}</span>Həftəlik hədəf</div>
        </div>
        ${top
          ? `<p class="hint">Son 7 gündə ən çox təkrarlanan səhv: <b class="badge-code" style="color:var(--accent2)">${top.code}</b> (${top.count} dəfə) — <b>${esc(codeDesc(top.code))}</b></p>
             <p class="hint" style="margin-top:8px">Növbəti həftə bu koddan gündəlik hədəfli məşq et (10 sual). Hər səhvi 3 gün sonra yenidən cəhd et.</p>`
          : '<p class="hint">Hələ kifayət qədər məlumat yox. Səhv Analizi bölməsindən ilk səhvlərini qeyd et — sistem hədəfini özü seçəcək.</p>'}
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title"><span class="ico">${IC.journal}</span>Gündəlik Jurnal <span class="chip chip-gold">${jDayCount} gün</span></div>
      </div>
      <div class="progress" style="margin-top:0"><div class="progress-fill" style="width:${jPct}%"></div></div>
      <p class="hint" style="margin-top:10px;margin-bottom:12px">Hər gün 1–2 cümlə, foto və ya puan yaz — <b>${jPct}%</b> gün qeyd olunub.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" id="jTodayDash">${IC.plus} Bugünü qeyd et</button>
        <button class="btn btn-ghost btn-sm" data-go="journal">${IC.journal} Jurnala bax</button>
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-head"><div class="card-title"><span class="ico">${IC.alert}</span>Səhv trendi (həftəlik)</div></div>
      ${trendHtml}
    </div>
    <div class="card">
      <div class="card-head"><div class="card-title"><span class="ico">${IC.refresh}</span>Təkrar vaxtı çatıb</div><button class="btn btn-ghost btn-mini" data-go="errors">Hamısı</button></div>
      ${retestDue.length
        ? retestDue.map(e => `
          <div class="hist-row">
            <span class="hist-date">${fmtDate(e.date)}</span>
            <span class="chip chip-amber"><span class="badge-code">${e.code}</span></span>
            <span style="flex:1;font-size:13px;color:var(--muted)">${esc(e.qtype)} — sual ${esc(e.qnum)}</span>
          </div>`).join('')
        : '<p class="hint">3 gün əvvəlki səhvləri təkrarlamaq üçün vaxt hələ çatmayıb və ya hamısı həll olunub.</p>'}
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-head"><div class="card-title"><span class="ico">${IC.book}</span>Resurslar (qısa)</div></div>
      ${RESOURCES.slice(0, 4).map(r => `
        <div class="vocab-row">
          <div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13.5px"><a href="${r.link}" target="_blank" rel="noopener">${esc(r.name)}</a></div><div class="hint">${esc(r.use)}</div></div>
        </div>`).join('')}
      <div style="margin-top:10px"><button class="btn btn-ghost btn-sm" data-go="roadmap">Bütün resurslar →</button></div>
    </div>
    <div class="card">
      <div class="card-head"><div class="card-title"><span class="ico">${IC.list}</span>Son səhvlər</div></div>
      ${recent.length
        ? recent.map(e => `
          <div class="hist-row">
            <span class="hist-date">${fmtDate(e.date)}</span>
            <span class="chip ${e.section === 'L' ? 'chip-accent' : 'chip-purple'}">${e.section === 'L' ? 'Listening' : 'Reading'}</span>
            <span class="chip chip-red"><span class="badge-code">${e.code}</span></span>
            <span style="flex:1;font-size:13px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.cause || e.qtype)}</span>
          </div>`).join('')
        : '<p class="hint">Hələ səhv qeydi yoxdur. Test etdikdən sonra hər səhv sualı bura əlavə et — analiz bundan başlayır.</p>'}
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <div class="card-title"><span class="ico">${IC.check}</span>Məlumat təhlükəsizliyi <span class="chip ${disk.state === 'ready' ? 'chip-green' : disk.state === 'err' ? 'chip-red' : 'chip-amber'}">${disk.state === 'ready' ? 'Fayla bağlı' : disk.state === 'err' ? 'Xəta' : disk.state === 'unsupported' ? 'Brauzer yaddaşı' : 'Fayl seçilməyib'}</span></div>
    </div>
    <p class="hint" style="margin-top:2px">${storageText()}</p>
    <div class="w-actions" style="margin-top:12px">
      <button class="btn btn-primary btn-sm" id="stConnect">${IC.check} Fayl seç / dəyiş</button>
      <button class="btn btn-ghost btn-sm" id="stDisconnect" style="${disk.state === 'ready' || disk.state === 'err' ? '' : 'display:none'}">${IC.del} Ayır</button>
      <button class="btn btn-ghost btn-sm" id="stExport">${IC.list} Backup endir</button>
      <button class="btn btn-ghost btn-sm" id="stImport">${IC.refresh} Backup yüklə</button>
    </div>
  </div>`;
}

function weeklyTrendHtml() {
  const labels = [];
  const counts = [];
  const today = todayStr();
  for (let i = 5; i >= 0; i--) {
    const ws = addDays(weekStart(today), -i * 7);
    const we = addDays(ws, 6);
    counts.push(state.errors.filter(e => e.date >= ws && e.date <= we).length);
    labels.push(i === 0 ? 'Bu həftə' : fmtDate(ws));
  }
  const max = Math.max(1, ...counts);
  return `<div class="trend">
    ${counts.map((c, i) => `
      <div class="trend-col">
        <div class="trend-bar" style="height:${Math.max(4, c / max * 100)}%"><span class="cnt">${c}</span></div>
        <span class="trend-lbl">${labels[i]}</span>
      </div>`).join('')}
  </div>`;
}

/* ============ DAILY ============ */
function renderDaily() {
  const w = currentWeek();
  const date = ui.day || todayStr();
  const tasks = dailyTasks(w);
  const d = state.days[date] || {};
  const done = tasks.filter(t => d[t.id]).length;
  const tot = tasks.length;
  const canNext = date < todayStr();
  const dayName = new Date(date + 'T00:00:00').toLocaleDateString('az-AZ', { weekday: 'long' });
  const isToday = date === todayStr();

  const items = tasks.map(t => {
    const run = timers[t.id];
    const isDone = !!d[t.id];
    return `
    <div class="task-item ${isDone ? 'done' : ''}">
      <input type="checkbox" data-task="${t.id}" ${isDone ? 'checked' : ''}>
      <div class="task-info">
        <div class="task-name">${esc(t.label)}</div>
        <div class="task-meta">${t.mins} dəqiqə${isToday ? '' : ' · tarix: ' + fmtDate(date)}</div>
      </div>
      <div class="task-timer">
        <span class="timer-val" id="timer-${t.id}">${run ? fmtRem(run.end - Date.now()) : '00:00'}</span>
        <button class="btn-timer ${run ? 'running' : ''}" data-timer="${t.id}" data-mins="${t.mins}">${run ? 'Dayandır' : 'Başla'}</button>
      </div>
    </div>`;
  }).join('');

  const history = [];
  for (let i = 13; i >= 0; i--) {
    const iso = addDays(todayStr(), -i);
    const c = dayDoneCount(iso, tasks);
    history.push({ iso, c, tot, pct: Math.round(c / tot * 100) });
  }

  return `
  <div class="card">
    <div class="card-head">
      <div class="card-title"><span class="ico">${IC.check}</span>Gündəlik tapşırıqlar</div>
      <div style="display:flex;gap:8px;align-items:center"><span class="chip chip-accent">${weekLabel(w)}</span><button class="btn btn-ghost btn-mini" id="jDailyBtn">📝 Jurnal</button></div>
    </div>
    <div class="day-nav">
      <button id="dayPrev" ${date <= state.settings.start ? 'disabled' : ''}>&larr;</button>
      <div class="day-label">${fmtDate(date)} <small>${dayName}${isToday ? ' — bu gün' : ''}</small></div>
      <button id="dayNext" ${canNext ? '' : 'disabled'}>&rarr;</button>
    </div>
    <div class="progress" style="margin-top:0;margin-bottom:18px"><div class="progress-fill" style="width:${tot ? done / tot * 100 : 0}%"></div></div>
    ${items}
    <div class="hint" style="margin-top:14px">Məqsəd gündə <b>2.5–3 saat</b>. Tapşırığı bitirən kimi işarələ — streak hesablanır (gündə ən az 3 əsas tapşırıq).</div>
  </div>

  <div class="card" style="margin-top:18px">
    <div class="card-head"><div class="card-title"><span class="ico">${IC.trend}</span>Son 14 gün</div><span class="chip chip-green">Streak: ${streak()} gün</span></div>
    ${history.map(h => `
      <div class="hist-row">
        <span class="hist-date">${fmtDate(h.iso)}${h.iso === todayStr() ? ' (bu gün)' : ''}</span>
        <div class="hist-dots">${tasks.map(t => `<span class="hist-dot ${(state.days[h.iso] || {})[t.id] ? 'on' : ''}"></span>`).join('')}</div>
        <span class="hist-pct" style="color:${h.pct >= 80 ? 'var(--green)' : h.pct >= 40 ? 'var(--amber)' : 'var(--red)'}">${h.pct}%</span>
      </div>`).join('')}
  </div>`;
}

/* ============ ERROR ANALYSIS ============ */
function renderErrors() {
  const edit = state.errors.find(e => e.id === ui.editErr);
  const sec = edit ? edit.section : (ui.errSec || 'L');
  const codes = CODES[sec];
  const codeOpts = Object.keys(codes).map(c => `<option value="${c}" ${(edit ? edit.code : ui.errCode) === c ? 'selected' : ''}>${c} — ${esc(codes[c])}</option>`).join('');
  const qtypeOpts = QTYPES[sec].map(q => `<option ${(edit ? edit.qtype : '') === q ? 'selected' : ''}>${esc(q)}</option>`).join('');

  const total = state.errors.length;
  const weekCount = state.errors.filter(e => e.date >= weekStart(todayStr())).length;
  const solved = state.errors.filter(e => e.status === 'solved').length;
  const top = topCodeLast(30);

  let list = state.errors.slice();
  if (ui.errSec) list = list.filter(e => e.section === ui.errSec);
  if (ui.errCode) list = list.filter(e => e.code === ui.errCode);
  if (ui.errStatus) list = list.filter(e => e.status === ui.errStatus);
  if (ui.errQ) list = list.filter(e => (e.qtype + ' ' + e.qnum + ' ' + (e.cause || '') + ' ' + (e.solution || '')).toLowerCase().includes(ui.errQ.toLowerCase()));
  list.sort((a, b) => b.date.localeCompare(a.date));

  const codeCounts = {};
  state.errors.forEach(e => { codeCounts[e.code] = (codeCounts[e.code] || 0) + 1; });
  const topCodes = Object.keys(codeCounts).sort((a, b) => codeCounts[b] - codeCounts[a]).slice(0, 6);
  const maxC = Math.max(1, ...topCodes.map(c => codeCounts[c]));

  const rows = list.map(e => {
    const due = e.status !== 'solved' && daysSince(e.date) >= 3;
    const statusChip = e.status === 'solved'
      ? '<span class="chip chip-green">Həll olundu</span>'
      : e.status === 'redo'
        ? '<span class="chip chip-amber">Təkrarda</span>'
        : '<span class="chip chip-red">Yeni</span>';
    return `
    <tr>
      <td class="num">${fmtDate(e.date)}</td>
      <td><span class="chip ${e.section === 'L' ? 'chip-accent' : 'chip-purple'}">${e.section === 'L' ? 'L' : 'R'}</span></td>
      <td>${esc(e.qtype)}</td>
      <td class="num tb-center">${esc(e.qnum)}</td>
      <td class="num">${esc(e.mine)}</td>
      <td class="num" style="color:var(--green)">${esc(e.correct)}</td>
      <td><span class="chip chip-red"><span class="badge-code">${e.code}</span></span>${due ? '<span class="chip chip-amber" style="margin-left:5px">Təkrar vaxtı</span>' : ''}</td>
      <td style="max-width:220px"><span class="hint">${esc(e.cause || '—')}</span></td>
      <td>${statusChip}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-mini" data-act="cycle" data-id="${e.id}">${IC.refresh}</button>
        <button class="btn btn-ghost btn-mini" data-act="edit" data-id="${e.id}">${IC.edit}</button>
        <button class="btn btn-danger btn-mini" data-act="del" data-id="${e.id}">${IC.del}</button>
      </td>
    </tr>`;
  }).join('');

  return `
  <div class="card" id="errFormCard">
    <div class="card-head">
      <div class="card-title"><span class="ico">${IC.plus}</span>${edit ? 'Səhvi redaktə et' : 'Yeni səhv qeydi'}</div>
      <span class="card-sub">Hər səhv sual = 1 sətir</span>
    </div>
    <form id="errForm" class="form-grid">
      <div class="field">
        <label>Tarix</label>
        <input class="input" type="date" id="eDate" value="${edit ? edit.date : todayStr()}" required>
      </div>
      <div class="field">
        <label>Bölmə</label>
        <select class="select" id="eSection">
          <option value="L" ${sec === 'L' ? 'selected' : ''}>Listening</option>
          <option value="R" ${sec === 'R' ? 'selected' : ''}>Reading</option>
        </select>
      </div>
      <div class="field">
        <label>Sual tipi</label>
        <select class="select" id="eQtype">${qtypeOpts}</select>
      </div>
      <div class="field">
        <label>Sual №</label>
        <input class="input" id="eQnum" placeholder="məs. 7" value="${edit ? esc(edit.qnum) : ''}">
      </div>
      <div class="field">
        <label>Mənim cavabım</label>
        <input class="input" id="eMine" placeholder="2pm" value="${edit ? esc(edit.mine) : ''}">
      </div>
      <div class="field">
        <label>Doğru cavab</label>
        <input class="input" id="eCorrect" placeholder="2pm, Tuesday" value="${edit ? esc(edit.correct) : ''}">
      </div>
      <div class="field">
        <label>Səhv kodu</label>
        <select class="select" id="eCode">${codeOpts}</select>
      </div>
      <div class="field">
        <label>Status</label>
        <select class="select" id="eStatus">
          <option value="new" ${edit && edit.status === 'new' ? 'selected' : ''}>Yeni</option>
          <option value="redo" ${edit && edit.status === 'redo' ? 'selected' : ''}>3 gün sonra təkrarda</option>
          <option value="solved" ${edit && edit.status === 'solved' ? 'selected' : ''}>Həll olundu</option>
        </select>
      </div>
      <div class="field full">
        <label>Kök səbəb</label>
        <input class="input" id="eCause" placeholder="Niyə səhv etdim? (məs. sualı əvvəlcədən oxumadım)" value="${edit ? esc(edit.cause) : ''}">
      </div>
      <div class="field full">
        <label>Həll strategiyası</label>
        <input class="input" id="eSolution" placeholder="Bunu necə düzəldəcəyəm? (məs. həmişə 15 san əvvəl sualı oxu)" value="${edit ? esc(edit.solution) : ''}">
      </div>
      <div class="form-actions" style="grid-column:1/-1">
        ${edit ? '<button type="button" class="btn btn-ghost" id="eCancel">Ləğv et</button>' : ''}
        <button type="submit" class="btn btn-primary">${IC.plus} ${edit ? 'Yadda saxla' : 'Səhvi əlavə et'}</button>
      </div>
    </form>
    <div class="hint" style="margin-top:12px"><b>Qayda:</b> səhv kodu "niyə" sualına cavabdır. Kök səbəbi dəqiq yaz — həftəlik hədəf buradan seçilir. Naməlum söz varsa, onu Vokabulyar bölməsinə əlavə et.</div>
  </div>

  <div class="card">
    <div class="card-head"><div class="card-title"><span class="ico">${IC.list}</span>Səhv kodları (legend)</div><button class="btn btn-ghost btn-mini" id="tglLegend">Göstər / gizlət</button></div>
    <div id="legendBox" style="display:none">
      <div class="hint" style="margin-bottom:8px;font-weight:700;color:var(--accent2)">Listening (L1–L7)</div>
      <div class="code-grid">
        ${Object.keys(CODES.L).map(k => `<div class="code-item"><span class="k">${k}</span>${esc(CODES.L[k])}</div>`).join('')}
      </div>
      <div class="hint" style="margin:12px 0 8px;font-weight:700;color:var(--purple)">Reading (R1–R7)</div>
      <div class="code-grid">
        ${Object.keys(CODES.R).map(k => `<div class="code-item"><span class="k">${k}</span>${esc(CODES.R[k])}</div>`).join('')}
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><div class="card-title"><span class="ico">${IC.trend}</span>Analiz</div></div>
    <div class="stat-grid" style="margin-top:0">
      <div class="stat"><div class="stat-ico c-red">${IC.alert}</div><div><div class="stat-val">${total}</div><div class="stat-lbl">ümumi səhv</div></div></div>
      <div class="stat"><div class="stat-ico c-blue">${IC.list}</div><div><div class="stat-val">${weekCount}</div><div class="stat-lbl">bu həftə</div></div></div>
      <div class="stat"><div class="stat-ico c-green">${IC.check}</div><div><div class="stat-val">${solved}</div><div class="stat-lbl">həll olundu</div></div></div>
      <div class="stat"><div class="stat-ico c-purple">${IC.target}</div><div><div class="stat-val">${top ? top.code : '—'}</div><div class="stat-lbl">${top ? top.count + ' dəfə · 30 gündə' : 'top kod'}</div></div></div>
    </div>
    <div class="section-gap"></div>
    <div class="hint" style="margin-bottom:10px"><b>Ən çox təkrarlanan kodlar</b> — gələn həftənin hədəfini buradan seç:</div>
    ${topCodes.length
      ? topCodes.map(c => `
        <div class="hbar-row">
          <span class="hbar-key">${c}</span>
          <div class="hbar-track"><div class="hbar-fill" style="width:${codeCounts[c] / maxC * 100}%" title="${esc(codeDesc(c))}">${codeCounts[c]}</div></div>
          <span class="hbar-val">${codeCounts[c]}</span>
        </div>`).join('')
      : '<p class="hint">Səhv qeydi əlavə etdikcə burada kod statistikası görünəcək.</p>'}
    <div class="section-gap"></div>
    ${weeklyTrendHtml()}
  </div>

  <div class="card">
    <div class="card-head"><div class="card-title"><span class="ico">${IC.list}</span>Səhv logu <span class="chip chip-red">${list.length}</span></div></div>
    <div class="filter-bar">
      <select class="select" id="fSec">
        <option value="">Bütün bölmələr</option>
        <option value="L" ${ui.errSec === 'L' ? 'selected' : ''}>Listening</option>
        <option value="R" ${ui.errSec === 'R' ? 'selected' : ''}>Reading</option>
      </select>
      <select class="select" id="fCode">
        <option value="">Bütün kodlar</option>
        ${Object.keys(CODES.L).concat(Object.keys(CODES.R)).map(c => `<option value="${c}" ${ui.errCode === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
      <select class="select" id="fStatus">
        <option value="">Bütün statuslar</option>
        <option value="new" ${ui.errStatus === 'new' ? 'selected' : ''}>Yeni</option>
        <option value="redo" ${ui.errStatus === 'redo' ? 'selected' : ''}>Təkrarda</option>
        <option value="solved" ${ui.errStatus === 'solved' ? 'selected' : ''}>Həll olundu</option>
      </select>
      <input class="input" id="fQ" placeholder="Axtar: tip, səbəb, həll..." value="${esc(ui.errQ)}" style="flex:1;min-width:200px">
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Tarix</th><th>Bölmə</th><th>Sual tipi</th><th>№</th><th>Cavabım</th><th>Doğru</th><th>Kod</th><th>Kök səbəb</th><th>Status</th><th></th>
        </tr></thead>
        <tbody id="errTbody">
          ${rows || `<tr class="err-empty"><td colspan="10"><div class="empty">${IC.list}<div class="empty-title">Səhv qeydi tapılmadı</div><div class="empty-sub">Yuxarıdakı formadan ilk səhvini əlavə et — səhv olmadan tərəqqi yoxdur.</div></div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

function bindErrors() {
  const form = document.getElementById('errForm');
  const secSel = document.getElementById('eSection');
  const codeSel = document.getElementById('eCode');

  secSel.addEventListener('change', () => {
    const codes = CODES[secSel.value];
    codeSel.innerHTML = Object.keys(codes).map(c => `<option value="${c}">${c} — ${esc(codes[c])}</option>`).join('');
    const qt = QTYPES[secSel.value];
    const qs = document.getElementById('eQtype');
    qs.innerHTML = qt.map(q => `<option>${esc(q)}</option>`).join('');
  });

  form.addEventListener('submit', ev => {
    ev.preventDefault();
    const data = {
      date: document.getElementById('eDate').value,
      section: secSel.value,
      qtype: document.getElementById('eQtype').value,
      qnum: document.getElementById('eQnum').value.trim() || '—',
      mine: document.getElementById('eMine').value.trim() || '—',
      correct: document.getElementById('eCorrect').value.trim() || '—',
      code: codeSel.value,
      status: document.getElementById('eStatus').value,
      cause: document.getElementById('eCause').value.trim(),
      solution: document.getElementById('eSolution').value.trim()
    };
    if (!data.date) return;
    if (ui.editErr) {
      const idx = state.errors.findIndex(e => e.id === ui.editErr);
      if (idx > -1) state.errors[idx] = Object.assign({}, state.errors[idx], data);
      toast('Səhv qeydi yeniləndi');
      ui.editErr = null;
    } else {
      data.id = uid();
      state.errors.push(data);
      toast('Səhv qeydi əlavə edildi — 3 gün sonra təkrar et!');
    }
    save();
    render();
  });

  const cancel = document.getElementById('eCancel');
  if (cancel) cancel.addEventListener('click', () => { ui.editErr = null; render(); });

  document.getElementById('tglLegend').addEventListener('click', () => {
    const b = document.getElementById('legendBox');
    b.style.display = b.style.display === 'none' ? 'block' : 'none';
  });

  ['fSec', 'fCode', 'fStatus'].forEach(id => {
    document.getElementById(id).addEventListener('change', ev => {
      if (id === 'fSec') ui.errSec = ev.target.value;
      if (id === 'fCode') ui.errCode = ev.target.value;
      if (id === 'fStatus') ui.errStatus = ev.target.value;
      render();
    });
  });
  document.getElementById('fQ').addEventListener('input', ev => {
    ui.errQ = ev.target.value;
    const q = ui.errQ.toLowerCase();
    document.querySelectorAll('#errTbody tr').forEach(tr => {
      if (tr.classList.contains('err-empty')) return;
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  document.querySelectorAll('[data-act]').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.dataset.id;
      if (b.dataset.act === 'del') {
        if (!confirm('Bu səhv qeydini silmək istədiyinə əminsən?')) return;
        state.errors = state.errors.filter(e => e.id !== id);
        toast('Qeyd silindi');
      } else if (b.dataset.act === 'edit') {
        ui.editErr = id;
        toast('Formanı doldurub yadda saxla');
      } else if (b.dataset.act === 'cycle') {
        const e = state.errors.find(x => x.id === id);
        if (e) {
          e.status = e.status === 'new' ? 'redo' : e.status === 'redo' ? 'solved' : 'new';
          toast('Status: ' + (e.status === 'new' ? 'Yeni' : e.status === 'redo' ? 'Təkrarda' : 'Həll olundu'));
        }
      }
      save();
      render();
    });
  });
}

/* ============ ROADMAP ============ */
function renderRoadmap() {
  const w = currentWeek();
  const wDone = Object.keys(state.weeks).filter(k => state.weeks[k] === 'done').length;

  const cards = WEEKS.map(wk => {
    const ws = addDays(state.settings.start, (wk.n - 1) * 7);
    const we = addDays(ws, 6);
    const st = state.weeks[wk.n] || '';
    const isCur = wk.n === w;
    const cls = st === 'done' ? 'done' : isCur ? 'current' : '';
    const badges = `
      ${isCur ? '<span class="chip chip-amber">Cari həftə</span>' : ''}
      ${st === 'done' ? '<span class="chip chip-green">Bitdi</span>' : ''}
      ${st === 'in' ? '<span class="chip chip-accent">Davam edir</span>' : ''}
      ${wk.mock ? `<span class="chip chip-purple">${wk.mock}</span>` : ''}`;
    return `
    <details class="week-card ${cls}" ${isCur || st === 'in' ? 'open' : ''}>
      <summary>
        <div class="week-num">${wk.n}</div>
        <div class="week-tit">
          <h3>Həftə ${wk.n} — ${esc(wk.title)}</h3>
          <p>${esc(wk.goal)} <span class="week-dates">· ${fmtDate(ws)} – ${fmtDate(we)}</span></p>
        </div>
        <div class="week-badges">${badges}</div>
      </summary>
      <div class="week-body">
        <h4>Hər gün (2.5–3 saat)</h4>
        <ul class="week-daily">
          ${wk.daily.map(d => `<li><b>${d[0]}</b><span>${esc(d[1])}</span></li>`).join('')}
        </ul>
        <h4>Həftə sonu</h4>
        <div class="week-note">${esc(wk.weekend)}</div>
        <h4>Hədəf / diqqət mərkəzi</h4>
        <p class="hint" style="color:var(--accent2);font-weight:600">${esc(wk.focus)}</p>
        <div class="week-status">
          <select class="select" data-week="${wk.n}" style="min-width:150px">
            <option value="" ${!st ? 'selected' : ''}>Gözləyir</option>
            <option value="in" ${st === 'in' ? 'selected' : ''}>Davam edir</option>
            <option value="done" ${st === 'done' ? 'selected' : ''}>Bitdi</option>
          </select>
        </div>
      </div>
    </details>`;
  }).join('');

  return `
  <div class="card">
    <div class="card-head">
      <div class="card-title"><span class="ico">${IC.trend}</span>8 həftəlik yol xəritəsi — 4.5 → 7.0+</div>
      <span class="chip chip-green">${wDone}/8 həftə bitdi</span>
    </div>
    <div class="progress" style="margin-top:0"><div class="progress-fill" style="width:${wDone / 8 * 100}%"></div></div>
    <div class="hint" style="margin-top:14px">
      <b>Realist gözlənti:</b> 8 həftə sonu 5.5–6.0 aralığına çatmaq realistdir (müntəzəm 2.5–3 saat/günlə). 7.0+ üçün daha 6–10 həftə lazım olacaq — amma bu sistem (error log + həftəlik mock + hədəfli məşq) artıq hazır olacaq, eyni dövrəni davam etdirəcəksən.
      Hər həftə <b>+0.25–0.5 band</b> inkişaf normaldır; 3 həftə eyni balda qalsan məşq üsulunu dəyiş (daha çox yox, daha ağıllı çalış — səhv kodlarına bax).
    </div>
  </div>

  <div class="timeline" style="margin-top:22px">${cards}</div>

  <div class="card">
    <div class="card-head"><div class="card-title"><span class="ico">${IC.book}</span>Resurslar (ieltsliz.com əvəzinə)</div></div>
    <div class="res-grid">
      ${RESOURCES.map(r => `
        <div class="res-card">
          <h4><a href="${r.link}" target="_blank" rel="noopener">${esc(r.name)}</a></h4>
          <p>${esc(r.use)}</p>
        </div>`).join('')}
    </div>
  </div>`;
}

function bindRoadmap() {
  document.querySelectorAll('[data-week]').forEach(sel => {
    sel.addEventListener('change', () => {
      state.weeks[sel.dataset.week] = sel.value;
      save();
      toast('Həftə ' + sel.dataset.week + ' statusu: ' + (sel.value === 'done' ? 'Bitdi ✓' : sel.value === 'in' ? 'Davam edir' : 'Gözləyir'));
      render();
    });
  });
}

/* ============ MOCKS & PROGRESS ============ */
function bandChartHtml() {
  const ms = state.mocks;
  if (!ms.length) return '<p class="hint">Mock əlavə etdikcə band qrafiki burada görünəcək.</p>';
  const W = 620, H = 210, P = { l: 38, r: 16, t: 14, b: 30 };
  const minB = 4.0, maxB = 8.5;
  const x = i => ms.length === 1 ? (W - P.l - P.r) / 2 + P.l : P.l + i / (ms.length - 1) * (W - P.l - P.r);
  const y = b => H - P.b - (b - minB) / (maxB - minB) * (H - P.t - P.b);
  const pts = (key) => ms.map((m, i) => {
    const b = key === 'avg'
      ? (bandFromScore(m.listening) * 1 + bandFromScore(m.reading) * 1) / 2
      : key === 'L' ? bandFromScore(m.listening) : bandFromScore(m.reading);
    return x(i).toFixed(1) + ',' + y(b).toFixed(1);
  }).join(' ');
  let grid = '';
  for (let b = 4.5; b <= 8; b += 0.5) {
    grid += `<line x1="${P.l}" y1="${y(b)}" x2="${W - P.r}" y2="${y(b)}" stroke="#223154" stroke-width="1" stroke-dasharray="3 5"/>`;
    grid += `<text x="${P.l - 8}" y="${y(b) + 4}" text-anchor="end" font-size="10.5" fill="#5d6f92">${b.toFixed(1)}</text>`;
  }
  const labels = ms.map((m, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" font-size="10.5" fill="#5d6f92">#${m.num}</text>`).join('');
  const dots = (key, color) => ms.map((m, i) => {
    const b = key === 'avg' ? (bandFromScore(m.listening) * 1 + bandFromScore(m.reading) * 1) / 2 : bandFromScore(m[key === 'L' ? 'listening' : 'reading']);
    return `<circle cx="${x(i)}" cy="${y(b)}" r="3.5" fill="${color}"/>`;
  }).join('');
  const avg = ms.map((m, i) => {
    const b = (bandFromScore(m.listening) * 1 + bandFromScore(m.reading) * 1) / 2;
    return x(i).toFixed(1) + ',' + y(b).toFixed(1);
  }).join(' ');
  return `
  <div class="chart-legend">
    <span class="lg"><span class="sw" style="background:#5b8cff"></span>Listening</span>
    <span class="lg"><span class="sw" style="background:#a78bfa"></span>Reading</span>
    <span class="lg"><span class="sw" style="background:#38e1f0"></span>Orta</span>
  </div>
  <svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:480px">
    ${grid}
    <polyline points="${pts('L')}" fill="none" stroke="#5b8cff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <polyline points="${pts('R')}" fill="none" stroke="#a78bfa" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <polyline points="${avg}" fill="none" stroke="#38e1f0" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round"/>
    ${dots('L', '#5b8cff')}${dots('R', '#a78bfa')}
    ${labels}
  </svg>`;
}

function renderMocks() {
  const ms = state.mocks.slice().sort((a, b) => a.num - b.num);
  const rows = ms.map(m => `
    <tr>
      <td class="num">${fmtDate(m.date)}</td>
      <td class="tb-center">${m.week}</td>
      <td class="num tb-center">#${m.num}</td>
      <td class="num">${m.listening}/40 <span class="chip chip-accent" style="margin-left:5px">${bandFromScore(m.listening)}</span></td>
      <td class="num">${m.reading}/40 <span class="chip chip-purple" style="margin-left:5px">${bandFromScore(m.reading)}</span></td>
      <td class="tb-center">${m.speaking || '—'}</td>
      <td class="num tb-center">${m.errors != null ? m.errors : '—'}</td>
      <td>${m.topcode ? `<span class="chip chip-red"><span class="badge-code">${esc(m.topcode)}</span></span>` : '—'}</td>
      <td style="max-width:180px"><span class="hint">${esc(m.note || '')}</span></td>
      <td><button class="btn btn-danger btn-mini" data-del="${m.id}">${IC.del}</button></td>
    </tr>`).join('');

  return `
  <div class="card">
    <div class="card-head"><div class="card-title"><span class="ico">${IC.plus}</span>Mock nəticəsi əlavə et</div><span class="card-sub">Band təxmini avtomatik hesablanır</span></div>
    <form id="mockForm" class="form-grid">
      <div class="field"><label>Tarix</label><input class="input" type="date" id="mDate" value="${todayStr()}" required></div>
      <div class="field">
        <label>Həftə</label>
        <select class="select" id="mWeek">
          ${WEEKS.map(w => `<option value="${w.n}" ${w.n === currentWeek() ? 'selected' : ''}>Həftə ${w.n}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Mock №</label><input class="input" type="number" id="mNum" min="1" value="${state.settings.mockCount + 1}" required></div>
      <div class="field"><label>Listening /40</label><input class="input" type="number" id="mL" min="0" max="40" placeholder="28" required></div>
      <div class="field"><label>Reading /40</label><input class="input" type="number" id="mR" min="0" max="40" placeholder="25" required></div>
      <div class="field">
        <label>Speaking (təxmin)</label>
        <select class="select" id="mS">
          <option value="">— qeyd etmə —</option>
          ${[4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0].map(b => `<option value="${b}">${b.toFixed(1)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Ümumi səhv sayı</label><input class="input" type="number" id="mErr" min="0" placeholder="12"></div>
      <div class="field"><label>Ən çox səhv kodu</label>
        <select class="select" id="mCode">
          <option value="">—</option>
          ${Object.keys(CODES.L).concat(Object.keys(CODES.R)).map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      <div class="field full"><label>Qeyd</label><input class="input" id="mNote" placeholder="Nə səhv getdi, nə yaxşı oldu?"></div>
      <div class="form-actions" style="grid-column:1/-1"><button class="btn btn-primary" type="submit">${IC.plus} Nəticəni əlavə et</button></div>
    </form>
  </div>

  <div class="card">
    <div class="card-head"><div class="card-title"><span class="ico">${IC.trend}</span>Band trendi</div></div>
    ${bandChartHtml()}
  </div>

  <div class="card">
    <div class="card-head"><div class="card-title"><span class="ico">${IC.list}</span>Proqres izləmə cədvəli</div></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Tarix</th><th>Həftə</th><th>Mock</th><th>Listening</th><th>Reading</th><th>Speaking</th><th>Səhv sayı</th><th>Top kod</th><th>Qeyd</th><th></th></tr></thead>
        <tbody>
          ${rows || `<tr><td colspan="10"><div class="empty">${IC.trend}<div class="empty-title">Hələ mock yoxdur</div><div class="empty-sub">Həftə 3-dən etibarən hər şənbə mock edib nəticəni bura yaz.</div></div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><div class="card-title"><span class="ico">${IC.book}</span>Band təxmini (Academic)</div><button class="btn btn-ghost btn-mini" id="tglBand">Göstər / gizlət</button></div>
    <div id="bandBox" style="display:none">
      <div class="table-wrap">
        <table style="min-width:0">
          <thead><tr><th>/40</th><th>Band</th><th>/40</th><th>Band</th></tr></thead>
          <tbody>
            <tr><td class="num">13–17</td><td>4.5</td><td class="num">26–29</td><td>6.0</td></tr>
            <tr><td class="num">18–22</td><td>5.0</td><td class="num">30–31</td><td>6.5</td></tr>
            <tr><td class="num">23–25</td><td>5.5</td><td class="num">32–34</td><td>7.0</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function bindMocks() {
  document.getElementById('mockForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const listening = Number(document.getElementById('mL').value);
    const reading = Number(document.getElementById('mR').value);
    if (isNaN(listening) || isNaN(reading)) return;
    const num = Number(document.getElementById('mNum').value);
    if (state.mocks.some(m => m.num === num)) {
      toast('Bu № artıq istifadə olunub — başqa № seç', 'err');
      return;
    }
    state.mocks.push({
      id: uid(),
      date: document.getElementById('mDate').value,
      week: document.getElementById('mWeek').value,
      num,
      listening,
      reading,
      speaking: document.getElementById('mS').value,
      errors: document.getElementById('mErr').value !== '' ? Number(document.getElementById('mErr').value) : null,
      topcode: document.getElementById('mCode').value,
      note: document.getElementById('mNote').value.trim()
    });
    state.settings.mockCount = Math.max(state.settings.mockCount, num);
    save();
    toast('Mock #' + num + ' əlavə edildi — L ' + bandFromScore(listening) + ' / R ' + bandFromScore(reading));
    render();
  });
  document.querySelectorAll('[data-del]').forEach(b => {
    b.addEventListener('click', () => {
      if (!confirm('Bu mock nəticəsini silmək istəyirsən?')) return;
      state.mocks = state.mocks.filter(m => m.id !== b.dataset.del);
      save();
      render();
    });
  });
  document.getElementById('tglBand').addEventListener('click', () => {
    const b = document.getElementById('bandBox');
    b.style.display = b.style.display === 'none' ? 'block' : 'none';
  });
}

/* ============ VOCABULARY ============ */
function stageLabel(s) { return ['Yeni', 'Gün 1 ✓', 'Gün 3 ✓', 'Gün 7 ✓', 'Mənimsənildi'][s] || '—'; }
function nextDueFor(stage, from) {
  if (stage >= 3) return null;
  const days = [1, 3, 7][stage];
  return addDays(from, days);
}
function renderVocab() {
  const dueToday = state.words.filter(w => w.stage < 3 && w.due && w.due <= todayStr()).sort((a, b) => a.due.localeCompare(b.due));
  const mastered = state.words.filter(w => w.stage >= 3).length;
  const upcoming = state.words.filter(w => w.stage < 3 && w.due && w.due > todayStr()).length;

  const queue = dueToday.length ? dueToday.map(w => `
    <div class="vocab-row">
      <span class="vocab-word">${esc(w.word)}</span>
      <span class="vocab-sent"><em>${esc(w.sentence || '')}</em>${w.note ? ' — ' + esc(w.note) : ''}</span>
      <span class="chip chip-amber">${stageLabel(w.stage)}</span>
      <button class="btn btn-primary btn-mini" data-review="${w.id}">${IC.check} Təkrar etdim</button>
    </div>`).join('')
    : '<p class="hint">Bu gün təkrarlanacaq söz yoxdur. Yeni söz əlavə et — gün 1, gün 3, gün 7 təkrar cədvəli avtomatik qurulur.</p>';

  const all = state.words.slice().sort((a, b) => b.added.localeCompare(a.added)).map(w => `
    <div class="vocab-row">
      <span class="vocab-word">${esc(w.word)}</span>
      <span class="vocab-sent"><em>${esc(w.sentence || '')}</em></span>
      <span class="chip ${w.stage >= 3 ? 'chip-green' : w.stage === 0 ? 'chip-accent' : 'chip-amber'}">${stageLabel(w.stage)}</span>
      <span class="vocab-due">${w.due ? 'növbəti: ' + fmtDate(w.due) : '—'}</span>
      <button class="btn btn-danger btn-mini" data-wdel="${w.id}">${IC.del}</button>
    </div>`).join('');

  return `
  <div class="card">
    <div class="card-head"><div class="card-title"><span class="ico">${IC.book}</span>Yeni söz əlavə et</div><span class="card-sub">Söz + cümlə → gün 1, gün 3, gün 7 (spaced repetition)</span></div>
    <form id="vocabForm" class="form-grid">
      <div class="field"><label>Söz</label><input class="input" id="vWord" placeholder="costly" required></div>
      <div class="field"><label>Cümlə (kontekst)</label><input class="input" id="vSent" placeholder="The repair was too costly for us."></div>
      <div class="field"><label>Qeyd / tərcümə</label><input class="input" id="vNote" placeholder="bahalı (syn: expensive)"></div>
      <div class="form-actions" style="grid-column:1/-1"><button class="btn btn-primary" type="submit">${IC.plus} Əlavə et</button></div>
    </form>
  </div>

  <div class="card">
    <div class="card-head">
      <div class="card-title"><span class="ico">${IC.check}</span>Bu gün təkrarlanacaq sözlər <span class="chip chip-amber">${dueToday.length}</span></div>
      <div class="chip chip-green">Mənimsənilib: ${mastered}</div>
    </div>
    ${queue}
    <div class="hint" style="margin-top:10px">Yaxın günlərdə: <b>${upcoming}</b> söz gözləyir. Qayda: səhv sualdan çıxan hər naməlum sözü bura yaz.</div>
  </div>

  <div class="card">
    <div class="card-head"><div class="card-title"><span class="ico">${IC.book}</span>Bütün sözlər <span class="chip chip-accent">${state.words.length}</span></div></div>
    ${all || '<p class="hint">Hələ söz yoxdur.</p>'}
  </div>`;
}

function bindVocab() {
  document.getElementById('vocabForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const word = document.getElementById('vWord').value.trim();
    if (!word) return;
    state.words.push({
      id: uid(),
      word,
      sentence: document.getElementById('vSent').value.trim(),
      note: document.getElementById('vNote').value.trim(),
      added: todayStr(),
      stage: 0,
      due: nextDueFor(0, todayStr())
    });
    save();
    toast('Söz əlavə edildi — ilk təkrar sabah');
    render();
  });
  document.querySelectorAll('[data-review]').forEach(b => {
    b.addEventListener('click', () => {
      const w = state.words.find(x => x.id === b.dataset.review);
      if (!w) return;
      w.stage = Math.min(w.stage + 1, 3);
      w.due = nextDueFor(w.stage, todayStr());
      save();
      toast(w.stage >= 3 ? 'Söz mənimsənildi!' : 'Təkrar qeyd edildi — növbəti: ' + ['sabah', '3 gün sonra', '7 gün sonra'][w.stage - 1]);
      render();
    });
  });
  document.querySelectorAll('[data-wdel]').forEach(b => {
    b.addEventListener('click', () => {
      state.words = state.words.filter(x => x.id !== b.dataset.wdel);
      save();
      render();
    });
  });
}

/* ============ SPEAKING ============ */
function renderSpeaking() {
  const sessions = state.speaking.slice().sort((a, b) => b.date.localeCompare(a.date));
  const cards = sessions.map(s => `
    <div class="spk-card">
      <div class="spk-head">
        <span class="chip chip-accent">${fmtDate(s.date)}</span>
        <span class="chip chip-purple">Part ${s.part}</span>
        <span style="font-weight:700;font-size:14px;flex:1">${esc(s.topic || 'Mövzu qeyd edilməyib')}</span>
        ${s.estimate ? `<span class="chip chip-green">Təxmin: ${s.estimate}</span>` : ''}
        <button class="btn btn-danger btn-mini" data-sdel="${s.id}">${IC.del}</button>
      </div>
      <div class="spk-notes">
        <div class="spk-note"><b>Fluency</b>${esc(s.fluency || '—')}</div>
        <div class="spk-note"><b>Qrammatika</b>${esc(s.grammar || '—')}</div>
        <div class="spk-note"><b>Vokabulyar</b>${esc(s.vocab || '—')}</div>
      </div>
    </div>`).join('');

  return `
  <div class="card">
    <div class="card-head"><div class="card-title"><span class="ico">${IC.mic}</span>Həftəlik öz-özünə analiz</div></div>
    <p class="hint" style="margin-bottom:12px">
      <b>Metod (həftədə 1 dəfə, bazar günü):</b> Part 2 cavabını 2 dəqiqə səsə yaz → dinlə və transkript et → işarələ:
      dayanmalar/təkrar "uh, um" (fluency), səhv zamanlar (went/go), article səhvləri (a/the), təkrarlanan sadə sözlər (very, good, bad).
      Növbəti həftə həmin səhvləri bilərəkdən düzəlt — hər məşqdən əvvəl siyahına bax.
    </p>
    <form id="spkForm" class="form-grid">
      <div class="field"><label>Tarix</label><input class="input" type="date" id="sDate" value="${todayStr()}" required></div>
      <div class="field">
        <label>Part</label>
        <select class="select" id="sPart"><option>1</option><option>2</option><option>3</option></select>
      </div>
      <div class="field"><label>Mövzu</label><input class="input" id="sTopic" placeholder="Describe a place you like..."></div>
      <div class="field">
        <label>Təxmini bal</label>
        <select class="select" id="sEst">
          <option value="">—</option>
          ${[4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0].map(b => `<option value="${b.toFixed(1)}">${b.toFixed(1)}</option>`).join('')}
        </select>
      </div>
      <div class="field full"><label>Fluency — dayanmalar, "uh/um", sürət</label><textarea class="textarea" id="sFluency" placeholder="3 dəfə dayandım, 5 dəfə 'um' dedim..."></textarea></div>
      <div class="field"><label>Qrammatika — zaman, article</label><textarea class="textarea" id="sGrammar" placeholder="went → go qarışıqlığı, 'a' çatışmadı..."></textarea></div>
      <div class="field"><label>Vokabulyar — təkrarlanan sadə sözlər</label><textarea class="textarea" id="sVocab" placeholder="4 dəfə 'very good' dedim → əvəzinə..."></textarea></div>
      <div class="form-actions" style="grid-column:1/-1"><button class="btn btn-primary" type="submit">${IC.plus} Sessiyanı əlavə et</button></div>
    </form>
  </div>

  <div class="section-gap"></div>
  ${cards || '<div class="empty">' + IC.mic + '<div class="empty-title">Hələ speaking sessiyası yoxdur</div><div class="empty-sub">Həftədə 1 dəfə (bazar günü) Part 2 cavabını səsə yaz və analiz et.</div></div>'}
  `;
}

function bindSpeaking() {
  document.getElementById('spkForm').addEventListener('submit', ev => {
    ev.preventDefault();
    state.speaking.push({
      id: uid(),
      date: document.getElementById('sDate').value,
      part: document.getElementById('sPart').value,
      topic: document.getElementById('sTopic').value.trim(),
      estimate: document.getElementById('sEst').value,
      fluency: document.getElementById('sFluency').value.trim(),
      grammar: document.getElementById('sGrammar').value.trim(),
      vocab: document.getElementById('sVocab').value.trim()
    });
    save();
    toast('Speaking sessiyası əlavə edildi');
    render();
  });
  document.querySelectorAll('[data-sdel]').forEach(b => {
    b.addEventListener('click', () => {
      state.speaking = state.speaking.filter(s => s.id !== b.dataset.sdel);
      save();
      render();
    });
  });
}

/* ============ GLOBAL BINDINGS ============ */
function bindAll() {
  if (ui.active === 'dashboard') {
    const nameBtn = document.getElementById('btnName');
    if (nameBtn) nameBtn.addEventListener('click', () => {
      const n = prompt('Adınız (boş buraxa bilərsiniz):', state.settings.name);
      if (n !== null) { state.settings.name = n.trim(); save(); render(); }
    });
    const jtd = document.getElementById('jTodayDash');
    if (jtd) jtd.addEventListener('click', () => openJournalModal(todayStr()));
    const stConn = document.getElementById('stConnect');
    if (stConn) stConn.addEventListener('click', pickDiskFile);
    const stDisc = document.getElementById('stDisconnect');
    if (stDisc) stDisc.addEventListener('click', disconnectDisk);
    const stExp = document.getElementById('stExport');
    if (stExp) stExp.addEventListener('click', exportData);
    const stImp = document.getElementById('stImport');
    if (stImp) stImp.addEventListener('click', () => { const f = document.getElementById('importFile'); if (f) f.click(); });
  }
  if (ui.active === 'daily') {
    document.querySelectorAll('[data-task]').forEach(cb => {
      cb.addEventListener('change', () => {
        const date = ui.day || todayStr();
        const d = state.days[date] || {};
        d[cb.dataset.task] = cb.checked ? 1 : 0;
        state.days[date] = d;
        save();
        render();
      });
    });
    document.querySelectorAll('[data-timer]').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.dataset.timer;
        if (timers[id]) { delete timers[id]; render(); return; }
        const mins = Number(b.dataset.mins) || 30;
        timers[id] = { taskId: id, date: ui.day || todayStr(), end: Date.now() + mins * 60000 };
        toast('Taymer başladı: ' + mins + ' dəq — işə başla!');
        render();
      });
    });
    const prev = document.getElementById('dayPrev');
    const next = document.getElementById('dayNext');
    if (prev) prev.addEventListener('click', () => { ui.day = addDays(ui.day, -1); render(); });
    if (next) next.addEventListener('click', () => { ui.day = addDays(ui.day, 1); render(); });
    const jdb = document.getElementById('jDailyBtn');
    if (jdb) jdb.addEventListener('click', () => openJournalModal(ui.day || todayStr()));
  }
  if (ui.active === 'journal') bindJournal();
  if (ui.active === 'errors') bindErrors();
  if (ui.active === 'roadmap') bindRoadmap();
  if (ui.active === 'mocks') bindMocks();
  if (ui.active === 'vocab') bindVocab();
  if (ui.active === 'speaking') bindSpeaking();
}

/* ============ GÜNDƏLİK JURNAL ============ */
const WD = ['B.e', 'Ç.a', 'Ç.', 'C.a', 'C.', 'Ş.', 'B.'];
function journalEnd() { return addDays(state.settings.start, 61); }
function journalMilestone(iso) {
  const m1 = addDays(state.settings.start, 31);
  const m2 = addDays(state.settings.start, 61);
  if (iso === m1) return { n: 1, label: '1 AY TAMAMLANDI!', emoji: '🎉' };
  if (iso === m2) return { n: 2, label: '2 AY TAMAMLANDI — YOLUN SONU!', emoji: '🏁' };
  return null;
}
function fmtFullDate(iso) { return new Date(iso + 'T00:00:00').toLocaleDateString('az-AZ', { weekday: 'long', day: 'numeric', month: 'long' }); }
function journalStats() {
  const entries = state.journal || {};
  const keys = Object.keys(entries).sort();
  let sum = 0, notes = 0, photos = 0;
  keys.forEach(k => {
    const e = entries[k];
    if (typeof e.rating === 'number') sum += e.rating;
    if (e.note && e.note.trim()) notes++;
    if (e.photo) photos++;
  });
  return { count: keys.length, avg: keys.length ? Math.round(sum / keys.length * 10) / 10 : 0, notes, photos };
}
function storagePct() {
  let used = 0;
  try { used = (localStorage.getItem(LS_KEY) || '').length; } catch (e) { }
  return Math.min(100, Math.round(used / (4.5 * 1024 * 1024) * 100));
}
function journalCalBlocks() {
  const start = state.settings.start;
  const end = journalEnd();
  const out = [];
  const m = new Date(start + 'T00:00:00');
  m.setDate(1);
  while (toISO(m) <= end) {
    const ym = toISO(m).slice(0, 7);
    const mName = new Date(m).toLocaleDateString('az-AZ', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const firstOffset = (new Date(m.getFullYear(), m.getMonth(), 1).getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < firstOffset; i++) cells.push({ empty: true });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = ym + '-' + pad(d);
      cells.push({ iso, inWindow: iso >= start && iso <= end });
    }
    out.push({ ym, mName, cells });
    m.setMonth(m.getMonth() + 1);
  }
  return out;
}
function renderJournal() {
  const start = state.settings.start;
  const end = journalEnd();
  const today = todayStr();
  const js = journalStats();
  const pct = Math.min(100, Math.round(js.count / Math.max(1, daysSince(start) + 1) * 100));
  const entry = state.journal[today] || {};
  const m1 = addDays(start, 31);
  const m2 = addDays(start, 61);
  let msHtml;
  if (today < m1) msHtml = `<span class="chip chip-gold">🎯 1 AY milestonuna ${31 - Math.max(0, daysSince(start))} gün qaldı (${fmtDate(m1)})</span>`;
  else if (today < m2) msHtml = `<span class="chip chip-gold">🏁 FİNAL milestonuna ${61 - Math.max(0, daysSince(start))} gün qaldı (${fmtDate(m2)})</span>`;
  else msHtml = '<span class="chip chip-green">🏁 Finala çatdın — yol tamamlandı!</span>';
  const blocks = journalCalBlocks().map(b => {
    const cells = b.cells.map(c => {
      if (c.empty) return '<div class="cal-day empty"></div>';
      const e = state.journal[c.iso] || {};
      const isToday = c.iso === today;
      const ms = journalMilestone(c.iso);
      const future = c.iso > today;
      const cls = ['cal-day', isToday ? 'today' : '', future ? 'future' : '', !c.inWindow ? 'out' : '', e.rating ? 'has-entry' : '', ms ? 'milestone' : ''].filter(Boolean).join(' ');
      const icns = [];
      if (e.note && e.note.trim()) icns.push('<span class="ci note" title="Not">✎</span>');
      if (e.photo) icns.push('<span class="ci photo" title="Foto">📷</span>');
      return `<div class="${cls}" data-day="${c.iso}">
        <span class="cal-num">${Number(c.iso.slice(8, 10))}</span>
        ${ms ? `<span class="cal-ms">${ms.emoji}</span>` : ''}
        ${e.rating ? `<span class="cal-rating r${e.rating}">${e.rating}</span>` : ''}
        ${icns.length ? `<span class="cal-icns">${icns.join('')}</span>` : ''}
      </div>`;
    }).join('');
    return `<div class="cal-block">
      <div class="cal-month">${b.mName}</div>
      <div class="cal-week">${WD.map(x => `<span>${x}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
    </div>`;
  }).join('');
  return `
  <div class="card">
    <div class="card-head">
      <div class="card-title"><span class="ico">${IC.journal}</span>Gündəlik Jurnal ${msHtml}</div>
    </div>
    <p class="hint">Hər gün 1–2 cümlə yaz, istəsən foto əlavə et və gününü 1–10 bal arası puanla. Yaddaş daim qalır (${fmtDate(start)} – ${fmtDate(end)}).</p>
    <div class="stat-grid" style="margin-top:14px">
      <div class="stat"><div class="stat-ico c-purple">${IC.check}</div><div><div class="stat-val">${js.count} gün</div><div class="stat-lbl">qeyd olunan gün (${pct}%)</div></div></div>
      <div class="stat"><div class="stat-ico c-gold">${IC.star}</div><div><div class="stat-val">${js.avg || '—'}/10</div><div class="stat-lbl">orta gündəlik puan</div></div></div>
      <div class="stat"><div class="stat-ico c-blue">${IC.edit}</div><div><div class="stat-val">${js.notes}</div><div class="stat-lbl">yazılmış not</div></div></div>
      <div class="stat"><div class="stat-ico c-green">${IC.photo}</div><div><div class="stat-val">${js.photos}</div><div class="stat-lbl">foto</div></div></div>
    </div>
  </div>

  <div class="card" style="margin-top:18px">
    <div class="card-head">
      <div class="card-title"><span class="ico">${IC.journal}</span>${fmtFullDate(today)}</div>
      ${entry.rating ? `<span class="chip chip-gold">${entry.rating}/10</span>` : '<button class="btn btn-primary btn-mini" id="jToday">📝 Bugünü qeyd et</button>'}
    </div>
    ${entry.note ? `<p class="hint" style="color:var(--text)">${esc(entry.note)}</p>` : '<p class="hint">Bu gün hələ qeyd yoxdur — təqvimdən günü seç və ya düyməyə bas.</p>'}
    ${entry.photo ? `<div style="margin-top:10px"><img class="journal-thumb" src="${entry.photo}" alt="Şəkil"></div>` : ''}
  </div>

  <div class="cal-blocks">${blocks}</div>

  <div class="card" style="margin-top:18px">
    <div class="card-head"><div class="card-title"><span class="ico">${IC.target}</span>Başlama tarixi</div></div>
    <p class="hint">Jurnal pəncərəsi və yol xəritəsi bu tarixdən hesablanır. Tarix dəyişəndə milestonlar da köçür.</p>
    <form id="startForm" class="form-grid" style="grid-template-columns:1fr auto">
      <input class="input" type="date" id="startInput" value="${start}">
      <button class="btn btn-primary" type="submit">${IC.refresh} Tarixi yenilə</button>
    </form>
    <p class="hint" style="margin-top:10px">${storageHint()}</p>
  </div>
  `;
}
function bindJournal() {
  const jt = document.getElementById('jToday');
  if (jt) jt.addEventListener('click', () => openJournalModal(todayStr()));
  document.querySelectorAll('.cal-day[data-day]').forEach(cell => {
    cell.addEventListener('click', () => openJournalModal(cell.dataset.day));
  });
  document.getElementById('startForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const v = document.getElementById('startInput').value;
    if (!v) return;
    if (confirm('Başlama tarixi ' + fmtDate(v) + ' olaraq dəyişsin? Jurnal pəncərəsi və bütün həftə tarixləri yenidən hesablanacaq.')) {
      state.settings.start = v;
      save();
      render();
      toast('Başlama tarixi yeniləndi: ' + fmtDate(v));
    }
  });
}
let jDraft = { rating: 0, mood: '', note: '', photo: '' };
function openJournalModal(iso) {
  if (iso < state.settings.start || iso > journalEnd()) { toast('Bu tarix jurnal pəncərəsindən kənardadır', 'err'); return; }
  if (iso > todayStr()) { toast('Bu gələcək tarixdir — hələ qeyd edə bilməzsən', 'err'); return; }
  const e = state.journal[iso] || {};
  jDraft = { rating: e.rating || 0, mood: e.mood || '', note: e.note || '', photo: e.photo || '' };
  const exists = !!(e.rating || e.note || e.photo);
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal-box">
      <div class="modal-head">
        <div>
          <div class="modal-title">📔 ${fmtFullDate(iso)}</div>
          <div class="modal-sub">${iso === todayStr() ? 'Bugünkü qeyd' : 'Keçmiş gün qeydi'}</div>
        </div>
        <button class="modal-close" id="mClose">✕</button>
      </div>
      <div class="modal-body">
        <div class="field"><label>Günün puarı (1–10)</label></div>
        <div class="rating-grid" id="jRating"></div>
        <div class="field" style="margin-top:14px"><label>Əhval-ruhiyyə</label></div>
        <div class="mood-row">
          ${['😊', '😐', '😴', '😩', '🔥'].map(m => `<button class="mood-btn ${jDraft.mood === m ? 'sel' : ''}" data-mood="${m}">${m}</button>`).join('')}
        </div>
        <div class="field" style="margin-top:14px"><label>Not</label><textarea class="textarea" id="jNote" placeholder="Bu gün nə öyrəndim, nə hiss etdim...">${esc(jDraft.note)}</textarea></div>
        <div class="field" style="margin-top:14px"><label>Foto</label><div class="photo-box" id="jPhotoBox"></div></div>
      </div>
      <div class="modal-foot">
        ${exists ? '<button class="btn btn-ghost btn-danger" id="mDel">Sil</button>' : ''}
        <button class="btn btn-ghost" id="mCancel">Ləğv et</button>
        <button class="btn btn-primary" id="mSave">${IC.check} Yadda saxla</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  bindJournalModal(ov, iso);
}
function bindJournalModal(ov, iso) {
  const grid = ov.querySelector('#jRating');
  for (let i = 1; i <= 10; i++) {
    const b = document.createElement('button');
    b.className = 'rate-btn' + (jDraft.rating === i ? ' sel' : '');
    b.textContent = i;
    b.addEventListener('click', () => {
      jDraft.rating = i;
      grid.querySelectorAll('.rate-btn').forEach(x => x.classList.toggle('sel', Number(x.textContent) === i));
    });
    grid.appendChild(b);
  }
  ov.querySelectorAll('.mood-btn').forEach(b => {
    b.addEventListener('click', () => {
      jDraft.mood = b.dataset.mood;
      ov.querySelectorAll('.mood-btn').forEach(x => x.classList.toggle('sel', x === b));
    });
  });
  const note = ov.querySelector('#jNote');
  note.addEventListener('input', () => { jDraft.note = note.value; });
  bindPhotoBox(ov, iso);
  ov.querySelector('#mClose').addEventListener('click', () => closeModal(ov));
  ov.querySelector('#mCancel').addEventListener('click', () => closeModal(ov));
  ov.addEventListener('click', ev => { if (ev.target === ov) closeModal(ov); });
  const del = ov.querySelector('#mDel');
  if (del) del.addEventListener('click', () => {
    delete state.journal[iso];
    save();
    closeModal(ov);
    render();
    toast('Qeyd silindi');
  });
  ov.querySelector('#mSave').addEventListener('click', () => {
    if (!jDraft.rating && !jDraft.note.trim() && !jDraft.photo) { toast('Heç nə yazılmayıb — boş qeyd saxlanmaz', 'err'); return; }
    const e = state.journal[iso] || {};
    if (jDraft.rating) e.rating = jDraft.rating;
    if (jDraft.mood) e.mood = jDraft.mood;
    e.note = jDraft.note.trim();
    if (jDraft.photo) e.photo = jDraft.photo;
    e.updated = toISO(new Date());
    state.journal[iso] = e;
    save();
    closeModal(ov);
    render();
    toast('Jurnal qeydi saxlandı ✔');
  });
  const escKey = ev => { if (ev.key === 'Escape') closeModal(ov); };
  document.addEventListener('keydown', escKey);
  ov._esc = escKey;
}
function bindPhotoBox(ov, iso) {
  const box = ov.querySelector('#jPhotoBox');
  if (jDraft.photo) {
    box.innerHTML = `<img src="${jDraft.photo}" alt="foto"><button class="btn btn-ghost btn-mini" id="jPhotoDel">Foto sil</button>`;
    box.querySelector('#jPhotoDel').addEventListener('click', () => {
      jDraft.photo = '';
      bindPhotoBox(ov, iso);
    });
    return;
  }
  box.innerHTML = `<button class="btn btn-ghost" id="jPhotoAdd">${IC.photo} Şəkil əlavə et</button><input type="file" accept="image/*" id="jPhotoFile" hidden>`;
  const add = box.querySelector('#jPhotoAdd');
  const file = box.querySelector('#jPhotoFile');
  add.addEventListener('click', () => file.click());
  file.addEventListener('change', () => {
    if (!file.files || !file.files[0]) return;
    compressImage(file.files[0], dataUrl => {
      jDraft.photo = dataUrl;
      bindPhotoBox(ov, iso);
      toast('Şəkil əlavə edildi');
    });
  });
}
function closeModal(ov) {
  if (ov._esc) document.removeEventListener('keydown', ov._esc);
  if (ov.parentNode) ov.parentNode.removeChild(ov);
}
function compressImage(file, cb) {
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1000;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        const r = Math.min(MAX / w, MAX / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(c.toDataURL('image/jpeg', 0.7));
    };
    img.src = rd.result;
  };
  rd.readAsDataURL(file);
}
function celebrateMilestone(n) {
  const title = n === 1 ? '🎉 1 AY TAMAMLANDI!' : '🏁 2 AY TAMAMLANDI — YOLUN SONU!';
  const sub = n === 1
    ? '30+ gündür davam edirsən. Dayanma — hədəfə az qalıb!'
    : '2 aylıq yolun sonu! Hər gün qeyd etdin və ən yaxşısına çatdın. 🏆';
  const js = journalStats();
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal-box ms-modal">
      <div class="ms-emoji">${n === 1 ? '🎉' : '🏁'}</div>
      <div class="ms-title">${title}</div>
      <div class="ms-sub">${sub}</div>
      <div class="ms-stats">
        <div class="ms-stat"><b>${js.count}</b><span>qeyd olunan gün</span></div>
        <div class="ms-stat"><b>${js.avg || '—'}/10</b><span>orta puan</span></div>
        <div class="ms-stat"><b>${js.notes}</b><span>not</span></div>
        <div class="ms-stat"><b>${js.photos}</b><span>foto</span></div>
      </div>
      <div class="ms-actions">
        <button class="btn btn-primary" id="msGo">📝 Bugünü qeyd et</button>
        <button class="btn btn-ghost" id="msClose">Bağla</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  confetti();
  ov.querySelector('#msGo').addEventListener('click', () => {
    closeModal(ov);
    openJournalModal(todayStr());
  });
  ov.querySelector('#msClose').addEventListener('click', () => closeModal(ov));
  ov.addEventListener('click', ev => { if (ev.target === ov) closeModal(ov); });
  const escKey = ev => { if (ev.key === 'Escape') closeModal(ov); };
  document.addEventListener('keydown', escKey);
  ov._esc = escKey;
}
function confetti() {
  if (!window.requestAnimationFrame) return;
  const cnv = document.createElement('canvas');
  cnv.className = 'confetti';
  document.body.appendChild(cnv);
  const ctx = cnv.getContext('2d');
  cnv.width = window.innerWidth;
  cnv.height = window.innerHeight;
  const colors = ['#7c5cff', '#22d3ee', '#fbbf24', '#34d399', '#f87171', '#a78bfa'];
  const parts = [];
  for (let i = 0; i < 160; i++) {
    parts.push({
      x: Math.random() * cnv.width,
      y: -20 - Math.random() * cnv.height * 0.4,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      c: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 2.5,
      vy: 2 + Math.random() * 3,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3
    });
  }
  const t0 = performance.now();
  (function step(t) {
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    parts.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (performance.now() - t0 < 3200) window.requestAnimationFrame(step);
    else if (cnv.parentNode) cnv.parentNode.removeChild(cnv);
  })(t0);
}

/* ============ BACKUP ============ */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ielts-tracker-backup-' + todayStr() + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Backup faylı endirildi');
}
function importData(f) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d.settings || !d.errors || !d.mocks || !d.words || !d.days) throw new Error('format');
      if (!confirm('Mövcud bütün məlumat bu faylla əvəz olunacaq. Davam edirsən?')) return;
      const today = toISO(new Date());
      if (d.settings.start && d.settings.start < today && !(d.journal && Object.keys(d.journal).length)) {
        d.settings.start = today;
      }
      state = Object.assign(defaults(), d, { settings: Object.assign(defaults().settings, d.settings) });
      if (!state.journal) state.journal = {};
      save();
      render();
      toast('Məlumat uğurla import edildi');
    } catch (e) { toast('Yanlış fayl formatı — backup JSON deyil', 'err'); }
  };
  r.readAsText(f);
}

document.getElementById('importFile').addEventListener('change', e => {
  const f = e.target.files && e.target.files[0];
  if (f) importData(f);
  e.target.value = '';
});
window.addEventListener('beforeunload', () => {
  try { save(); } catch (e) {}
  idbFlush();
});

/* ============ INIT ============ */
function storageText() {
  if (disk.state === 'ready') return 'Hər dəyişiklik avtomatik olaraq <b>' + esc(disk.name) + '</b> faylına yazılır. Bundan əlavə məlumat IndexedDB-də də saxlanılır — F5, brauzer yaddaşının silinməsi və ya incognito rejim heç nəyi silə bilməz — 1–2 ay sonra da məlumat yerində olacaq.';
  if (disk.state === 'err') return 'Fayla yazmaq mümkün olmadı — məlumat IndexedDB-də təhlükəsizdir. Faylı yenidən seç və ya backup endir.';
  if (disk.state === 'unsupported') return 'Bu brauzer/səhifə fayl yaddaşını dəstəkləmir — məlumat IndexedDB-də təhlükəsiz saxlanılır, F5-də heç nə itmir. Chrome və ya Edge ilə açanda fayl seçə bilərsən.';
  return 'Məlumat avtomatik olaraq həm localStorage, həm də IndexedDB yaddaşına yazılır — F5, brauzerin bağlanması və ya yenidən açılması heç nəyi silmir. Əlavə təhlükəsizlik üçün kompüterində fayl seç və ya backup endir.';
}
function storageHint() {
  if (disk.state === 'ready') return 'Yaddaş: məlumat avtomatik <b>' + esc(disk.name) + '</b> faylına və IndexedDB-yə yazılır — F5 və ya yaddaş silinsə belə heç nə itməz.';
  return 'Yaddaş: məlumat IndexedDB-də saxlanılır — F5 və ya brauzerin bağlanması heç nəyi silmir. Əlavə təhlükəsizlik üçün idarə panelindən fayl seç və ya backup endir.';
}
function showConnectPrompt() {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal-box">
      <div class="modal-head"><h3>💾 Məlumatını kompüterdə saxla</h3><button class="btn btn-ghost btn-mini" id="cClose">✕</button></div>
      <div class="modal-body">
        <p class="hint">Məlumat hazırda brauzerin IndexedDB yaddaşında saxlanılır — F5-də heç nə itmir. Kompüterində fayl seçsən, brauzer yaddaşı tam silinsə belə məlumatın qalacaq.</p>
        <p class="hint">Bir dəfə <b>fayl seç</b>: bundan sonra hər dəyişiklik avtomatik həmin fayla yazılır və 1–2 ay sonra da heç nə itmir.</p>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="cSkip">Sonra</button>
        <button class="btn btn-primary" id="cPick">${IC.check} Fayl seç</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#cClose').addEventListener('click', () => closeModal(ov));
  ov.querySelector('#cSkip').addEventListener('click', () => { lsSet(LS_PROMPT, '1'); closeModal(ov); });
  ov.querySelector('#cPick').addEventListener('click', () => { lsSet(LS_PROMPT, '1'); closeModal(ov); pickDiskFile(); });
  ov.addEventListener('click', ev => { if (ev.target === ov) closeModal(ov); });
}
async function init() {
  // Yükləmə sırası: IndexedDB (ən etibarlı) → localStorage → disk faylı
  let local = loadLocal();
  const idb = await idbLoadData();
  if (idb) {
    if (hasAnyData(local) && hasAnyData(idb)) local = mergeStates(local, idb);
    else local = mergeState(idb);
  }
  state = mergeState(local);
  if (fsSupported()) {
    await restoreFileHandle();
    if (disk.state === 'ready') {
      const fdata = await readDisk();
      if (fdata) {
        if (hasAnyData(state) && hasAnyData(fdata)) state = mergeStates(state, fdata);
        else state = mergeState(fdata);
      }
    }
  } else {
    disk.state = 'unsupported';
  }
  save();
  render();
  updateStorageUI();
  if (disk.state === 'none' && fsSupported() && !lsGet(LS_PROMPT)) setTimeout(showConnectPrompt, 700);
}
init();
