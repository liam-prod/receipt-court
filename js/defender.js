/**
 * defender.js — The Office of the Public Defender.
 *
 * For defendants who cannot be bothered to mount their own defence, the court
 * appoints counsel. Counsel is free, overworked, and has read the file once, in
 * the lift, on the way in.
 *
 * The pleas it produces are deliberately mediocre: they lean on exactly the
 * excuses prosecutor.js is built to demolish, so appointing a public defender
 * usually makes things worse. On a genuine necessity, however, counsel manages
 * to say the right thing, mostly by accident.
 */

import { seededRandom } from './culpability.js';
import { CATEGORIES } from './data.js';

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];

/** Counsel introducing themselves, with varying degrees of preparation. */
const PREAMBLES = [
  'Your Honour, my client would like it noted that',
  'Your Honour, if I may — my client maintains that',
  'Your Honour. Sorry. Yes. My client\'s position is that',
  'The defence submits that',
  'Your Honour, I\'ve only just received this file, but my client tells me',
];

/** The bad excuses, which trip the prosecution's objection patterns on purpose. */
const EXCUSES_BY_CATEGORY = {
  food_delivery: [
    'there was no food in the house and it had been a long day',
    'the delivery fee was on sale, effectively, and everyone else was ordering too',
    'cooking would have taken longer, so in the long run this actually saved money',
  ],
  coffee: [
    'it was only a few dollars and they had earned it',
    'they were tired and it is cheaper than a proper breakfast',
  ],
  fast_food: [
    'it was late, they were exhausted, and they deserved it',
    'it was only a small amount and the alternative was nothing',
  ],
  gaming: [
    'it was 60% off and will pay for itself in hours of entertainment',
    'everyone in their group had already bought it',
  ],
  impulse_retail: [
    'it was on sale, and they had been meaning to buy one anyway',
    'they only bought it because it was such a good deal',
  ],
  fashion: [
    'they had a long week and deserved to treat themselves',
    'it was heavily discounted and will last for years, so it is an investment',
  ],
  bar: [
    'their friends were all there and they did not want to be rude',
    'it had been a genuinely rough week',
  ],
  alcohol: ['it was on sale and buying two was cheaper than buying one'],
  rideshare: ['it was late and walking was not realistic'],
  subscriptions: [
    'they forgot it was going to auto-renew',
    'they did not realise they were still being charged',
  ],
  streaming: ['they forgot to cancel it after the free trial'],
  gambling: ['this was a one-time thing and will not happen again'],
  crypto: ['it is a long-term investment that will pay for itself'],
  electronics: ['the old one was slow and this will pay for itself in productivity'],
  gadgets: ['it was on sale and they had been meaning to get one'],
  beauty: ['they had a long week and deserved a bit of self-care'],
  home_decor: ['it was on sale and the room genuinely needed it'],
  vending: ['it was only a couple of dollars'],
  convenience: ['they only went in for one thing'],
};

/** When the charge is genuinely defensible, counsel briefly does their job. */
const GOOD_EXCUSES = [
  'this was a medical necessity and not discretionary in any sense',
  'the previous one broke and had to be replaced',
  'this expense was budgeted for and set aside in advance',
  'this was required for my client\'s work',
];

const GENERIC_EXCUSES = [
  'it was on sale',
  'they had had a long day',
  'it was only a small amount in the scheme of things',
  'this was a one-time thing that will not happen again',
];

/** Counsel signing off, having done the absolute minimum. */
const FLOURISHES = [
  'The defence rests.',
  'That is all my client has instructed me to say.',
  'I would ask the court to take that into account.',
  'My client is nodding.',
  'I have not had a chance to review the exhibits, but I stand by that.',
  'We would ask for leniency on that basis.',
];

/**
 * Compose a plea on the defendant's behalf. Seeded from the case so the same
 * charge always draws the same (equally unhelpful) counsel.
 */
export function generatePlea(caseFile) {
  const rng = seededRandom(caseFile.seed ^ 0x5bf03635);
  const frivolity = CATEGORIES[caseFile.category]?.frivolity ?? 42;

  const preamble = pick(rng, PREAMBLES);
  const parts = [];

  // On a true necessity, counsel stumbles into the correct argument.
  if (frivolity <= 12) {
    parts.push(pick(rng, GOOD_EXCUSES));
  } else {
    const pool = EXCUSES_BY_CATEGORY[caseFile.category] || GENERIC_EXCUSES;
    parts.push(pick(rng, pool));
    // Expensive charges get a second, worse excuse piled on top.
    if (caseFile.amount > 60 && rng() > 0.35) {
      const extra = pick(rng, GENERIC_EXCUSES);
      if (extra !== parts[0]) parts.push(extra);
    }
  }

  const body = parts.join(', and that ');
  return `${preamble} ${body}. ${pick(rng, FLOURISHES)}`;
}

/** A one-line credit for the UI, so the defendant knows who to blame. */
export function counselName(caseFile) {
  const rng = seededRandom(caseFile.seed ^ 0x2f4b);
  const names = ['D. Halloran', 'M. Okafor', 'R. Prentice', 'S. Villanueva',
                 'J. Kowalczyk', 'A. Bergeron', 'T. Nakamura', 'P. Osei'];
  return pick(rng, names);
}
