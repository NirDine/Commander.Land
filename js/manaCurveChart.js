'use strict';

// Mana curve by color: a line chart, one line per color, showing nonland
// spell count across mana values. Colors here reuse the same hex values as
// charts.js's polar area chart for visual consistency across the analyzer
// page. Uses Chart.js's built-in legend (top, right-aligned, single row)
// so clicking a color's label toggles that line's visibility for free.

const MANA_CURVE_COLORS = {
  W: { hex: '#e7deb5', label: 'White' },
  U: { hex: '#b7cae8', label: 'Blue' },
  B: { hex: '#b4abb0', label: 'Black' },
  R: { hex: '#d8917d', label: 'Red' },
  G: { hex: '#bacbc1', label: 'Green' },
  C: { hex: '#cac5c0', label: 'Colorless' }
};

// Line charts can't rely on color alone to distinguish series, so give each
// non-adjacent color a distinct dash pattern.
const MANA_CURVE_LINE_DASH = {
  W: [], U: [], B: [6, 3], R: [], G: [6, 3], C: [1, 3]
};

let manaCurveLineChart;

// Extracts the set of WUBRG colors present as pips in a card's mana cost
// (e.g. "{2}{W/U}{B}" -> ['W', 'U', 'B']). Hybrid/Phyrexian pips count for
// every color they can be paid with. Falls back to the front face's mana
// cost for DFCs/MDFCs whose top-level mana_cost is blank.
function extractPipColors(card) {
  let manaCostString = card.mana_cost;
  if ((!manaCostString || manaCostString.trim() === '') && Array.isArray(card.card_faces) && card.card_faces.length > 0) {
    manaCostString = card.card_faces[0].mana_cost;
  }
  if (!manaCostString) return [];

  const colors = new Set();
  const manaSymbolRegex = /{([^}]+)}/g;
  let match;
  while ((match = manaSymbolRegex.exec(manaCostString)) !== null) {
    const symbol = match[1].toUpperCase().replace('/P', '').replace('P/', '');
    symbol.split('/').forEach(part => {
      if (['W', 'U', 'B', 'R', 'G'].includes(part)) {
        colors.add(part);
      }
    });
  }
  return Array.from(colors);
}

function manaValueBucket(cmc) {
  const rounded = Math.max(0, Math.round(cmc || 0));
  return rounded >= 7 ? 7 : rounded;
}

// Buckets nonland spells (cmc > 0, the same convention the Color weight
// panel already uses) by mana value (0-7+) and by pip color. A multicolor
// card is counted once in every color it has a pip for, matching how the
// Color weight panel already lists multicolor cards under each of their
// colors — so segment totals can exceed the deck's nonland card count.
function buildManaCurveData(responseData) {
  const labels = ['0', '1', '2', '3', '4', '5', '6', '7+'];
  const counts = {
    W: Array(8).fill(0), U: Array(8).fill(0), B: Array(8).fill(0),
    R: Array(8).fill(0), G: Array(8).fill(0), C: Array(8).fill(0)
  };

  (responseData || []).forEach(card => {
    if (!(card.cmc > 0)) return; // Skip lands / 0-cost cards

    const bucket = manaValueBucket(card.cmc);
    const pipColors = extractPipColors(card);

    if (pipColors.length === 0) {
      counts.C[bucket]++;
    } else {
      pipColors.forEach(color => counts[color][bucket]++);
    }
  });

  return { labels, counts };
}

function renderManaCurveCharts() {
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded yet; skipping mana curve chart render.');
    return;
  }

  const lineCanvas = document.getElementById('manaCurveLineChart');
  if (!lineCanvas) return;

  const responseDataString = localStorage.getItem('responseData');
  let responseData = [];
  try {
    responseData = responseDataString ? JSON.parse(responseDataString) : [];
  } catch (error) {
    console.error('Error parsing responseData for mana curve chart:', error);
  }

  const { labels, counts } = buildManaCurveData(responseData);
  const activeColors = Object.keys(MANA_CURVE_COLORS).filter(color => counts[color].some(n => n > 0));

  if (manaCurveLineChart) manaCurveLineChart.destroy();

  manaCurveLineChart = new Chart(lineCanvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: activeColors.map(color => ({
        label: MANA_CURVE_COLORS[color].label,
        data: counts[color],
        borderColor: MANA_CURVE_COLORS[color].hex,
        backgroundColor: MANA_CURVE_COLORS[color].hex,
        borderWidth: 2,
        borderDash: MANA_CURVE_LINE_DASH[color] || [],
        tension: 0.3,
        pointRadius: 3,
        fill: false
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      plugins: {
        // Chart.js's default legend already toggles a line's visibility on
        // click; we just need to display it. 'top' + align 'end' keeps it
        // on one inline row, right-aligned, instead of taking up its own
        // block of vertical space.
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            padding: 10,
            font: { size: 12 }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          title: { display: true, text: 'Mana Value' }
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
          title: { display: true, text: 'Card Count' }
        }
      }
    }
  });
}
