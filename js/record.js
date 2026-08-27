/**
 * record.js — The defendant's criminal record, visualised.
 *
 * Two charts: where the convictions came from, and how the culpability of the
 * defendant's spending is distributed. Rendered only once cases are settled.
 */

import Chart from 'chart.js/auto';
import { CATEGORIES } from './data.js';

Chart.defaults.color = '#bcae94';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 11;

let categoryChart = null;
let timelineChart = null;

const PALETTE = ['#c02a24', '#c8a24a', '#8d1c17', '#4f9464', '#a8763a', '#6f4b8e', '#3f6f8d', '#8d7130'];

export function renderRecord(cases) {
  const settled = cases.filter((c) => c.resolved);
  const convicted = settled.filter((c) => c.resolved.convicted);

  const section = document.getElementById('record-section');
  if (convicted.length < 1) { section.hidden = true; return; }
  section.hidden = false;

  // ---- Convictions by category (where the crime actually happens) ----
  const byCat = {};
  for (const c of convicted) {
    const label = CATEGORIES[c.category]?.label || 'Unclassified';
    byCat[label] = (byCat[label] || 0) + c.amount;
  }
  const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 8);

  categoryChart?.destroy();
  categoryChart = new Chart(document.getElementById('chart-category'), {
    type: 'doughnut',
    data: {
      labels: catEntries.map(([k]) => k),
      datasets: [{
        data: catEntries.map(([, v]) => Math.round(v * 100) / 100),
        backgroundColor: PALETTE,
        borderColor: '#1e150f',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '58%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 11, padding: 9 } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: $${ctx.parsed.toFixed(2)}` } },
      },
    },
  });

  // ---- Culpability over the docket (the shape of the defendant's judgment) ----
  const ordered = [...settled].sort((a, b) => a.date - b.date);
  timelineChart?.destroy();
  timelineChart = new Chart(document.getElementById('chart-timeline'), {
    type: 'bar',
    data: {
      labels: ordered.map((c) => c.merchant.slice(0, 14)),
      datasets: [{
        label: 'Culpability',
        data: ordered.map((c) => c.resolved.culpability),
        backgroundColor: ordered.map((c) =>
          c.resolved.culpability >= 72 ? '#c02a24'
          : c.resolved.culpability >= 48 ? '#c8a24a' : '#4f9464'),
        borderRadius: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` Culpability ${ctx.parsed.y}/100` } } },
      scales: {
        y: { max: 100, grid: { color: 'rgba(64,48,31,.5)' }, ticks: { stepSize: 25 } },
        x: { grid: { display: false }, ticks: { maxRotation: 55, minRotation: 55, font: { size: 9 } } },
      },
    },
  });

  // ---- Headline figures ----
  const owed = convicted.reduce((s, c) => s + c.resolved.restitution, 0);
  const worst = [...convicted].sort((a, b) => b.resolved.culpability - a.resolved.culpability)[0];
  document.getElementById('record-summary').innerHTML = `
    <p>The defendant has been convicted <strong>${convicted.length}</strong> ${convicted.length === 1 ? 'time' : 'times'}
    across <strong>${catEntries.length}</strong> ${catEntries.length === 1 ? 'category' : 'categories'} of offence,
    with <strong>$${owed.toFixed(2)}</strong> in outstanding restitution to their own savings account.</p>
    <p class="worst">Most egregious offence on file: <strong>${worst.merchant}</strong>,
    $${worst.amount.toFixed(2)} — culpability ${worst.resolved.culpability}/100.</p>`;
}
