'use strict';
/* ============================================================
   BAND 7.0 — IELTS TRACKER · App logic
   Bütün məlumatlar brauzerin localStorage-da saxlanılır.
   ============================================================ */

/* ================= CONSTANTS ================= */
const STORAGE_KEY = 'ieltsBand7Tracker_v1';

const DAILY_DEFAULTS = [
  { id: 'vocab',     label: 'Vokabulyar — 15–20 söz + cümlə', dur: '30 dəq', tip: 'Sözləri sadəcə siyahı ilə deyil, cümlə içində öyrən. Yeni sözləri Vokabulyar bölməsinə əlavə et.' },
  { id: 'listening', label: 'Listening məşqi — 1 section + texnika', dur: '45 dəq', tip: 'Section əvvəli sualları predict et. Dinlədikdən sonra səhvlərini Səhv Log-a kodlaşdır.' },
  { id: 'reading',   label: 'Reading məşqi — 1 passage + texnika', dur: '60 dəq', tip: 'Passage-a 20 dəqiqə vaxt. Parafrazları işarələ, T/F/NG məntiqini tətbiq et.' },
  { id: 'speaking',  label: 'Speaking — səsyazma + dinləmə', dur: '30 dəq', tip: 'Part cavabını səsə yaz, özünü dinlə: uzun pauzalar, zaman səhvləri, təkrarlanan sözlər.' },
  { id: 'errors',    label: 'Səhv analizi — error log yenilə', dur: '15 dəq', tip: 'Bugünkü səhvləri kodlaşdır (L1–L7, R1–R7, S1–S5). Ən çox təkrarlanan kodu hədəf seç.' },
  { id: 'audio',     label: 'İngilis audio — TED / YouTube', dur: '15 dəq', tip: 'Subtitr açıq bax, 10 yeni ifadə yaz. Qulağı ingilis dilinə öyrət.' }
];

const ERROR_CODES = {
  L: {
    L1: { name: 'Eşitmədim (sürət / akcent)', fix: 'Hər gün müxtəlif akcentlər dinlə (UK, US, AU). Çətin olduqda 0.75x sürətlə, sonra normala keç.' },
    L2: { name: 'Yazı / sayı səhvi (13 vs 30)', fix: 'Sayları və hərfləri ayrıca məşq et. Hər dinləmədə eşitdiyin bütün sayları yaz.' },
    L3: { name: 'Parafraz tanınmadı', fix: 'Sual sözünün sinonimlərini axtar (expensive → costly). Hər sual üçün 3 sinonim yaz.' },
    L4: { name: 'Predict etmədim', fix: 'Section əvvəli 15 saniyə sualları oxu: cavab rəqəmdir, addır, yoxsa tarix? Təxmin et.' },
    L5: { name: 'Signpost qaçdı', fix: '“but / however / actually / so” sonrası cavabdır. Bu sözləri eşidəndə diqqəti artır.' },
    L6: { name: 'Diqqət dağıldı', fix: 'Bir sual qaçdısa — burax, növbəti suala keç. Əsir qalma, diqqəti geri qaytar.' },
    L7: { name: 'Qrammatik uyğunluq', fix: 'Cavab cümləyə qrammatik uyğun olmalıdır (a/the, zaman, cəm). Yazmadan əvvəl yoxla.' }
  },
  R: {
    R1: { name: 'Parafraz tanınmadı', fix: 'Sual ↔ mətn sinonimiya tapmağı məşq et. Hər passage-da 5 parafrazı işarələ.' },
    R2: { name: 'Scanning bacarılmadı', fix: 'Açar sözü tap, mətndə sürətlə axtar. Hamısını deyil, yalnız açar sözün ətrafını oxu.' },
    R3: { name: 'Skimming edilmədi', fix: 'Hər mətnə əvvəl 2 dəqiqə skim: başlıqlar + ilk və son cümlələr. Sonra suallara keç.' },
    R4: { name: 'T/F/NG məntiq səhvi', fix: 'False = mətn əksini deyir. Not Given = mətndə heç yoxdur. Üç halı ayrıca yoxla.' },
    R5: { name: 'Naməlum söz blok etdi', fix: 'Sözün mənasını kontekstdən təxmin et. Naməlum sözü Vokabulyar-a əlavə et.' },
    R6: { name: 'Sual tipi tanınmadı', fix: '14 sual tipinin hamısını öyrən (matching headings, completion və s.). Hər tipə strategiya yaz.' },
    R7: { name: 'Vaxt çatmadı', fix: 'Passage-a 20 dəqiqə planla, 17 dəqiqədə bitirməyə çalış. Qalan vaxt = yoxlama.' }
  },
  S: {
    S1: { name: 'Uzun pauza / təkrar (fluency)', fix: 'Keçid ifadələri öyrən: “Well, actually…”, “To be honest…”, “Another point is…”. Pauza yerinə bunları de.' },
    S2: { name: 'Zaman səhvi (went/go)', fix: 'Part 2-də keçmiş zaman, Part 3-də indiki zaman. Cavabı yazıb zamanı yoxla.' },
    S3: { name: 'Article səhvi (a/the)', fix: 'İlk dəfə deyilən isim → a/an, tanış olan → the. Gündə 5 cümlədə yoxla.' },
    S4: { name: 'Sadə / təkrarlanan söz (very, good)', fix: 'Sinonimiya: good → beneficial / effective; very → extremely / remarkably. Hər dəfə 1 yenisini işlət.' },
    S5: { name: 'Tələffüz səhvi', fix: 'Səsyaz, səhv dediyin sözləri lüğətdən (Google TTS) dinlə və 3 dəfə təkrarla.' }
  }
};

