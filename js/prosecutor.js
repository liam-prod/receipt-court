/**
 * prosecutor.js — The District Attorney.
 *
 * A procedural argument engine. Given a case file it composes an indictment,
 * cross-examines the defendant's plea for classic bad excuses, and hands down
 * a verdict and sentence. Fully offline and deterministic (seeded per case),
 * so the courtroom always works even when the AI prosecutor is unavailable.
 */

import { seededRandom, clamp, money } from './culpability.js';

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];

const OPENERS = [
  'Your Honour, the facts are not in dispute.',
  'The prosecution will be brief, because the evidence is not complicated.',
  'Ladies and gentlemen of the jury, we have all been here before.',
  'Your Honour, I ask the court to note the defendant is not making eye contact.',
  'The State calls this exhibit what it is.',
];

const CLOSERS = [
  'The prosecution rests, exhausted.',
  'We ask the court to convict, and to do so briskly.',
  'The State seeks the maximum penalty the defendant will actually comply with.',
  'The prosecution rests. The defendant may now explain themselves.',
  'That is the case for the State. It took very little effort to assemble.',
];

/** The prosecution's opening statement, assembled from the exhibits on file. */
export function composeIndictment(caseFile) {
  const rng = seededRandom(caseFile.seed);
  const aggravating = caseFile.exhibits.filter((e) => e.weight > 0);
  const mitigating = caseFile.exhibits.filter((e) => e.weight < 0);

  const parts = [pick(rng, OPENERS)];
  parts.push(
    `On ${caseFile.date.toLocaleDateString([], { month: 'long', day: 'numeric' })}, the defendant surrendered ${money(caseFile.amount)} to ${caseFile.merchant} — a matter of ${caseFile.categoryLabel.toLowerCase()}.`
  );

  if (aggravating.length) {
    parts.push(`The State cites ${aggravating.length} aggravating ${aggravating.length === 1 ? 'circumstance' : 'circumstances'}.`);
    parts.push(aggravating[0].detail);
    if (aggravating[1]) parts.push(aggravating[1].detail);
  } else {
    parts.push('The State concedes it is reaching, but proceeds regardless.');
  }

  if (mitigating.length && caseFile.culpability < 50) {
    parts.push(`The defence will no doubt raise ${mitigating[0].title.toLowerCase()}. The State anticipates this and remains unmoved.`);
  }

  parts.push(pick(rng, CLOSERS));
  return parts.join(' ');
}

/**
 * Cross-examination patterns. Every excuse the defendant is about to type
 * has been heard by this court before, and most of them make things worse.
 */
const BAD_DEFENCES = [
  { test: /(on sale|discount|% off|percent off|deal|clearance|bogo|black friday)/i,
    title: 'THE BARGAIN DEFENCE', weight: 13,
    retort: 'A discount is not a reason to buy something. It is bait, and the defendant took it.' },
  { test: /(deserve|treat myself|treat my ?self|self.?care|earned it|worth it)/i,
    title: 'THE "I DESERVED IT" DEFENCE', weight: 16,
    retort: 'The court has never once been persuaded that anyone deserved anything. Desert is not a payment method.' },
  { test: /(everyone|friends were|peer|they all|group|didn.?t want to be rude)/i,
    title: 'THE PEER PRESSURE GAMBIT', weight: 11,
    retort: 'The defendant\'s friends are not on trial. The defendant\'s bank account is.' },
  { test: /(tired|long day|stress|exhaust|burn.?t? ?out|rough week|depress)/i,
    title: 'EMOTIONAL DURESS', weight: 9,
    retort: 'The court is sympathetic and entirely unmoved. Everyone is tired. Most of them cooked.' },
  { test: /(only|just|small|tiny|barely|a few (bucks|dollars))/i,
    title: 'MINIMISATION', weight: 7,
    retort: 'The word "only" is doing an enormous amount of unpaid labour in that sentence.' },
  { test: /(forgot|didn.?t realis|didn.?t realiz|auto.?renew|subscription renewed|slipped my mind)/i,
    title: 'WILFUL IGNORANCE', weight: 10,
    retort: 'Not noticing money leave is not a defence. It is the entire business model of the merchant.' },
  { test: /(invest|pay for itself|long run|save money|actually cheaper|in the end)/i,
    title: 'SPECULATIVE RETURN', weight: 12,
    retort: 'The court notes that nothing in the defendant\'s history has ever paid for itself.' },
  { test: /(cheaper than|less than|could have been worse|at least it wasn)/i,
    title: 'RELATIVE VIRTUE', weight: 8,
    retort: 'Comparing this purchase to a worse imaginary purchase is not a defence. It is set design.' },
  { test: /(one time|one.?off|won.?t happen again|last time|never again)/i,
    title: 'THE RECIDIVIST\'S PROMISE', weight: 10,
    retort: 'The court has this promise on file. Several times. In the defendant\'s own handwriting.' },
];

