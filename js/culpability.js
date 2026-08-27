/**
 * culpability.js — The evidence engine.
 *
 * Turns a bare transaction (merchant, amount, timestamp) into a case:
 * a category, a culpability score from 0-100, and a list of exhibits the
 * prosecution may cite. Everything here is deterministic and offline —
 * the court can sit without an internet connection.
 */

import { CATEGORIES, MERCHANT_RULES } from './data.js';

/** Deterministic 32-bit hash, so a given case always draws the same jury. */
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, seedable PRNG for stable procedural text. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Longest-match merchant classification. "uber eats" must beat "uber". */
export function classify(merchant) {
  const needle = String(merchant || '').toLowerCase().trim();
  let best = null;
  for (const [pattern, category] of MERCHANT_RULES) {
    if (needle.includes(pattern) && (!best || pattern.length > best[0].length)) {
      best = [pattern, category];
    }
  }
  return best ? best[1] : 'misc';
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const money = (n) => '$' + Number(n).toFixed(2);

/**
 * Statutes. Each returns an exhibit `{ code, title, weight, detail }` or null.
 * Positive weight = aggravating, negative = mitigating. They are evaluated
 * against the full docket so the court can see patterns, not just points.
 */
const STATUTES = [
  function witchingHour(tx) {
    const h = tx.date.getHours();
    if (h >= 0 && h < 5) {
      return { code: '§1.1', title: 'COMMERCE DURING THE WITCHING HOUR', weight: 20,
        detail: `The transaction was executed at ${fmtTime(tx.date)}. No lawful, well-considered purchase has ever been made at this hour.` };
    }
    if (h >= 22) {
      return { code: '§1.2', title: 'LATE-NIGHT WEAKNESS', weight: 9,
        detail: `Executed at ${fmtTime(tx.date)}, well past the hour at which the defendant's judgment is known to expire.` };
    }
    return null;
  },

  function drinkingBeforeNoon(tx) {
    if ((tx.category === 'bar' || tx.category === 'alcohol') && tx.date.getHours() < 12) {
      return { code: '§2.4', title: 'PREMATURE REFRESHMENT', weight: 22,
        detail: `A ${CATEGORIES[tx.category].label.toLowerCase()} charge posted at ${fmtTime(tx.date)}. The court declines to speculate as to why.` };
    }
    return null;
  },

  function excess(tx) {
    const typical = CATEGORIES[tx.category].typical;
    const ratio = tx.amount / typical;
    if (ratio >= 2) {
      const weight = clamp(Math.round((ratio - 1) * 12), 8, 30);
      return { code: '§3.1', title: 'GROSSLY EXCESSIVE SUM', weight,
        detail: `${money(tx.amount)} against a reasonable-person baseline of ${money(typical)} for ${CATEGORIES[tx.category].label.toLowerCase()} — ${ratio.toFixed(1)}× what the situation required.` };
    }
    return null;
  },

  function recidivism(tx, docket) {
    const priors = docket.filter((o) =>
      o.id !== tx.id &&
      o.merchantKey === tx.merchantKey &&
      o.date < tx.date &&
      (tx.date - o.date) < 30 * 864e5
    );
    if (priors.length >= 1) {
      const spent = priors.reduce((s, o) => s + o.amount, 0) + tx.amount;
      return { code: '§4.2', title: `HABITUAL OFFENDER — ${priors.length + 1} COUNTS`, weight: clamp(priors.length * 8, 8, 30),
        detail: `The defendant has patronised ${tx.merchant} ${priors.length + 1} times in thirty days, totalling ${money(spent)}. This is not an incident. This is a lifestyle.` };
    }
    return null;
  },

  function spree(tx, docket) {
    const window = docket.filter((o) =>
      o.id !== tx.id && Math.abs(o.date - tx.date) < 90 * 60000
    );
    if (window.length >= 2) {
      const total = window.reduce((s, o) => s + o.amount, 0) + tx.amount;
      return { code: '§4.7', title: 'PART OF A COORDINATED SPREE', weight: 15,
        detail: `${window.length + 1} charges inside ninety minutes, totalling ${money(total)}. The court finds this was not a decision but a momentum.` };
    }
    return null;
  },

  function duplicate(tx, docket) {
    const sameDay = docket.filter((o) =>
      o.id !== tx.id && o.merchantKey === tx.merchantKey &&
      o.date.toDateString() === tx.date.toDateString()
    );
    if (sameDay.length) {
      return { code: '§4.9', title: 'SAME MERCHANT, SAME DAY', weight: 13,
        detail: `The defendant returned to ${tx.merchant} ${sameDay.length + 1} times within a single calendar day.` };
    }
    return null;
  },

  function charmPricing(tx) {
    const cents = Math.round((tx.amount % 1) * 100);
    if ((cents === 99 || cents === 95) && tx.amount > 10) {
      return { code: '§6.1', title: 'FELL FOR CHARM PRICING', weight: 5,
        detail: `The sum ends in .${String(cents).padStart(2, '0')}. The defendant was manipulated by an integer and did not notice.` };
    }
    return null;
  },

  function paydayEuphoria(tx) {
    const d = tx.date.getDate();
    if (d <= 2 || (d >= 15 && d <= 16)) {
      return { code: '§5.3', title: 'PAYDAY EUPHORIA', weight: 8,
        detail: `Charged on the ${ordinal(d)}, while the defendant was briefly and dangerously rich.` };
    }
    return null;
  },

  function necessity(tx) {
    const f = CATEGORIES[tx.category].frivolity;
    if (f <= 12) {
      return { code: '§9.1', title: 'NECESSITY OF LIFE', weight: -45,
        detail: `${CATEGORIES[tx.category].label} is a recognised necessity. The prosecution proceeds anyway, out of habit.` };
    }
    return null;
  },

  function modest(tx) {
    if (tx.amount <= 8) {
      return { code: '§9.4', title: 'DE MINIMIS', weight: -12,
        detail: `${money(tx.amount)}. The court has larger concerns.` };
    }
    return null;
  },

  function firstOffense(tx, docket) {
    const priors = docket.filter((o) => o.id !== tx.id && o.merchantKey === tx.merchantKey && o.date < tx.date);
    if (!priors.length) {
      return { code: '§9.7', title: 'NO PRIOR RECORD AT THIS ESTABLISHMENT', weight: -9,
        detail: `The defendant's first appearance at ${tx.merchant}. Everyone gets one.` };
    }
    return null;
  },

  function businessHours(tx) {
    const h = tx.date.getHours();
    const day = tx.date.getDay();
    if (h >= 9 && h <= 17 && day >= 1 && day <= 5) {
      return { code: '§9.9', title: 'DAYLIGHT TRANSACTION', weight: -6,
        detail: `Conducted at ${fmtTime(tx.date)} on a weekday, in full view of the defendant's own conscience.` };
    }
    return null;
  },
];

function fmtTime(d) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Build the full case file for one transaction, in the context of the docket.
 * Base culpability is the category's presumed frivolity; exhibits move it.
 */
export function buildCase(tx, docket) {
  const category = tx.category || classify(tx.merchant);
  const enriched = { ...tx, category };
  const meta = CATEGORIES[category];

  const exhibits = [];
  for (const statute of STATUTES) {
    const found = statute(enriched, docket);
    if (found) exhibits.push(found);
  }
  exhibits.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  const base = meta.frivolity;
  const swing = exhibits.reduce((s, e) => s + e.weight, 0);
  const culpability = clamp(Math.round(base + swing), 0, 100);

  return {
    ...enriched,
    categoryLabel: meta.label,
    baseCulpability: base,
    exhibits,
    culpability,
    seed: hashString(tx.id + tx.merchant + tx.amount),
  };
}

export { clamp, money, fmtTime };