const ROADMAP_WEEKS = [
  {
    id: 'w1', title: 'Texnika qurma · I', phase: 'Listening & Reading əsasları',
    goal: 'İmtahan formatını və 2 əsas texnikanı avtomatlaşdır: prediction (L) + skim/scan (R). Bu həftə bal yox — texnika.',
    tasks: [
      '[L] Format: 4 section / 40 sual — hər section yalnız 1 dəfə oxunur',
      '[L] Prediction texnikası — audio başlamazdan sualları oxu və cavab tipini təxmin et',
      '[R] Skimming məşqi — hər mətnə 2–3 dəqiqə (başlıq + ilk/son cümlələr)',
      '[R] Parafraz tanıma — sualdakı sözlər mətndə sinonimlə işlənir',
      '[S] Speaking Part 1 — 5 mövzu: cavabı səsə yaz, dinlə, düzəlt',
      'Vokabulyar: gündə 15–20 söz (cümlə ilə) — bu saytın Vokabulyar bölməsinə əlavə et',
      'Həftəsonu yoxlama: 1 L section + 1 R passage (vaxtsız)'
    ]
  },
  {
    id: 'w2', title: 'Texnika qurma · II', phase: 'Sual tipləri & sürət',
    goal: '14 sual tipinin hamısını tanı, T/F/NG məntiqini çıxart, Speaking Part 2 quruluşunu öyrən.',
    tasks: [
      '[L] Signpost sözləri — but / however / actually sonrası cavabdır',
      '[L] Transkripsiya məşqi — 1 dəqiqəlik audio, hər sözü yaz (həftədə 3 dəfə)',
      '[R] Scanning — açar söz tap + mətndə sürətli axtarış',
      '[R] T/F/NG məntiqi — False ≠ Not Given fərqini çıxart',
      '[R] 14 sual tipini tanı — hər tipə 1 strategiya yaz',
      '[S] Part 2 — 1 dəqiqə hazırlıq + 2 dəqiqə monoloq (qeyd texnikası)',
      'Həftəsonu yoxlama: 1 L section + 1 R passage (vaxtsız)'
    ]
  },
  {
    id: 'w3', title: 'İlk tam mock', phase: 'Analiz sistemi başlayır',
    goal: 'İlk tam mock nəticəsi = başlanğıc nöqtən. Error log sistemi qurulur: hər səhvə kod verilir.',
    tasks: [
      'Gündəlik: 1 vaxtlı Listening section (30 dəqiqə)',
      'Gündəlik: 1 vaxtlı Reading passage (20 dəqiqə)',
      'Speaking: gündə 1 Part səsyazma',
      'Vokabulyar: yeni sözləri sayta əlavə et',
      'Şənbə: İLK TAM MOCK — IELTS Online, real şərtlər, pauzasız',
      'Bazar: tam error analiz — hər səhvi Səhv Log-a kodlaşdır'
    ]
  },
  {
    id: 'w4', title: 'Zəif nöqtəni hədəflə', phase: 'Hədəfli məşq',
    goal: '1 koda hədəflə. Təkrarlanan səhvə fokus = ən sürətli band artımı.',
    tasks: [
      'Hədəf: ən böyük səhv kodu — gündə 30 dəqiqə hədəfli məşq (məs: R4)',
      'Gündəlik rutin davam: 1 L section + 1 R passage (vaxtlı)',
      'Vokabulyar: gündə 15–20 söz',
      'Speaking: həftədə 2 Part səsyazma',
      'Şənbə: MOCK #2 (IELTS Online)',
      'Bazar: analiz + Həftə 3 ilə müqayisə — hansı kodlar azalıb?'
    ]
  },
  {
    id: 'w5', title: 'Bölmə ixtisaslaşması', phase: 'Ən zəif bölməyə ağırlıq',
    goal: 'Ən zəif bölməni gücləndir. Həftədə 3 tam Speaking sessiyası ilə fluency inkişaf et.',
    tasks: [
      'Ən zəif bölməyə gündə 90 dəqiqə (əksərən Reading)',
      '[L] Transkripsiya məşqi — həftədə 3 dəfə',
      '[S] Həftədə 3 tam Part 1–2–3 səsyazma + dinləmə',
      'Vokabulyar: köhnə sözləri təkrar et (Gün 1 / Gün 3 / Gün 7 mərhələləri)',
      'Şənbə: MOCK #3',
      'Bazar: error analiz + növbəti hədəfi seç'
    ]
  },
  {
    id: 'w6', title: 'Sürət və dəqiqlik', phase: 'Time management',
    goal: 'Sürət = ən az 3 dəqiqə ehtiyat. 3 həftədir təkrarlanan səhvləri bitir.',
    tasks: [
      '[R] Passage vaxtını 20 → 17 dəqiqəyə endir',
      '[L] Prediction məşqini saniyəölçənlə et',
      '3 həftədir təkrarlanan səhv varsa — ona xüsusi məşq günü ayır',
      'Vokabulyar: səhv suallardan çıxan naməlum sözləri əlavə et',
      'Şənbə: MOCK #4',
      'Bazar: analiz + band izləmə cədvəlini yenilə'
    ]
  },
  {
    id: 'w7', title: 'İmtahan simulyasiyası', phase: '2 tam mock',
    goal: '2 tam mock = imtahan təcrübəsi. Stress, vaxt və dözümlülük bu həftə yoxlanır.',
    tasks: [
      'Çərşənbə: MOCK #5 — real imtahan şərtləri (səssiz otaq, qulaqlıq, kağız/qələm)',
      'Şənbə: MOCK #6',
      'Speaking: 2 dəfə tam səsyazma + özünü dinləmə',
      'Köhnə səhv suallarına geri qayıt (spot review)',
      'Bazar: hər iki mock-un error analizi',
      'Enerji idarəsi: yuxu və qidalanmaya diqqət'
    ]
  },
  {
    id: 'w8', title: 'Final cilalama', phase: 'İmtahan həftəsi',
    goal: 'Səhv tarixçəni bitir — azalmayan 1 kateqoriya qalmasın. İmtahan gününə planlı gir.',
    tasks: [
      'Bütün köhnə səhv suallarını yenidən et',
      'Çərşənbə: yarım mock (L + R, vaxtlı)',
      'Azalmayan kateqoriyalara son baxış',
      'İmtahan günü planı: vaxt paylaması + materiallar',
      'Təxmin strategiyası: boş sual qoyma — hər suala cavab yaz',
      'İmtahandan 1 gün əvvəl tam istirahət'
    ]
  }
];