const GOOD_DEFENCES = [
  { test: /(broke|broken|replace|repair|stopped working|died|no longer works)/i,
    title: 'REPLACEMENT OF A FAILED NECESSITY', weight: -20,
    retort: 'The court accepts that objects fail and must be replaced.' },
  { test: /(for work|my job|client|business|contract|interview)/i,
    title: 'OCCUPATIONAL NECESSITY', weight: -18,
    retort: 'A charge incurred in pursuit of income is viewed favourably, if suspiciously.' },
  { test: /(medic|sick|doctor|prescri|health|injur|dentist|pharmac)/i,
    title: 'MEDICAL NECESSITY', weight: -26,
    retort: 'The court does not prosecute the body\'s demands.' },
  { test: /(gift|birthday|present|for (my|her|his|their) (mum|mom|dad|partner|friend|sister|brother))/i,
    title: 'ESTABLISHED ALTRUISM', weight: -19,
    retort: 'Generosity is a mitigating factor. The court reminds the defendant it is also a common cover story.' },
  { test: /(emergency|urgent|had to|no choice|stranded|locked out)/i,
    title: 'GENUINE EXIGENCY', weight: -16,
    retort: 'Necessity, if proven, is a complete defence.' },
  { test: /(no food|nothing to eat|empty fridge|hadn.?t eaten|groceries)/i,
    title: 'SUSTENANCE', weight: -14,
    retort: 'The court accepts that the defendant must eat. It questions the delivery fee.' },
  { test: /(budget|planned|saved for|set aside|sinking fund|allowance)/i,
    title: 'PREMEDITATED AND FUNDED', weight: -22,
    retort: 'A planned expense is not a crime. The court is almost disappointed.' },
];

/**
 * Cross-examine the plea. Returns the objections raised and how much the
 * defendant helped or (usually) hurt themselves.
 */
export function analyzePlea(text, caseFile) {
  const plea = String(text || '').trim();
  const objections = [];
  let delta = 0;

  if (!plea) {
    objections.push({ kind: 'bad', title: 'SILENCE', weight: 11,
      retort: 'The defendant offers nothing. The court draws the obvious inference.' });
    delta += 11;
    return { plea, objections, delta, cooperated: false };
  }

  if (/^\s*guilty\b/i.test(plea)) {
    objections.push({ kind: 'good', title: 'COOPERATION WITH THE COURT', weight: -14,
      retort: 'The defendant pleads guilty. The court appreciates not having to sit through this.' });
    return { plea, objections, delta: -14, cooperated: true };
  }

  for (const rule of BAD_DEFENCES) {
    if (rule.test.test(plea)) {
      objections.push({ kind: 'bad', ...rule });
      delta += rule.weight;
    }
  }
  for (const rule of GOOD_DEFENCES) {
    if (rule.test.test(plea)) {
      objections.push({ kind: 'good', ...rule });
      delta += rule.weight;
    }
  }

  // A long, specific plea with no red flags earns a small benefit of the doubt.
  if (plea.length > 110 && !objections.some((o) => o.kind === 'bad')) {
    objections.push({ kind: 'good', title: 'THE COURT NOTES THE DEFENDANT\'S EFFORT', weight: -8,
      retort: 'A detailed and self-aware account. Rare. Noted.' });
    delta -= 8;
  }
  // Shouting never helps.
  if (plea.length > 20 && plea === plea.toUpperCase()) {
    objections.push({ kind: 'bad', title: 'CONTEMPT OF COURT', weight: 12,
      retort: 'The defendant is shouting. The court can read.' });
    delta += 12;
  }

  return { plea, objections, delta, cooperated: false };
}

