/**
 * splash.js — Courtroom theatrics.
 *
 * The dramatic full-screen callouts: OBJECTION when the prosecution catches
 * the defendant in a classic bad excuse, and the verdict slam. Speed lines,
 * screen shake, and a synthesised sting, all generated — no image or audio
 * assets anywhere in the repo.
 */

import { gsap } from 'gsap';

let layer = null;

function ensureLayer() {
  if (layer) return layer;
  layer = document.createElement('div');
  layer.className = 'splash-layer';
  layer.hidden = true;
  layer.innerHTML = `
    <div class="splash-lines"></div>
    <div class="splash-flash"></div>
    <div class="splash-word"><span></span></div>`;
  document.body.appendChild(layer);
  return layer;
}

/** A short brass-ish sting: detuned saw stack with a fast decay. */
function sting(tone) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;
    const root = tone === 'acquit' ? 392 : 233;          // G4 for relief, Bb3 for doom
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    bus.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    bus.connect(ctx.destination);

    for (const [mult, detune] of [[1, -7], [1, 7], [1.5, 0], [2, 4]]) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = root * mult;
      osc.detune.value = detune;
      g.gain.value = 0.22;
      osc.connect(g).connect(bus);
      osc.start(t);
      osc.stop(t + 0.8);
    }
    setTimeout(() => ctx.close(), 1200);
  } catch { /* silence is also dramatic */ }
}

/**
 * Slam a word across the whole screen.
 * @param {string} text  what the court shouts
 * @param {'guilty'|'acquit'|'objection'} tone
 */
export function splash(text, tone = 'objection') {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();

  const el = ensureLayer();
  const word = el.querySelector('.splash-word span');
  const lines = el.querySelector('.splash-lines');
  const flash = el.querySelector('.splash-flash');

  el.hidden = false;
  el.dataset.tone = tone;
  word.textContent = text;
  sting(tone);

  const tl = gsap.timeline({
    onComplete: () => { el.hidden = true; },
  });

  tl.set(flash, { opacity: 1 })
    .to(flash, { opacity: 0, duration: 0.22, ease: 'power2.out' }, 0)
    .fromTo(word,
      { scale: 3.4, opacity: 0, rotateZ: -9 },
      { scale: 1, opacity: 1, rotateZ: -6, duration: 0.26, ease: 'back.out(2.4)' }, 0)
    .fromTo(lines, { opacity: 0, scale: 1.4 }, { opacity: 1, scale: 1, duration: 0.3 }, 0)
    .to(lines, { rotate: 12, duration: 1.0, ease: 'none' }, 0.05)
    // the shake
    .to(el, { x: 12, duration: 0.05, yoyo: true, repeat: 5, ease: 'none' }, 0.22)
    .to(el, { x: 0, duration: 0.05 })
    .to({}, { duration: 0.42 })
    .to([word, lines], { opacity: 0, duration: 0.22, ease: 'power1.in' })
    .set(el, { x: 0 });

  return new Promise((resolve) => { tl.eventCallback('onComplete', () => { el.hidden = true; resolve(); }); });
}