const BAND_TABLE = [
  [39, 40, 9.0], [37, 38, 8.5], [35, 36, 8.0], [33, 34, 7.5], [30, 32, 7.0],
  [27, 29, 6.5], [23, 26, 6.0], [19, 22, 5.5], [15, 18, 5.0], [13, 14, 4.5],
  [10, 12, 4.0], [8, 9, 3.5], [6, 7, 3.0]
];

const MONTHS_AZ = ['yanvar','fevral','mart','aprel','may','iyun','iyul','avqust','sentyabr','oktyabr','noyabr','dekabr'];

/* ================= STATE ================= */
function defaultState() {
  return {
    profile: { name: 'Dostum', module: 'Academic', target: 7.0, start: '', exam: '' },
    daily: {},            // { '2026-08-27': { def:[bool...], cus:{taskId:bool} } }
    customTasks: {},      // { '2026-08-27': [{id,label}] }
    mistakes: [],         // {id,date,section,code,type,question,mine,correct,note}
    mocks: [],            // {id,date,listening,reading,speaking,note,overall}
    vocab: [],            // {id,word,meaning,sentence,date,stage}
    roadmapCheck: {}      // { w1: { 0:true, ... } }
  };
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    return Object.assign(defaultState(), s);
  } catch (e) { return defaultState(); }
}
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { toast('Məlumat saxlanıla bilmədi', 'err'); } }
let state = load();

