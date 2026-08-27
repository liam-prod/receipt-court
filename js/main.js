/**
 * main.js — Clerk of the court.
 *
 * Owns the docket, drives the trial state machine, and renders the courtroom.
 * Trial flow:  file charge → build case → indictment → plea → cross → verdict.
 */

import { DEMO_DOCKET } from './data.js';
import { buildCase, classify, money } from './culpability.js';
import { composeIndictment, analyzePlea, deliverVerdict } from './prosecutor.js';
import * as AI from './ai.js';
import { parseStatement } from './import.js';
import { renderRecord as renderCriminalRecord } from './record.js';
import { generatePlea, counselName } from './defender.js';
import { splash } from './splash.js';
import confetti from 'canvas-confetti';
import { gsap } from 'gsap';

const STORE_KEY = 'receipt-court:docket';
const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ state */

let state = { cases: [], activeId: null, trial: null };

function persist() {
  localStorage.setItem(STORE_KEY, JSON.stringify({
    cases: state.cases.map((c) => ({ ...c, date: c.date.toISOString() })),
  }));
}

function restore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    state.cases = (raw.cases || []).map((c) => ({ ...c, date: new Date(c.date) }));
  } catch { state.cases = []; }
}

let idSeq = 0;
const newId = () => `c${Date.now().toString(36)}${(idSeq++).toString(36)}`;

function fileCharge(merchant, amount, date = new Date()) {
  const record = {
    id: newId(),
    merchant: merchant.trim(),
    merchantKey: merchant.trim().toLowerCase(),
    amount: Number(amount),
    date,
    category: classify(merchant),
    resolved: null,           // { verdict, tone, restitution, culpability }
  };
  state.cases.unshift(record);
  persist();
  return record;
}

/* ----------------------------------------------------------------- audio */
/* A gavel, synthesised. No assets, no network, no licensing. */
let audioCtx = null;
function gavel(strength = 1) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;

    // Wooden knock: fast-decaying low sine with a pitch drop.
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220 * strength, t);
    osc.frequency.exponentialRampToValueAtTime(58, t + 0.13);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t); osc.stop(t + 0.3);

    // Transient crack: a short burst of filtered noise.
    const len = Math.floor(audioCtx.sampleRate * 0.05);
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = audioCtx.createBufferSource();
    const bp = audioCtx.createBiquadFilter();
    const ng = audioCtx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 0.8;
    ng.gain.value = 0.5;
    src.buffer = buf;
    src.connect(bp).connect(ng).connect(audioCtx.destination);
    src.start(t);
  } catch { /* the court proceeds in silence */ }
}

/* --------------------------------------------------------------- prefetch */
/**
 * Cursor's agent API spends most of its latency spinning up, not generating,
 * so the indictment for the next pending case is launched while the defendant
 * is still reading the current one. By the time they hit "Next Case" the
 * prosecution has usually already written its opening.
 */
const indictmentCache = new Map();

function warmIndictment(rec) {
  if (!rec || !AI.isLive() || indictmentCache.has(rec.id)) return;
  const caseFile = buildCase(rec, state.cases);
  indictmentCache.set(rec.id, AI.aiIndictment(caseFile).catch(() => null));
}

/** The next charge the defendant is going to face after this one. */
function nextPending(afterId) {
  const pending = state.cases.filter((c) => !c.resolved);
  const idx = pending.findIndex((c) => c.id === afterId);
  return idx === -1 ? pending[0] : pending[idx + 1];
}

/* ---------------------------------------------------------------- render */

function caseNumber(rec) {
  const y = rec.date.getFullYear();
  const n = (parseInt(rec.id.slice(-4), 36) % 9000) + 1000;
  return `CASE No. ${y}-CR-${n}`;
}

function renderRecord() {
  const settled = state.cases.filter((c) => c.resolved);
  const convictions = settled.filter((c) => c.resolved.convicted);
  const owed = convictions.reduce((s, c) => s + c.resolved.restitution, 0);
  $('stat-convictions').textContent = convictions.length;
  $('stat-restitution').textContent = money(owed).replace(/\.00$/, '');
  $('stat-rate').textContent = settled.length
    ? Math.round((convictions.length / settled.length) * 100) + '%'
    : '—';

  const tally = {};
  for (const c of convictions) {
    tally[c.merchant] = tally[c.merchant] || { n: 0, total: 0 };
    tally[c.merchant].n++;
    tally[c.merchant].total += c.amount;
  }
  const top = Object.entries(tally).sort((a, b) => b[1].total - a[1].total).slice(0, 4);
  $('most-wanted-list').innerHTML = top.length
    ? top.map(([m, v]) =>
        `<li><span class="mw-name">${esc(m)}</span> — ${v.n} count${v.n > 1 ? 's' : ''}, ${money(v.total)}</li>`).join('')
    : '<li class="empty">No convictions on file.</li>';
}

