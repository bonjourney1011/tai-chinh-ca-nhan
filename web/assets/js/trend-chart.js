// Stacked area of assets by group over time. Chart.js is loaded from cdnjs in index.html.
import { formatShort, formatDayMonth } from './dom-and-format-helpers.js';

export const GROUPS = [
  { key: 'tien_gui', label: 'Tiền gửi' },
  { key: 'trai_phieu', label: 'Trái phiếu' },
  { key: 'co_phieu', label: 'Cổ phiếu' },
  { key: 'vang', label: 'Vàng' },
  { key: 'usd', label: 'USD' },
  { key: 'khac', label: 'Khác' }
];
const MAX_POINTS = 120;
let chart = null;
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function renderTrendChart(canvas, trend) {
  if (chart) { chart.destroy(); chart = null; }
  const points = (trend || []).slice(-MAX_POINTS);
  if (!canvas || !window.Chart || points.length < 2) return false;
  chart = new window.Chart(canvas, {
    type: 'line',
    data: {
      labels: points.map((p) => formatDayMonth(p.ngay)),
      datasets: GROUPS.map((g, index) => ({
        label: g.label, data: points.map((p) => Math.max(0, Number(p[g.key]) || 0)),
        backgroundColor: cssVar(`--g-${g.key}`), borderColor: cssVar('--surface'), borderWidth: 1,
        fill: index === 0 ? 'origin' : '-1', pointRadius: 0, pointHoverRadius: 4, tension: 0.25
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { display: false }, ticks: { color: cssVar('--ink-muted'), maxRotation: 0, autoSkipPadding: 24 } },
        y: { stacked: true, beginAtZero: true, border: { display: false }, grid: { color: cssVar('--grid') },
          ticks: { color: cssVar('--ink-muted'), maxTicksLimit: 5, callback: (v) => formatShort(v) } }
      },
      plugins: {
        legend: { position: 'top', align: 'start', labels: { color: cssVar('--ink-2'), boxWidth: 12, boxHeight: 12, useBorderRadius: true, borderRadius: 3 } },
        tooltip: { callbacks: {
          label: (item) => ` ${item.dataset.label}: ${formatShort(item.parsed.y)}`,
          footer: (items) => `Tổng: ${formatShort(items.reduce((s, i) => s + i.parsed.y, 0))}`
        } }
      }
    }
  });
  return true;
}