/* ================= HELPERS ================= */
const pad = n => String(n).padStart(2, '0');
const fmt = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayStr = () => fmt(new Date());
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDateAz(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return d + ' ' + MONTHS_AZ[m - 1] + ' ' + y;
}
function fmtDateShort(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return d + '.' + m;
}
function toast(msg, type = 'ok') {
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'err' ? ' err' : type === 'warn' ? ' warn' : '');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, 3200);
}
function rawToBand(raw) {
  for (const [lo, hi, b] of BAND_TABLE) if (raw >= lo && raw <= hi) return b;
  return raw >= 40 ? 9 : 3;
}
function bandRound(x) { return Math.round(x * 2) / 2; }
function overallBand(m) {
  const parts = [rawToBand(m.listening), rawToBand(m.reading)];
  if (m.speaking) parts.push(Number(m.speaking));
  return bandRound(parts.reduce((a, b) => a + b, 0) / parts.length);
}
function codeColor(code) {
  const sec = String(code || '').charAt(0);
  return sec === 'R' ? '#0ea5e9' : sec === 'S' ? '#f97316' : '#8b5cf6';
}
function codeGrad(code) {
  const sec = String(code || '').charAt(0);
  return sec === 'R' ? 'linear-gradient(90deg,#0ea5e9,#22d3ee)' : sec === 'S' ? 'linear-gradient(90deg,#f59e0b,#f97316)' : 'linear-gradient(90deg,#6366f1,#8b5cf6)';
}
function pillClass(code) { return 'pill-' + String(code || 'L').charAt(0); }
function currentWeekNum() {
  if (!state.profile.start) return null;
  const start = new Date(state.profile.start + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - start) / 86400000);
  return Math.min(8, Math.max(1, Math.floor(diff / 7) + 1));
}
function calcStreak() {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 500; i++) {
    const key = fmt(d);
    const entry = state.daily[key];
    const done = DAILY_DEFAULTS.filter((t, idx) => entry && entry.def && entry.def[idx]).length;
    if (done >= Math.ceil(DAILY_DEFAULTS.length * 0.66)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}
function topCodes(n = 3) {
  const counts = {};
  state.mistakes.forEach(m => { counts[m.code] = (counts[m.code] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n).map(([code, count]) => ({ code, count }));
}

/* ================= NAVIGATION ================= */
function switchView(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

/* ================= DASHBOARD ================= */
function renderDashboard() {
  const today = todayStr();
  const entry = state.daily[today] || { def: [], cus: {} };
  const doneDef = DAILY_DEFAULTS.filter((t, i) => entry.def && entry.def[i]).length;
  const cusTasks = state.customTasks[today] || [];
  const doneCus = cusTasks.filter(t => entry.cus && entry.cus[t.id]).length;
  const total = DAILY_DEFAULTS.length + cusTasks.length;

  document.getElementById('dashName').textContent = state.profile.name || 'Dostum';
  const sub = document.getElementById('dashSub');
  const hour = new Date().getHours();
  sub.textContent = hour < 12 ? 'Sabahın xeyir — bu gün də bir addım irəli.' :
    hour < 18 ? 'Günortan xeyir — texnikanı unutma.' : 'Axşamın xeyir — bugünkü məşqi bitir.';
  document.getElementById('todayChip').textContent = fmtDateAz(today);
  document.getElementById('statDaily').textContent = (doneDef + doneCus) + '/' + total;
  document.getElementById('statStreak').textContent = calcStreak();
  document.getElementById('statErrors').textContent = state.mistakes.length;

  const last = state.mocks[state.mocks.length - 1];
  document.getElementById('statBand').textContent = last ? last.overall.toFixed(1) : '—';

  document.getElementById('mockCountTag').textContent = state.mocks.length + ' test';
  document.getElementById('errorCountTag').textContent = state.mistakes.length + ' səhv';
  drawMockChart(document.getElementById('mockChart'), state.mocks.slice(-6));

  // Top error bars
  const tc = topCodes(3);
  const bars = document.getElementById('topErrorBars');
  if (!tc.length) {
    bars.innerHTML = '<div class="empty">Səhv qeydi yoxdur. Testlərdən sonra hər səhvini Səhv Log-da qeyd et.</div>';
  } else {
    const max = tc[0].count;
    bars.innerHTML = tc.map(t => `
      <div class="bar-row">
        <span class="bar-code">${esc(t.code)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(12, (t.count / max) * 100)}%;background:${codeGrad(t.code)}">${t.count}</div></div>
      </div>`).join('');
  }

  // Tip
  const tip = document.getElementById('dashTipText');
  if (tc.length && ERROR_CODES[tc[0].code.charAt(0)] && ERROR_CODES[tc[0].code.charAt(0)][tc[0].code]) {
    const c = ERROR_CODES[tc[0].code.charAt(0)][tc[0].code];
    tip.innerHTML = `Ən çox təkrarlanan səhv: <b>${esc(tc[0].code)} — ${esc(c.name)}</b>. Həll: ${esc(c.fix)}`;
  } else {
    tip.textContent = 'Səhv kodlarını qeyd et — sistem sənə ən çox təkrarlanan problemi göstərsin.';
  }

  // Focus
  renderFocus();
}
function renderFocus() {
  const weekNum = currentWeekNum();
  const tag = document.getElementById('weekTag');
  const box = document.getElementById('focusBox');
  if (!weekNum) {
    tag.textContent = '—';
    box.innerHTML = '<div class="empty">Roadmap-də başlanğıc tarixi təyin et (Parametrlər) — bugünkü həftənin hədəfini göstərək.</div>';
    return;
  }
  const week = ROADMAP_WEEKS[weekNum - 1];
  tag.textContent = 'Həftə ' + weekNum + ' / 8';
  const checks = state.roadmapCheck[week.id] || {};
  const remaining = week.tasks.map((t, i) => ({ t, i })).filter(x => !checks[x.i]);
  let html = `<div class="focus-item"><div class="focus-week">Həftə ${weekNum}</div><div class="focus-text"><strong>${esc(week.title)}</strong> — ${esc(week.goal)}</div></div>`;
  if (remaining.length) {
    const next = remaining.slice(0, 3);
    next.forEach(x => {
      html += `<div class="focus-item"><div class="focus-week">Tapşırıq</div><div class="focus-text">${esc(x.t)}</div></div>`;
    });
    if (remaining.length > 3) html += `<div class="focus-item"><div class="focus-week">+${remaining.length - 3} daha</div><div class="focus-text">Qalan tapşırıqları Roadmap bölməsindən işarələ.</div></div>`;
  } else {
    html += `<div class="focus-item"><div class="focus-week">Təbrik!</div><div class="focus-text">Bu həftənin bütün tapşırıqları tamamlandı. 🎯</div></div>`;
  }
  box.innerHTML = html;
}

/* ================= ROADMAP ================= */
function renderRoadmap() {
  let total = 0, done = 0;
  const list = document.getElementById('roadmapList');
  const cur = currentWeekNum();
  list.innerHTML = ROADMAP_WEEKS.map((w, wi) => {
    const checks = state.roadmapCheck[w.id] || {};
    let wDone = 0;
    w.tasks.forEach((t, i) => { total++; if (checks[i]) { wDone++; done++; } });
    const pct = Math.round((wDone / w.tasks.length) * 100);
    const isCurrent = cur === wi + 1;
    const cls = ['week-card'];
    if (pct === 100) cls.push('done');
    if (isCurrent) cls.push('current');
    const taskRows = w.tasks.map((t, i) => `
      <label class="rtask">
        <input type="checkbox" data-week="${w.id}" data-idx="${i}" ${checks[i] ? 'checked' : ''}>
        <span class="chk"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>
        <span class="rtask-label">${esc(t)}</span>
      </label>`).join('');
    return `
      <div class="${cls.join(' ')}" data-week-card="${w.id}">
        <div class="week-head">
          <div class="week-num">${wi + 1}</div>
          <div class="week-info">
            <div class="week-title">Həftə ${wi + 1}: ${esc(w.title)}</div>
            <div class="week-phase">${esc(w.phase)}</div>
          </div>
          <div class="week-meta">
            <div class="week-bar"><div class="week-bar-fill" style="width:${pct}%"></div></div>
            <span class="week-pct">${pct}%</span>
          </div>
          <svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        <div class="week-body">
          <div class="week-goal"><strong>Həftə hədəfi:</strong> ${esc(w.goal)}</div>
          ${taskRows}
        </div>
      </div>`).join('');

  // Ring
  const ring = document.getElementById('roadmapRing');
  const pct = total ? Math.round((done / total) * 100) : 0;
  ring.style.setProperty('--p', pct);
  ring.querySelector('span').textContent = pct + '%';
  document.getElementById('roadmapPct').textContent = pct + '%';

  // Summary
  document.getElementById('rsTarget').textContent = state.profile.target.toFixed(1);
  document.getElementById('rsStart').textContent = state.profile.start ? fmtDateAz(state.profile.start) : '—';
  document.getElementById('rsExam').textContent = state.profile.exam ? fmtDateAz(state.profile.exam) : '—';
  document.getElementById('rsCurrent').textContent = cur ? 'Həftə ' + cur : 'Tarix təyin et';

  // Events
  list.querySelectorAll('.week-head').forEach(h => {
    h.addEventListener('click', () => {
      const card = h.closest('.week-card');
      card.classList.toggle('open');
    });
  });
  list.querySelectorAll('.rtask input').forEach(cb => {
    cb.addEventListener('change', () => {
      const w = cb.dataset.week, i = cb.dataset.idx;
      state.roadmapCheck[w] = state.roadmapCheck[w] || {};
      state.roadmapCheck[w][i] = cb.checked;
      save(); renderRoadmap(); renderDashboard();
    });
  });
}

/* ================= DAILY ================= */
function renderDaily() {
  const today = todayStr();
  const entry = state.daily[today] || { def: [], cus: {} };
  const cusTasks = state.customTasks[today] || [];
  const list = document.getElementById('dailyTaskList');

  const defRows = DAILY_DEFAULTS.map((t, i) => {
    const done = entry.def && entry.def[i];
    return `
      <div class="task-item ${done ? 'done' : ''}">
        <button class="task-check" data-kind="def" data-idx="${i}" aria-label="işarələ">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </button>
        <div class="task-main">
          <div class="task-label">${esc(t.label)}</div>
          <div class="task-dur">${esc(t.dur)}</div>
        </div>
      </div>`;
  }).join('');

  const cusRows = cusTasks.map(t => {
    const done = entry.cus && entry.cus[t.id];
    return `
      <div class="task-item ${done ? 'done' : ''}">
        <button class="task-check" data-kind="cus" data-id="${t.id}" aria-label="işarələ">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </button>
        <div class="task-main"><div class="task-label">${esc(t.label)}</div><div class="task-dur">Xüsusi</div></div>
        <button class="task-del" data-del="${t.id}" aria-label="sil">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>`;
  }).join('');

  list.innerHTML = defRows + cusRows;
  document.getElementById('dailyChip').textContent = fmtDateAz(today);

  const doneDef = DAILY_DEFAULTS.filter((t, i) => entry.def && entry.def[i]).length;
  const doneCus = cusTasks.filter(t => entry.cus && entry.cus[t.id]).length;
  const total = DAILY_DEFAULTS.length + cusTasks.length;
  const pct = total ? Math.round(((doneDef + doneCus) / total) * 100) : 0;
  document.getElementById('dailyProgressTag').textContent = (doneDef + doneCus) + '/' + total;
  document.getElementById('dailyProgressBar').style.width = pct + '%';

  const guide = document.getElementById('taskGuide');
  guide.innerHTML = DAILY_DEFAULTS.map((t, i) => `
    <div class="guide-item"><span class="guide-num">${i + 1}</span><span><strong>${esc(t.label)}</strong> (${esc(t.dur)}) — ${esc(t.tip)}</span></div>`).join('');
}
function toggleTask(kind, idxOrId) {
  const today = todayStr();
  state.daily[today] = state.daily[today] || { def: [], cus: {} };
  const entry = state.daily[today];
  if (kind === 'def') {
    entry.def[idxOrId] = !entry.def[idxOrId];
  } else {
    entry.cus[idxOrId] = !entry.cus[idxOrId];
  }
  save(); renderDaily(); renderDashboard();
}
document.getElementById('dailyTaskList').addEventListener('click', e => {
  const chk = e.target.closest('.task-check');
  if (chk) { toggleTask(chk.dataset.kind, chk.dataset.idx !== undefined ? Number(chk.dataset.idx) : chk.dataset.id); return; }
  const del = e.target.closest('.task-del');
  if (del) {
    const today = todayStr();
    state.customTasks[today] = (state.customTasks[today] || []).filter(t => t.id !== del.dataset.del);
    if (state.daily[today]) delete state.daily[today].cus[del.dataset.del];
    save(); renderDaily();
  }
});
document.getElementById('btnAddTask').addEventListener('click', addCustomTask);
document.getElementById('newTaskInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTask(); } });
function addCustomTask() {
  const inp = document.getElementById('newTaskInput');
  const label = inp.value.trim();
  if (!label) return;
  const today = todayStr();
  state.customTasks[today] = state.customTasks[today] || [];
  state.customTasks[today].push({ id: uid(), label });
  inp.value = '';
  save(); renderDaily();
}

/* ================= ERRORS ================= */
let errSeg = 'all', filterSection = '', filterCode = '';
function populateErrCode() {
  const sec = document.getElementById('errSection').value;
  const sel = document.getElementById('errCode');
  sel.innerHTML = Object.keys(ERROR_CODES[sec]).map(c => `<option value="${c}">${c} — ${esc(ERROR_CODES[sec][c].name)}</option>`).join('');
}
document.getElementById('errSection').addEventListener('change', populateErrCode);
document.getElementById('errForm').addEventListener('submit', e => {
  e.preventDefault();
  const code = document.getElementById('errCode').value;
  const type = document.getElementById('errType').value;
  const question = document.getElementById('errQuestion').value.trim();
  const mine = document.getElementById('errMine').value.trim();
  const correct = document.getElementById('errCorrect').value.trim();
  const note = document.getElementById('errNote').value.trim();
  if (!code) { toast('Səhv kodu seç', 'warn'); return; }
  state.mistakes.push({ id: uid(), date: todayStr(), section: document.getElementById('errSection').value, code, type, question, mine, correct, note });
  save();
  e.target.reset();
  populateErrCode();
  toast('Səhv qeyd olundu ✓');
  renderAll();
});
document.getElementById('btnQuickError').addEventListener('click', () => {
  document.getElementById('view-errors').scrollIntoView({ behavior: 'smooth' });
  document.getElementById('errSection').focus();
});
function renderErrors() {
  // Legend
  const legend = document.getElementById('legendGrid');
  legend.innerHTML = Object.keys(ERROR_CODES).map(sec =>
    Object.keys(ERROR_CODES[sec]).map(code => {
      const c = ERROR_CODES[sec][code];
      return `<div class="legend-item"><span class="code-pill ${pillClass(code)}">${code}</span> <b>${esc(c.name)}</b><br>${esc(c.fix)}</div>`;
    }).join('')
  ).join('');

  // Seg active state
  document.querySelectorAll('#errSeg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.seg === errSeg));

  // Stats bars
  const counts = {};
  state.mistakes.forEach(m => {
    if (errSeg !== 'all' && m.section !== errSeg) return;
    counts[m.code] = (counts[m.code] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const statBars = document.getElementById('errStatBars');
  const insight = document.getElementById('errInsight');
  if (!sorted.length) {
    statBars.innerHTML = '<div class="empty">Bu bölmədə səhv qeydi yoxdur.</div>';
    insight.innerHTML = '';
  } else {
    const max = sorted[0][1];
    statBars.innerHTML = sorted.map(([code, count]) => `
      <div class="bar-row">
        <span class="bar-code">${esc(code)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(12, (count / max) * 100)}%;background:${codeGrad(code)}">${count}</div></div>
        <span class="bar-count">${count}</span>
      </div>`).join('');
    const [topCode, topCount] = sorted[0];
    const c = ERROR_CODES[topCode.charAt(0)][topCode];
    const pctAll = state.mistakes.length ? Math.round((topCount / state.mistakes.length) * 100) : 0;
    insight.innerHTML = `🔍 <strong>${esc(topCode)}</strong> ən çox təkrarlanan səhvdir (bütün səhvlərin <strong>${pctAll}%</strong>).<br>Bu həftə yalnız ona fokuslan: <em>${esc(c.fix)}</em>`;
  }

  // Filter code select
  const codeSel = document.getElementById('filterCode');
  codeSel.innerHTML = '<option value="">Bütün kodlar</option>' +
    Object.keys(ERROR_CODES).map(sec => Object.keys(ERROR_CODES[sec]).map(c =>
      `<option value="${c}" ${filterCode === c ? 'selected' : ''}>${c}</option>`).join('')).join('');

  // List
  let list = state.mistakes.slice().reverse();
  if (filterSection) list = list.filter(m => m.section === filterSection);
  if (filterCode) list = list.filter(m => m.code === filterCode);
  const el = document.getElementById('errorList');
  if (!list.length) {
    el.innerHTML = '<div class="empty">Səhv qeydi tapılmadı.</div>';
  } else {
    el.innerHTML = list.map(m => {
      const meta = [m.type].filter(Boolean).map(t => `<span class="pill-tip">${esc(t)}</span>`).join('');
      return `
        <div class="error-item">
          <div class="error-body">
            <div class="error-meta">
              <span class="code-pill ${pillClass(m.code)}">${esc(m.code)}</span>
              ${meta}
              <span class="error-date">${fmtDateAz(m.date)}</span>
            </div>
            <div class="error-q">${esc(m.question || '(sual yazılmayıb)')}</div>
            <div class="error-a">
              ${m.mine ? `<span class="mine">${esc(m.mine)}</span><span class="arrow">→</span>` : ''}
              <span class="correct">${esc(m.correct || '—')}</span>
            </div>
            ${m.note ? `<div class="error-note">${esc(m.note)}</div>` : ''}
          </div>
          <button class="error-del" data-id="${m.id}" aria-label="sil">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          </button>
        </div>`;
    }).join('');
  }
}
document.getElementById('errorList').addEventListener('click', e => {
  const del = e.target.closest('.error-del');
  if (!del) return;
  state.mistakes = state.mistakes.filter(m => m.id !== del.dataset.id);
  save(); renderAll();
  toast('Səhv silindi');
});
document.getElementById('errSeg').addEventListener('click', e => {
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  errSeg = btn.dataset.seg;
  renderErrors();
});
document.getElementById('filterSection').addEventListener('change', e => { filterSection = e.target.value; renderErrors(); });
document.getElementById('filterCode').addEventListener('change', e => { filterCode = e.target.value; renderErrors(); });

/* ================= MOCKS ================= */
document.getElementById('mockForm').addEventListener('submit', e => {
  e.preventDefault();
  const date = document.getElementById('mockDate').value || todayStr();
  const listening = Number(document.getElementById('mockListening').value);
  const reading = Number(document.getElementById('mockReading').value);
  const speaking = document.getElementById('mockSpeaking').value;
  const note = document.getElementById('mockNote').value.trim();
  if (listening < 0 || listening > 40 || reading < 0 || reading > 40) { toast('Bal 0–40 arası olmalıdır', 'warn'); return; }
  const m = { id: uid(), date, listening, reading, speaking: speaking || null, note };
  m.overall = overallBand(m);
  state.mocks.push(m);
  state.mocks.sort((a, b) => (a.date + a.id).localeCompare(b.date + b.id));
  save();
  e.target.reset();
  document.getElementById('mockDate').value = todayStr();
  toast('Mock nəticəsi saxlandı — təxmini band: ' + m.overall.toFixed(1));
  renderAll();
});
document.getElementById('btnQuickMock').addEventListener('click', () => {
  document.getElementById('view-mocks').scrollIntoView({ behavior: 'smooth' });
  document.getElementById('mockListening').focus();
});
function renderMocks() {
  const mocks = state.mocks;
  document.getElementById('mockCountTag2').textContent = mocks.length + ' test';
  drawMockChart(document.getElementById('mockChartBig'), mocks);

  const tbody = document.getElementById('mockTbody');
  if (!mocks.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">Hələ mock yoxdur — Həftə 3-dən başlayaraq IELTS Online-da test et.</td></tr>';
  } else {
    tbody.innerHTML = mocks.map((m, i) => {
      const lB = rawToBand(m.listening), rB = rawToBand(m.reading);
      const cls = b => b >= 7 ? 'hi' : b >= 5.5 ? 'mid' : 'lo';
      return `
        <tr>
          <td class="strong">${i + 1}</td>
          <td>${fmtDateAz(m.date)}</td>
          <td><span class="band-badge ${cls(lB)}">${lB.toFixed(1)}</span> <span class="pill-tip">${m.listening}/40</span></td>
          <td><span class="band-badge ${cls(rB)}">${rB.toFixed(1)}</span> <span class="pill-tip">${m.reading}/40</span></td>
          <td>${m.speaking ? `<span class="band-badge ${cls(Number(m.speaking))}">${Number(m.speaking).toFixed(1)}</span>` : '—'}</td>
          <td><span class="band-badge ${cls(m.overall)}">${m.overall.toFixed(1)}</span></td>
          <td class="note">${esc(m.note || '—')}</td>
          <td><button class="error-del" data-mock="${m.id}" aria-label="sil"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button></td>
        </tr>`;
    }).join('');
  }

  // Avg
  const avg = document.getElementById('avgBox');
  if (mocks.length) {
    const avgBand = bandRound(mocks.reduce((a, m) => a + m.overall, 0) / mocks.length);
    const target = state.profile.target;
    const diff = (target - avgBand).toFixed(1);
    avg.innerHTML = `<div><div class="avg-label">Orta band</div><div class="avg-num">${avgBand.toFixed(1)}</div></div>
      <div><div class="avg-label">Hədəf</div><div class="avg-num" style="-webkit-text-fill-color:var(--amber)">${target.toFixed(1)}</div></div>
      <div><div class="avg-label">Qalan məsafə</div><div class="avg-num" style="-webkit-text-fill-color:${diff > 0 ? 'var(--red)' : 'var(--green)'}">${diff > 0 ? '+' + diff : '0.0'}</div></div>`;
  } else {
    avg.innerHTML = '<div class="avg-label">İlk mock nəticəsini əlavə et</div>';
  }

  // Band table
  document.getElementById('bandTable').innerHTML = BAND_TABLE.map(([lo, hi, b]) =>
    `<div class="band-cell"><b>${b.toFixed(1)}</b> — ${lo}–${hi} düzgün cavab</div>`).join('');
}
document.getElementById('mockTbody').addEventListener('click', e => {
  const del = e.target.closest('[data-mock]');
  if (!del) return;
  state.mocks = state.mocks.filter(m => m.id !== del.dataset.mock);
  save(); renderAll();
  toast('Mock silindi');
});
function drawMockChart(el, mocks) {
  el.innerHTML = '';
  if (!mocks.length) {
    el.innerHTML = '<div class="empty">İlk mock nəticəni əlavə et — qrafik burada görünəcək.</div>';
    return;
  }
  const W = 560, H = 210, P = { l: 36, r: 16, t: 20, b: 34 };
  const bands = mocks.map(m => m.overall);
  const minB = Math.max(3, Math.floor(Math.min(...bands) - 0.6));
  const maxB = Math.min(9, Math.ceil(Math.max(...bands) + 0.4));
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const x = i => mocks.length === 1 ? P.l + iw / 2 : P.l + i * (iw / (mocks.length - 1));
  const y = v => P.t + ih - ((v - minB) / ((maxB - minB) || 1)) * ih;
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
  svg += '<defs><linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#22d3ee"/></linearGradient></defs>';
  for (let b = Math.ceil(minB); b <= maxB; b++) {
    const yy = y(b);
    svg += `<line class="chart-grid-line" x1="${P.l}" y1="${yy}" x2="${W - P.r}" y2="${yy}"/>`;
    svg += `<text class="chart-axis" x="${P.l - 8}" y="${yy + 3}" text-anchor="end">${b.toFixed(1)}</text>`;
  }
  const tgt = Number(state.profile.target);
  if (tgt >= minB && tgt <= maxB) {
    const ty = y(tgt);
    svg += `<line x1="${P.l}" y1="${ty}" x2="${W - P.r}" y2="${ty}" stroke="#fbbf24" stroke-width="1.5" stroke-dasharray="5 4"/>`;
    svg += `<text class="chart-axis" x="${W - P.r - 4}" y="${ty - 5}" text-anchor="end" fill="#fbbf24">Hədəf ${tgt.toFixed(1)}</text>`;
  }
  const pts = bands.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
  if (mocks.length > 1) svg += `<polyline class="chart-line" points="${pts}"/>`;
  bands.forEach((v, i) => {
    svg += `<circle class="chart-dot" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4.5"/>`;
    svg += `<text class="chart-val" x="${x(i).toFixed(1)}" y="${(y(v) - 9).toFixed(1)}" text-anchor="middle">${v.toFixed(1)}</text>`;
    svg += `<text class="chart-label" x="${x(i).toFixed(1)}" y="${H - 10}" text-anchor="middle">${fmtDateShort(mocks[i].date)}</text>`;
  });
  svg += '</svg>';
  el.innerHTML = svg;
}

/* ================= VOCAB ================= */
let vocSeg = 'all';
document.getElementById('vocabForm').addEventListener('submit', e => {
  e.preventDefault();
  const word = document.getElementById('vocWord').value.trim();
  const meaning = document.getElementById('vocMeaning').value.trim();
  const sentence = document.getElementById('vocSentence').value.trim();
  if (!word || !meaning) { toast('Söz və məna daxil et', 'warn'); return; }
  state.vocab.unshift({ id: uid(), word, meaning, sentence, date: todayStr(), stage: 0 });
  save();
  e.target.reset();
  toast('Söz əlavə olundu ✓');
  renderVocab();
});
document.getElementById('btnQuickWord').addEventListener('click', () => {
  document.getElementById('view-vocab').scrollIntoView({ behavior: 'smooth' });
  document.getElementById('vocWord').focus();
});
function renderVocab() {
  document.querySelectorAll('#vocSeg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.seg === vocSeg));
  let list = state.vocab.slice();
  if (vocSeg !== 'all') list = list.filter(v => String(v.stage) === vocSeg);
  const el = document.getElementById('vocabList');
  if (!list.length) {
    el.innerHTML = '<div class="empty">Bu filtrdə söz yoxdur.</div>';
    return;
  }
  const stageNames = ['Yeni', 'Gün 1', 'Gün 3', 'Gün 7', 'Öyrənildi'];
  el.innerHTML = list.map(v => `
    <div class="vocab-card">
      <div class="vocab-word">${esc(v.word)} <span class="stage-badge stage-${v.stage}">${stageNames[v.stage]}</span></div>
      <div class="vocab-meaning">${esc(v.meaning)}</div>
      ${v.sentence ? `<div class="vocab-sent">“${esc(v.sentence)}”</div>` : ''}
      <div class="vocab-actions">
        <button class="stage-btn" data-adv="${v.id}" ${v.stage >= 4 ? 'disabled' : ''}>İrəli →</button>
        ${v.stage > 0 ? `<button class="stage-btn" data-rst="${v.id}">Yenidən</button>` : ''}
        <button class="stage-btn" data-rm="${v.id}" style="color:var(--red)">Sil</button>
      </div>
    </div>`).join('');
}
document.getElementById('vocabList').addEventListener('click', e => {
  const adv = e.target.closest('[data-adv]');
  if (adv) {
    const v = state.vocab.find(x => x.id === adv.dataset.adv);
    if (v && v.stage < 4) { v.stage++; save(); renderVocab(); toast('Mərhələ artırıldı'); }
    return;
  }
  const rst = e.target.closest('[data-rst]');
  if (rst) {
    const v = state.vocab.find(x => x.id === rst.dataset.rst);
    if (v) { v.stage = 0; save(); renderVocab(); toast('Yenidən başladıldı'); }
    return;
  }
  const rm = e.target.closest('[data-rm]');
  if (rm) {
    state.vocab = state.vocab.filter(x => x.id !== rm.dataset.rm);
    save(); renderVocab(); toast('Söz silindi');
  }
});
document.getElementById('vocSeg').addEventListener('click', e => {
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  vocSeg = btn.dataset.seg;
  renderVocab();
});

/* ================= SETTINGS / DATA ================= */
document.getElementById('btnSettings').addEventListener('click', () => {
  document.getElementById('setName').value = state.profile.name || '';
  document.getElementById('setModule').value = state.profile.module || 'Academic';
  document.getElementById('setTarget').value = String(state.profile.target);
  document.getElementById('setStart').value = state.profile.start || '';
  document.getElementById('setExam').value = state.profile.exam || '';
  document.getElementById('settingsModal').hidden = false;
});
document.getElementById('btnCloseSettings').addEventListener('click', () => { document.getElementById('settingsModal').hidden = true; });
document.getElementById('settingsModal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.hidden = true; });
document.getElementById('settingsForm').addEventListener('submit', e => {
  e.preventDefault();
  state.profile.name = document.getElementById('setName').value.trim() || 'Dostum';
  state.profile.module = document.getElementById('setModule').value;
  state.profile.target = Number(document.getElementById('setTarget').value);
  state.profile.start = document.getElementById('setStart').value;
  state.profile.exam = document.getElementById('setExam').value;
  save();
  document.getElementById('settingsModal').hidden = true;
  toast('Parametrlər saxlandı ✓');
  renderAll();
});
document.getElementById('btnReset').addEventListener('click', () => {
  if (confirm('Bütün məlumatlar silinəcək. Əminsən?')) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
});
document.getElementById('btnExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ielts-tracker-backup-' + todayStr() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Yedək faylı endirildi ✓');
});
const importInput = document.createElement('input');
importInput.type = 'file';
importInput.accept = '.json,application/json';
importInput.style.display = 'none';
document.body.appendChild(importInput);
importInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.profile || !Array.isArray(data.mistakes)) throw new Error('bad');
      state = Object.assign(defaultState(), data);
      save();
      toast('Məlumatlar idxal olundu ✓');
      renderAll();
    } catch (err) { toast('Fayl formatı düzgün deyil', 'err'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});
const btnImport = document.createElement('button');
btnImport.className = 'btn btn-ghost btn-sm';
btnImport.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></svg><span>İdxal et</span>';
btnImport.addEventListener('click', () => importInput.click());
document.querySelector('.sidebar-footer').insertBefore(btnImport, document.querySelector('.sidebar-footnote'));

/* ================= RENDER ALL ================= */
function renderBadges() {
  const nb = document.getElementById('navErrorBadge');
  nb.hidden = !state.mistakes.length;
  nb.textContent = state.mistakes.length;
  const vb = document.getElementById('navVocabBadge');
  const pending = state.vocab.filter(v => v.stage < 4).length;
  vb.hidden = !pending;
  vb.textContent = pending;
  const last = state.mocks[state.mocks.length - 1];
  document.getElementById('miniBand').textContent = last ? last.overall.toFixed(1) : '—';
  document.getElementById('miniTarget').textContent = state.profile.target.toFixed(1);
}
function renderAll() {
  renderDashboard();
  renderRoadmap();
  renderDaily();
  renderErrors();
  renderMocks();
  renderVocab();
  renderBadges();
}

/* ================= INIT ================= */
document.addEventListener('DOMContentLoaded', () => {
  populateErrCode();
  document.getElementById('mockDate').value = todayStr();
  renderAll();
});