function renderDocket() {
  const list = $('docket-list');
  const pending = state.cases.filter((c) => !c.resolved).length;
  $('docket-count').textContent = pending;

  list.innerHTML = state.cases.map((c) => {
    const tag = c.resolved
      ? `<span class="di-tag ${c.resolved.convicted ? 'guilty' : 'acquit'}">${c.resolved.convicted ? 'Convicted' : 'Acquitted'}</span>`
      : '';
    return `<li class="docket-item ${c.id === state.activeId ? 'active' : ''} ${c.resolved ? 'settled' : ''}" data-id="${c.id}">
      <div class="di-main">
        <div class="di-merchant">${esc(c.merchant)} ${tag}</div>
        <div class="di-meta">${c.date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${c.date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
      </div>
      <div class="di-amount">${money(c.amount)}</div>
    </li>`;
  }).join('');

  list.querySelectorAll('.docket-item').forEach((el) =>
    el.addEventListener('click', () => openCase(el.dataset.id)));
  renderRecord();
  renderCriminalRecord(state.cases);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (m) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

function setMeter(v) {
  $('meter-fill').style.width = v + '%';
  $('meter-value').textContent = v;
}

/* ----------------------------------------------------------------- trial */

async function openCase(id) {
  const rec = state.cases.find((c) => c.id === id);
  if (!rec) return;
  state.activeId = id;

  const docket = state.cases;
  const caseFile = buildCase(rec, docket);
  state.trial = { caseFile, phase: 'indictment' };

  $('court-empty').hidden = true;
  $('court-case').hidden = false;
  $('case-no').textContent = caseNumber(rec);
  $('case-title').innerHTML = `Your Future Self <em>v.</em> ${esc(rec.merchant)}`;
  $('case-sub').textContent =
    `${money(rec.amount)} · ${caseFile.categoryLabel} · ${rec.date.toLocaleString([], { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;

  setMeter(caseFile.culpability);

  $('exhibit-list').innerHTML = caseFile.exhibits.length
    ? caseFile.exhibits.map((e) => `
      <li class="exhibit ${e.weight < 0 ? 'mitigating' : ''}">
        <span class="ex-code">${e.code}</span>
        <span><span class="ex-title">${esc(e.title)}</span><span class="ex-detail">${esc(e.detail)}</span></span>
        <span class="ex-weight">${e.weight > 0 ? '+' : ''}${e.weight}</span>
      </li>`).join('')
    : '<li class="exhibit mitigating"><span class="ex-code">—</span><span><span class="ex-detail">No exhibits. The State proceeds on vibes alone.</span></span><span class="ex-weight">0</span></li>';

  // Reset downstream phases.
  $('phase-cross').hidden = true;
  $('phase-verdict').hidden = true;
  $('phase-defence').hidden = false;
  $('cross-text').hidden = true;
  $('plea-input').value = '';
  $('plea-input').disabled = false;
  $('counsel-credit').hidden = true;
  ['btn-plead', 'btn-fifth', 'btn-guilty'].forEach((b) => { $(b).disabled = false; });

  // Indictment: procedural first so something is always on screen, then upgrade.
  const offline = composeIndictment(caseFile);
  $('prosecution-text').textContent = offline;
  $('prosecution-text').classList.remove('ai');
  $('prosecution-src').textContent = 'PROCEDURAL';

  if (AI.isLive()) {
    const warmed = indictmentCache.get(id);
    $('prosecution-src').textContent = warmed
      ? 'AI PROSECUTOR — ARRIVING…'
      : 'AI PROSECUTOR — PREPARING…';
    try {
      const live = warmed
        ? await warmed
        : await AI.aiIndictment(caseFile, {
            onProgress: (secs) => {
              if (state.activeId === id) {
                $('prosecution-src').textContent = `AI PROSECUTOR — PREPARING… ${secs}s`;
              }
            },
          });
      if (!live) throw new Error('no indictment');
      if (state.activeId === id) {
        $('prosecution-text').textContent = live;
        $('prosecution-text').classList.add('ai');
        $('prosecution-src').textContent = 'AI PROSECUTOR';
      }
    } catch {
      if (state.activeId === id) $('prosecution-src').textContent = 'PROCEDURAL (AI UNAVAILABLE)';
    }
  }

  renderDocket();
  warmIndictment(nextPending(id));
  $('court-case').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function enterPlea(text) {
  const trial = state.trial;
  if (!trial || trial.phase === 'verdict') return;
  const { caseFile } = trial;

  const result = analyzePlea(text, caseFile);
  trial.phase = 'verdict';

  $('plea-input').disabled = true;
  ['btn-plead', 'btn-fifth', 'btn-guilty'].forEach((b) => { $(b).disabled = true; });

  // The prosecution leaps to its feet before the objections are read out.
  if (result.objections.some((o) => o.kind === 'bad')) {
    await splash('Objection!', 'objection');
  }

  $('phase-cross').hidden = false;
  $('objection-list').innerHTML = result.objections.length
    ? result.objections.map((o) => `
      <li class="objection ${o.kind === 'good' ? 'good' : ''}">
        <div class="obj-head"><span>${o.kind === 'good' ? 'The court accepts' : 'Objection'} — ${esc(o.title)}</span>
          <span>${o.weight > 0 ? '+' : ''}${o.weight}</span></div>
        <div class="obj-retort">${esc(o.retort)}</div>
      </li>`).join('')
    : '<li class="objection good"><div class="obj-head"><span>No objection</span><span>0</span></div><div class="obj-retort">The prosecution has nothing to add. It is as surprised as you are.</div></li>';

  const judgment = deliverVerdict(caseFile, result);
  setMeter(judgment.culpability);

  if (AI.isLive() && result.plea) {
    const box = $('cross-text');
    box.hidden = false;
    box.classList.add('thinking');
    box.textContent = 'The prosecution rises…';
    try {
      const live = await AI.aiCrossExamine(caseFile, result.plea, result.objections, {
        onProgress: (secs) => { box.textContent = `The prosecution rises… (${secs}s)`; },
      });
      box.classList.remove('thinking');
      box.textContent = live;
    } catch {
      box.hidden = true;
    }
  }

  // Verdict.
  const SPLASH_WORD = { guilty: 'Guilty!', lenient: 'Guilty!', acquit: 'Not Guilty!', dismiss: 'Dismissed!' };
  await splash(SPLASH_WORD[judgment.tone] || judgment.verdict,
    judgment.convicted ? 'guilty' : 'acquit');

  $('phase-verdict').hidden = false;
  const stamp = $('verdict-stamp');
  stamp.textContent = judgment.verdict;
  stamp.className = 'stamp' + (judgment.convicted ? '' : ' acquit') + (judgment.verdict.length > 8 ? ' small' : '');
  $('sentence-list').innerHTML = judgment.sentence.map((s) => `<li>${esc(s)}</li>`).join('');
  $('verdict-remark').textContent = judgment.remark;

  requestAnimationFrame(() => {
    stamp.classList.add('slam');
    $('verdict-card').classList.add('shake');
    gavel(judgment.convicted ? 1 : 0.75);
    setTimeout(() => $('verdict-card').classList.remove('shake'), 500);

    // Sentence terms drop in one at a time, like they're being read aloud.
    gsap.from('#sentence-list li', {
      opacity: 0, y: 14, duration: 0.42, stagger: 0.13, delay: 0.28, ease: 'power2.out',
    });
    gsap.from('#verdict-remark', { opacity: 0, duration: 0.5, delay: 0.7 });

    // Acquittal is rare enough to deserve a celebration.
    if (!judgment.convicted) {
      confetti({ particleCount: 90, spread: 72, origin: { y: 0.62 },
        colors: ['#c8a24a', '#efe3cc', '#4f9464'], disableForReducedMotion: true });
    }
  });

  const rec = state.cases.find((c) => c.id === state.activeId);
  if (rec) {
    rec.resolved = {
      verdict: judgment.verdict, tone: judgment.tone, convicted: judgment.convicted,
      restitution: judgment.restitution, culpability: judgment.culpability,
    };
    persist();
  }
  renderDocket();
  $('phase-verdict').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function nextCase() {
  const next = state.cases.find((c) => !c.resolved);
  if (next) return openCase(next.id);
  $('court-case').hidden = true;
  $('court-empty').hidden = false;
  $('court-empty').querySelector('h2').textContent = 'The docket is clear.';
  $('court-empty').querySelector('p').textContent =
    'Every charge has been tried. The court will now adjourn until you open a delivery app.';
  state.activeId = null;
  renderDocket();
}

/* -------------------------------------------------------------- controls */

$('charge-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const merchant = $('in-merchant').value.trim();
  const amount = parseFloat($('in-amount').value);
  if (!merchant || !(amount > 0)) return;
  const whenRaw = $('in-when').value;
  const rec = fileCharge(merchant, amount, whenRaw ? new Date(whenRaw) : new Date());
  $('in-merchant').value = ''; $('in-amount').value = ''; $('in-when').value = '';
  renderDocket();
  openCase(rec.id);
});

$('btn-demo').addEventListener('click', () => {
  // Seeded oldest-first so that after unshifting, the most recent (and most
  // incriminating) charge sits at the top of the docket.
  const now = Date.now();
  for (const d of [...DEMO_DOCKET].reverse()) {
    fileCharge(d.merchant, d.amount, new Date(now - d.hoursAgo * 3600 * 1000));
  }
  renderDocket();
  const first = state.cases.find((c) => !c.resolved);
  if (first) openCase(first.id);
});

$('btn-purge').addEventListener('click', () => {
  if (!confirm('Expunge the entire record? Every conviction is forgotten. You will do it all again.')) return;
  state = { cases: [], activeId: null, trial: null };
  persist();
  $('court-case').hidden = true;
  $('court-empty').hidden = false;
  renderDocket();
});

$('in-csv').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  const status = $('import-status');
  if (!file) return;
  status.className = 'import-status';
  status.textContent = 'Reading statement…';
  try {
    const { charges, skipped, columns, error } = parseStatement(await file.text());
    if (error || !charges.length) {
      status.className = 'import-status err';
      status.textContent = error || 'No chargeable transactions found.';
      return;
    }
    for (const c of charges) fileCharge(c.merchant, c.amount, c.date);
    status.className = 'import-status ok';
    status.textContent = `${charges.length} charges filed from "${columns.descCol}" / "${columns.amountCol}". ${skipped} rows dismissed as income.`;
    renderDocket();
    const first = state.cases.find((c) => !c.resolved);
    if (first) openCase(first.id);
  } catch (err) {
    status.className = 'import-status err';
    status.textContent = 'Could not read that file: ' + err.message;
  } finally {
    e.target.value = '';
  }
});

/**
 * Mass sentencing. The defendant waives their right to plead on every
 * outstanding charge, and the court disposes of the docket at speed.
 */
$('btn-tryall').addEventListener('click', async () => {
  const pending = state.cases.filter((c) => !c.resolved);
  if (!pending.length) return alert('The docket is already clear.');
  if (!confirm(`Mass sentencing waives your right to plead on ${pending.length} outstanding ${pending.length === 1 ? 'charge' : 'charges'}. The court will rule on the evidence alone. Proceed?`)) return;

  const btn = $('btn-tryall');
  btn.disabled = true;
  const flash = document.createElement('div');
  flash.className = 'gavel-flash';
  document.body.appendChild(flash);

  for (let i = 0; i < pending.length; i++) {
    const rec = pending[i];
    const caseFile = buildCase(rec, state.cases);
    const judgment = deliverVerdict(caseFile, analyzePlea('', caseFile));
    rec.resolved = {
      verdict: judgment.verdict, tone: judgment.tone, convicted: judgment.convicted,
      restitution: judgment.restitution, culpability: judgment.culpability,
    };
    btn.textContent = `Sentencing ${i + 1}/${pending.length}…`;
    gavel(judgment.convicted ? 0.9 : 0.7);
    gsap.fromTo(flash, { opacity: judgment.convicted ? 0.75 : 0.3 }, { opacity: 0, duration: 0.28 });
    renderDocket();
    await new Promise((r) => setTimeout(r, 150));
  }

  flash.remove();
  btn.disabled = false;
  btn.textContent = 'Mass Sentencing';
  persist();
  $('court-case').hidden = true;
  $('court-empty').hidden = false;
  $('court-empty').querySelector('h2').textContent = 'The docket is clear.';
  $('court-empty').querySelector('p').textContent = 'All outstanding charges disposed of. See the record below.';
  state.activeId = null;
  renderDocket();
  $('record-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

/**
 * Appoint counsel. State-funded, overworked, and typing in real time so the
 * defendant has to watch their own defence being assembled badly.
 */
$('btn-defender').addEventListener('click', async () => {
  const trial = state.trial;
  if (!trial || trial.phase === 'verdict') return;

  const btn = $('btn-defender');
  const input = $('plea-input');
  const credit = $('counsel-credit');
  btn.disabled = true;

  credit.hidden = false;
  credit.textContent = `Counsel appointed: ${counselName(trial.caseFile)}, Office of the Public Defender. Reviewing the file…`;
  await new Promise((r) => setTimeout(r, 700));

  const plea = generatePlea(trial.caseFile);
  credit.textContent = `Counsel appointed: ${counselName(trial.caseFile)}, Office of the Public Defender.`;

  // Typed out rather than pasted — watching it appear is most of the joke.
  input.value = '';
  for (let i = 0; i < plea.length; i++) {
    input.value = plea.slice(0, i + 1);
    input.scrollTop = input.scrollHeight;
    if (plea[i] !== ' ') await new Promise((r) => setTimeout(r, 11));
  }

  await new Promise((r) => setTimeout(r, 550));
  btn.disabled = false;
  enterPlea(input.value);
});

$('btn-plead').addEventListener('click', () => enterPlea($('plea-input').value));
$('btn-fifth').addEventListener('click', () => enterPlea(''));
$('btn-guilty').addEventListener('click', () => enterPlea('Guilty, your honour.'));
$('btn-next').addEventListener('click', nextCase);
$('plea-input').addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') enterPlea($('plea-input').value);
});

/* ------------------------------------------------------------ AI settings */

function syncAiDot() {
  $('ai-dot').classList.toggle('live', AI.isLive());
}
$('btn-ai').addEventListener('click', () => {
  const cfg = AI.loadConfig();
  $('cfg-base').value = cfg.baseUrl;
  $('cfg-key').value = cfg.apiKey;
  $('cfg-model').value = cfg.model;
  $('cfg-transport').value = cfg.transport || 'cursor-agent';
  $('cfg-enabled').checked = cfg.enabled;
  $('cfg-status').textContent = ''; $('cfg-status').className = 'cfg-status';
  $('ai-modal').hidden = false;
});
$('cfg-close').addEventListener('click', () => { $('ai-modal').hidden = true; });
$('ai-modal').addEventListener('click', (e) => {
  if (e.target === $('ai-modal')) $('ai-modal').hidden = true;
});
function readCfg() {
  return {
    baseUrl: $('cfg-base').value.trim() || AI.DEFAULT_CONFIG.baseUrl,
    apiKey: $('cfg-key').value.trim(),
    model: $('cfg-model').value.trim() || AI.DEFAULT_CONFIG.model,
    transport: $('cfg-transport').value,
    enabled: $('cfg-enabled').checked,
  };
}
$('cfg-save').addEventListener('click', () => {
  AI.saveConfig(readCfg());
  syncAiDot();
  AI.warmAgent();
  $('ai-modal').hidden = true;
});
$('cfg-test').addEventListener('click', async () => {
  AI.saveConfig({ ...readCfg(), enabled: true });
  const s = $('cfg-status');
  s.className = 'cfg-status'; s.textContent = 'Approaching the bench…';
  try {
    const reply = await AI.testConnection((secs) => {
      s.textContent = `Agent working… ${secs}s`;
    });
    s.className = 'cfg-status ok';
    s.textContent = '✓ ' + reply.slice(0, 60);
    $('cfg-enabled').checked = true;
  } catch (err) {
    s.className = 'cfg-status err';
    s.textContent = '✗ ' + err.message;
  }
  syncAiDot();
});

/* -------------------------------------------------------------- start-up */
restore();

// ?demo=1 seeds the docket on load, so a shared link opens mid-trial rather
// than on an empty courtroom.
if (new URLSearchParams(location.search).get('demo') === '1' && !state.cases.length) {
  const now = Date.now();
  for (const d of [...DEMO_DOCKET].reverse()) fileCharge(d.merchant, d.amount, new Date(now - d.hoursAgo * 36e5));
}

renderDocket();
syncAiDot();
if (state.cases.length) {
  const open = state.cases.find((c) => !c.resolved) || state.cases[0];
  openCase(open.id);
}
