/**
 * ai.js — The AI District Attorney (optional upgrade).
 *
 * The courtroom runs entirely on the procedural prosecutor by default. If the
 * defendant supplies Cursor API credentials, the prosecution is escalated to a
 * live model that argues from the same case file and the same exhibits.
 *
 * Credentials live only in this browser's localStorage. Nothing is committed,
 * and any failure silently falls back to the offline prosecutor so the core
 * loop can never break mid-trial.
 */

const STORE_KEY = 'receipt-court:ai-config';

export const DEFAULT_CONFIG = {
  // Cursor's API sends no CORS headers, so the browser talks to the local
  // proxy in scripts/da-proxy.py, which forwards to api.cursor.com.
  baseUrl: 'http://localhost:8788',
  apiKey: '',
  model: 'gemini-3.7-flash',
  transport: 'cursor-agent',
  enabled: false,
};

export function loadConfig() {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(cfg) {
  localStorage.setItem(STORE_KEY, JSON.stringify(cfg));
}

export function isLive() {
  const c = loadConfig();
  return Boolean(c.enabled && c.apiKey && c.baseUrl);
}

const SYSTEM_PROMPT = `You are the District Attorney in RECEIPT COURT, a criminal court that prosecutes personal purchases. You are theatrical, withering, and very funny, in the register of a jaded prosecutor who has seen this exact purchase a thousand times. You are never cruel about the defendant's worth as a person — only about the purchase.

Rules:
- Address the court ("Your Honour"), refer to the buyer as "the defendant".
- Argue ONLY from the exhibits you are given. Cite them specifically: times, amounts, prior counts.
- 3 to 5 sentences. No preamble, no markdown, no quotation marks around the whole thing.
- Dry understatement beats insults. The funniest line should be the most factual one.`;

/** Build the case brief handed to the model. */
function brief(caseFile) {
  const exhibits = caseFile.exhibits
    .map((e) => `- ${e.code} ${e.title} (${e.weight > 0 ? 'aggravating' : 'mitigating'}): ${e.detail}`)
    .join('\n');
  return `CASE FILE
Merchant: ${caseFile.merchant}
Amount: $${caseFile.amount.toFixed(2)}
Category: ${caseFile.categoryLabel}
Timestamp: ${caseFile.date.toString()}
Culpability score: ${caseFile.culpability}/100

EXHIBITS ON FILE:
${exhibits || '- None. The State is reaching.'}

Deliver the prosecution's opening statement.`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Flatten a chat-style message list into one prompt for the agent API. */
function flatten(messages) {
  return messages.map((m) => (m.role === 'system' ? m.content : m.content)).join('\n\n');
}

/** Dig a text answer out of whatever shape the endpoint hands back. */
function extractText(data) {
  const direct =
    data?.choices?.[0]?.message?.content ??
    data?.content?.[0]?.text ??
    data?.text ??
    data?.result ??
    data?.output;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  // Agent conversations arrive as a message list; take the last assistant turn.
  const messages = data?.messages || data?.conversation || [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const role = m.role || m.type || '';
    if (/user|human/i.test(role)) continue;
    const text = m.text ?? m.content ?? m.message;
    if (typeof text === 'string' && text.trim()) return text.trim();
  }
  return '';
}

async function api(path, { method = 'GET', body } = {}) {
  const cfg = loadConfig();
  const res = await fetch(cfg.baseUrl.replace(/\/+$/, '') + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`);
  return data;
}

/**
 * Cursor's background-composer transport.
 *
 * Three quirks of this API shape the implementation:
 *   1. POST /v1/agents creates the agent but never sends a response — the
 *      connection just hangs. So we fire it, abort, and identify the agent we
 *      just created by diffing the agent list before and after.
 *   2. Status and conversation live under /v0, while creation and listing
 *      live under /v1.
 *   3. A run takes ~10-20s, so the caller always renders the procedural
 *      argument first and swaps this in when it lands.
 */
async function listAgentIds() {
  const data = await api('/v1/agents');
  return (data?.items || []).map((a) => a.id).filter(Boolean);
}

async function cursorAgent(messages, { timeoutMs = 120000, onProgress } = {}) {
  const cfg = loadConfig();
  const before = new Set(await listAgentIds());

  // Fire and abort: this endpoint creates the agent but never replies.
  const controller = new AbortController();
  const launch = fetch(cfg.baseUrl.replace(/\/+$/, '') + '/v1/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ prompt: { text: flatten(messages) }, model: { id: cfg.model } }),
    signal: controller.signal,
  }).catch(() => null);
  setTimeout(() => controller.abort(), 4000);

  // Identify the agent that appeared as a result of that call.
  const started = Date.now();
  let id = null;
  while (!id && Date.now() - started < 45000) {
    await sleep(1500);
    onProgress?.(Math.round((Date.now() - started) / 1000));
    let ids;
    try { ids = await listAgentIds(); } catch { continue; }
    id = ids.find((x) => !before.has(x)) || null;
  }
  await launch;
  if (!id) throw new Error('Agent was never created');

  // Poll to completion, then read the transcript.
  let delay = 1500;
  while (Date.now() - started < timeoutMs) {
    onProgress?.(Math.round((Date.now() - started) / 1000));
    const status = await api(`/v0/agents/${id}`);
    const state = String(status?.status || '').toUpperCase();
    if (/ERROR|FAIL|CANCEL|EXPIRED/.test(state)) throw new Error(`Agent ${state.toLowerCase()}`);
    if (/FINISH|COMPLETE|IDLE|DONE/.test(state)) {
      const convo = await api(`/v0/agents/${id}/conversation`);
      const text = extractText(convo);
      if (text) return text;
      throw new Error('Agent finished but said nothing');
    }
    await sleep(delay);
    delay = Math.min(delay * 1.2, 4000);
  }
  throw new Error('Agent timed out');
}

async function chat(messages, { maxTokens = 400 } = {}) {
  const cfg = loadConfig();
  const url = cfg.baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Prosecution unavailable (${res.status})`);
  const data = await res.json();
  const text =
    data?.choices?.[0]?.message?.content ??
    data?.content?.[0]?.text ??
    '';
  if (!text.trim()) throw new Error('Prosecution returned nothing');
  return text.trim();
}

/** Route to whichever transport the defendant has configured. */
function ask(messages, opts = {}) {
  return loadConfig().transport === 'chat' ? chat(messages, opts) : cursorAgent(messages, opts);
}

/** Live indictment. Throws on any failure — callers fall back to procedural. */
export function aiIndictment(caseFile, opts) {
  return ask([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: brief(caseFile) },
  ], opts);
}

/** Live cross-examination of the defendant's plea. */
export function aiCrossExamine(caseFile, plea, objections) {
  const raised = objections.map((o) => `- ${o.title}: ${o.retort}`).join('\n') || '- None detected.';
  return chat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${brief(caseFile)}

THE DEFENDANT'S PLEA:
"${plea}"

PATTERNS THE COURT'S ANALYSER FLAGGED:
${raised}

Deliver a 2-3 sentence cross-examination that dismantles this specific plea. Quote the defendant's own words back at them at least once.` },
  ], { maxTokens: 300, ...opts });
}

/** One-line connectivity check for the settings panel. */
export async function testConnection(onProgress) {
  return ask([{ role: 'user', content: 'Reply with exactly: COURT IS IN SESSION' }],
    { maxTokens: 32, onProgress });
}
