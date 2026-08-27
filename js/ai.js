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
  baseUrl: 'https://api.cursor.com/v0',
  apiKey: '',
  model: 'claude-4.5-sonnet',
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

/** Live indictment. Throws on any failure — callers fall back to procedural. */
export function aiIndictment(caseFile) {
  return chat([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: brief(caseFile) },
  ]);
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
  ], { maxTokens: 300 });
}

/** One-line connectivity check for the settings panel. */
export async function testConnection() {
  const text = await chat(
    [{ role: 'user', content: 'Reply with exactly: COURT IS IN SESSION' }],
    { maxTokens: 32 }
  );
  return text;
}