const VERDICT_BANDS = [
  { min: 72, verdict: 'GUILTY',                tone: 'guilty'   },
  { min: 48, verdict: 'GUILTY WITH LENIENCY',  tone: 'lenient'  },
  { min: 26, verdict: 'NOT GUILTY',            tone: 'acquit'   },
  { min: -1, verdict: 'CASE DISMISSED',        tone: 'dismiss'  },
];

const SENTENCE_TEMPLATES = {
  guilty: [
    (c, r) => `Restitution of ${money(r)} to be transferred to savings within 24 hours.`,
    (c) => `${Math.max(3, Math.round(c.culpability / 8))}-day prohibition on all ${c.categoryLabel.toLowerCase()}.`,
    (c) => `A ${Math.max(2, Math.round(c.amount / 18))}-meal term of home cooking, to be served consecutively.`,
    (c) => `The defendant shall delete the ${c.merchant} app and feel the absence.`,
  ],
  lenient: [
    (c, r) => `Restitution of ${money(r)} to savings. The court will not be checking, but it will know.`,
    (c) => `${Math.max(2, Math.round(c.culpability / 14))} days' probation from ${c.merchant}.`,
    () => 'The defendant is bound over to keep the peace with their own bank account.',
  ],
  acquit: [
    () => 'No penalty. The defendant is free to go, and looks surprised about it.',
    (c) => `The court records a warning: one more ${c.categoryLabel.toLowerCase()} charge this week and we revisit this.`,
  ],
  dismiss: [
    () => 'Case dismissed. The prosecution is admonished for wasting the court\'s time.',
    () => 'Dismissed with prejudice. This should never have been charged.',
  ],
};

const REMARKS = {
  guilty: [
    'The court finds the defendant knew exactly what they were doing, and did it anyway.',
    'This was not a lapse. This was a decision, made with a thumb.',
    'The defendant will now watch the money leave a second time, in their imagination.',
  ],
  lenient: [
    'The court finds fault, but recognises a human being under considerable pressure.',
    'Guilty, but the court has seen worse this week. In this same docket.',
  ],
  acquit: [
    'The State failed to meet its burden. Barely.',
    'The court finds this was, on balance, a reasonable thing for a person to do.',
  ],
  dismiss: [
    'There is no case here. Next.',
    'The court thanks the defendant for a rare moment of financial dignity.',
  ],
};

/** Final judgment: fold the plea into culpability, then sentence. */
export function deliverVerdict(caseFile, pleaResult) {
  const rng = seededRandom(caseFile.seed ^ 0x9e3779b9);
  const final = clamp(caseFile.culpability + pleaResult.delta, 0, 100);
  const band = VERDICT_BANDS.find((b) => final >= b.min);

  const severity = final / 100;
  let restitution = Math.round(caseFile.amount * (0.25 + severity * 0.75) * 100) / 100;
  if (pleaResult.cooperated) restitution = Math.round(restitution * 0.7 * 100) / 100;

  const templates = SENTENCE_TEMPLATES[band.tone];
  const sentence = [];
  const first = Math.floor(rng() * templates.length);
  sentence.push(templates[first](caseFile, restitution));
  if (band.tone === 'guilty') {
    const second = (first + 1 + Math.floor(rng() * (templates.length - 1))) % templates.length;
    sentence.push(templates[second](caseFile, restitution));
  }

  return {
    verdict: band.verdict,
    tone: band.tone,
    culpability: final,
    restitution: band.tone === 'guilty' || band.tone === 'lenient' ? restitution : 0,
    sentence,
    remark: pick(rng, REMARKS[band.tone]),
    convicted: band.tone === 'guilty' || band.tone === 'lenient',
  };
}
