/**
 * The embed widget: /embed/#d=…&t=…&lat=…&lon=…&tz=…[&s=north|south][&v=D9][&th=dark|light]
 * The birth details sit after the # like a share link, so they never reach a
 * server; the chart is worked out here, in the reader's browser.
 *
 * &card=og|square|story shows the share card full-bleed instead (used to
 * render the link-preview images for the famous charts).
 */
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import './embed.css';
import type { VargaId } from '../types/chart';
import { computeChart } from '../engine';
import { parseShareHash } from '../lib/profiles';
import { getVarga } from '../lib/astro';
import { ALL_VARGAS } from '../lib/vargas';
import { chartSvg, type ChartStyleId, type ExportTheme } from '../export/chartSvg';
import { shareCardSvg, type CardFormat } from '../export/shareCard';
import { FAMOUS_CHARTS, famousChartById } from '../data/famousCharts';

const root = document.getElementById('embed')!;
const params = new URLSearchParams(location.hash.slice(1));
const famous = params.get('famous') ? famousChartById(params.get('famous')!) : undefined;
const input = famous?.input ?? parseShareHash(location.hash);
let style: ChartStyleId = params.get('s') === 'south' ? 'south' : 'north';
const theme: ExportTheme = params.get('th') === 'light' ? 'light' : 'dark';
const vargaId = (ALL_VARGAS as string[]).includes(params.get('v') ?? '') ? (params.get('v') as VargaId) : 'D1';
const card = params.get('card') as CardFormat | null;
document.documentElement.dataset.theme = theme;

const appUrl = new URL(`${import.meta.env.BASE_URL}app/`, location.href);
const SOURCE = 'https://github.com/destinjones/vedic-astrology';

async function main() {
  // tools/render-og.mjs reads the famous charts list from here
  if (location.hash === '#famous-list') {
    const list = FAMOUS_CHARTS.map((c) => ({ id: c.id, label: c.label, field: c.field, date: c.input.date, time: c.input.time, place: c.input.place, rodden: c.rodden }));
    const pre = document.createElement('pre');
    pre.id = 'famous-list';
    pre.textContent = JSON.stringify(list);
    root.replaceChildren(pre);
    document.body.dataset.ready = 'true';
    return;
  }
  if (!input) {
    root.innerHTML = `<p class="em-wait">This embed link has no birth details. <a href="${appUrl}" target="_blank" rel="noopener">Make a chart</a> and copy its embed code.</p>`;
    return;
  }
  const chart = await computeChart(input);

  if (card === 'og' || card === 'square' || card === 'story') {
    document.documentElement.classList.add('em-card');
    root.innerHTML = shareCardSvg(chart, null, { format: card, style, theme, noDashaNow: !!famous });
    await document.fonts.ready;
    document.body.dataset.ready = 'true';
    return;
  }

  const link = famous ? `${appUrl}#famous=${famous.id}` : `${appUrl}${location.hash.split('&s=')[0]}`;
  const render = () => {
    const { svg } = chartSvg(chart, { style, theme, varga: getVarga(chart, vargaId), width: 400, header: true });
    root.innerHTML = `${svg}
      <nav class="em-bar">
        <button type="button" data-style="north" aria-pressed="${style === 'north'}">North</button>
        <button type="button" data-style="south" aria-pressed="${style === 'south'}">South</button>
        <a href="${link}" target="_blank" rel="noopener">Open full chart ↗</a>
      </nav>
      <p class="em-foot"><a href="${appUrl}" target="_blank" rel="noopener">Jyotisha Explorer</a> · free and open source · <a href="${SOURCE}" target="_blank" rel="noopener">source</a></p>`;
    root.querySelector('svg')!.setAttribute('width', '100%');
    root.querySelector('svg')!.removeAttribute('height');
    root.querySelectorAll<HTMLButtonElement>('[data-style]').forEach((b) => b.addEventListener('click', () => { style = b.dataset.style as ChartStyleId; render(); }));
  };
  render();
  document.body.dataset.ready = 'true';
}

main().catch((e) => {
  console.error(e);
  root.innerHTML = '<p class="em-wait">The chart could not be worked out here.</p>';
});
