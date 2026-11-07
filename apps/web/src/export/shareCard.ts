/**
 * Summary cards for chats (WhatsApp, Telegram, Signal) and link previews:
 * the chart beside the handful of facts people actually ask about.
 */
import type { Chart, DashaPeriod } from '../types/chart';
import { NAKSHATRAS, PLANET_BY_ID, signInfo } from '../data/constants';
import { chartBody, esc, PALETTES, wrap, type ChartStyleId, type ExportTheme } from './chartSvg';
import type { Knowledge } from '../lib/readings';

export type CardFormat = 'og' | 'square' | 'story';

export const CARD_SIZE: Record<CardFormat, { width: number; height: number; label: string }> = {
  og: { width: 1200, height: 630, label: 'Link preview · 1200×630' },
  square: { width: 1080, height: 1080, label: 'Chat card · 1080×1080' },
  story: { width: 1080, height: 1920, label: 'Status / story · 1080×1920' },
};

export interface Fact { label: string; value: string }

const running = (list: DashaPeriod[] | undefined, at: number) => list?.find((p) => Date.parse(p.start) <= at && at < Date.parse(p.end));

/** The facts on a card, in the order people read them. */
export function chartFacts(chart: Chart, knowledge?: Knowledge | null, at: number | null = Date.now()): Fact[] {
  const moon = chart.planets.find((p) => p.id === 'moon')!;
  const sun = chart.planets.find((p) => p.id === 'sun')!;
  const asc = signInfo(chart.ascendant.sign);
  const facts: Fact[] = [
    { label: 'Lagna', value: `${asc.name} (${asc.sanskrit}) ${Math.floor(chart.ascendant.degreeInSign)}°` },
    { label: 'Moon sign', value: `${signInfo(moon.sign).name} (${signInfo(moon.sign).sanskrit})` },
    { label: 'Nakshatra', value: `${NAKSHATRAS[moon.nakshatra - 1].name}, pada ${moon.pada}` },
    { label: 'Sun sign', value: `${signInfo(sun.sign).name} (sidereal)` },
  ];
  const md = at === null ? undefined : running(chart.dasha, at);
  if (md) {
    const ad = running(md.sub, at);
    facts.push({ label: 'Dasha now', value: `${PLANET_BY_ID[md.lord].name}${ad ? ` – ${PLANET_BY_ID[ad.lord].name}` : ''} (to ${new Date(ad?.end ?? md.end).getFullYear()})` });
  }
  const yogas = knowledge?.report.yogas.filter((y) => y.strength !== 'weak').slice(0, 3).map((y) => y.name);
  if (yogas?.length) facts.push({ label: 'Yogas', value: yogas.join(', ') });
  return facts;
}

export interface CardOptions {
  format: CardFormat;
  style: ChartStyleId;
  theme?: ExportTheme;
  /** Hide the name on the card (the date, time and place still show). */
  hideName?: boolean;
  /** Printed at the foot, e.g. the site address. */
  site?: string;
  /** Leave out the dasha running today (for historical charts). */
  noDashaNow?: boolean;
}

/** A complete SVG document for the card, at its pixel size. */
export function shareCardSvg(chart: Chart, knowledge: Knowledge | null | undefined, o: CardOptions): string {
  const { width: W, height: H } = CARD_SIZE[o.format];
  const P = PALETTES[o.theme ?? 'dark'];
  const name = (!o.hideName && chart.input.name?.trim()) || 'Vedic birth chart';
  const when = `${chart.input.date} · ${chart.input.time.slice(0, 5)}`;
  const place = chart.input.place;
  const facts = chartFacts(chart, knowledge, o.noDashaNow ? null : Date.now());
  const SERIF = "'Cormorant Garamond', Georgia, serif";
  const parts: string[] = [];

  // chart square and where the facts go, per format
  let chartX: number, chartY: number, chartS: number, fx: number, fy: number, fw: number, titleY: number, titleX: number, anchor: 'start' | 'middle';
  if (o.format === 'og') {
    chartS = 540; chartX = 45; chartY = 45;
    fx = 640; fy = 252; fw = 520; titleX = 640; titleY = 104; anchor = 'start';
  } else if (o.format === 'square') {
    chartS = 540; chartX = (W - 540) / 2; chartY = 228;
    fx = 110; fy = 818; fw = 880; titleX = W / 2; titleY = 104; anchor = 'middle';
  } else {
    chartS = 900; chartX = 90; chartY = 380;
    fx = 110; fy = 1380; fw = 860; titleX = W / 2; titleY = 220; anchor = 'middle';
  }
  const k = chartS / 400;
  const big = o.format === 'story' ? 1.45 : o.format === 'square' ? 1.1 : 1;

  parts.push(`<defs><radialGradient id="glow" cx="0.5" cy="0.35" r="0.8"><stop offset="0" stop-color="${P.bgA}"/><stop offset="1" stop-color="${P.page}"/></radialGradient></defs>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#glow)"/>`);
  // a sprinkle of stars on the dark card; fixed positions so every export is identical
  if ((o.theme ?? 'dark') === 'dark') {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 90; i++) parts.push(`<circle cx="${(rnd() * W).toFixed(0)}" cy="${(rnd() * H).toFixed(0)}" r="${(rnd() * 1.6 + 0.3).toFixed(2)}" fill="#fff" opacity="${(rnd() * 0.5 + 0.15).toFixed(2)}"/>`);
  }
  parts.push(`<rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="18" fill="none" stroke="${P.line}" stroke-opacity="0.45" stroke-width="2"/>`);

  // the name shrinks to fit its line (Cormorant averages about 0.46 em per character)
  const nameRoom = o.format === 'og' ? W - titleX - 50 : W - 160;
  const nameSize = Math.min(o.format === 'og' ? 54 : 64 * big, nameRoom / (0.46 * Math.max(1, name.length)));
  parts.push(`<text x="${titleX}" y="${titleY}" text-anchor="${anchor}" font-family="${SERIF}" font-size="${nameSize.toFixed(0)}" font-weight="600" fill="${P.text}">${esc(name)}</text>`);
  parts.push(`<text x="${titleX}" y="${titleY + 44 * big}" text-anchor="${anchor}" font-size="${(22 * big).toFixed(0)}" fill="${P.muted}">${esc(when)}</text>`);
  parts.push(`<text x="${titleX}" y="${titleY + 76 * big}" text-anchor="${anchor}" font-size="${(22 * big).toFixed(0)}" fill="${P.muted}">${esc(place.length > 48 ? place.slice(0, 47) + '…' : place)}</text>`);

  parts.push(`<g transform="translate(${chartX},${chartY}) scale(${k})">${chartBody(chart, { style: o.style, theme: o.theme, id: 'card', degrees: true })}</g>`);

  // facts, two columns on the wide cards
  const cols = o.format === 'og' ? 1 : 2;
  const colW = fw / cols;
  const lh = (o.format === 'og' ? 55 : 66) * (o.format === 'story' ? 1.25 : 1);
  const labelSize = (o.format === 'og' ? 15 : 19) * (o.format === 'story' ? 1.3 : 1);
  const valueSize = (o.format === 'og' ? 23 : 27) * (o.format === 'story' ? 1.3 : 1);
  const maxChars = Math.floor(colW / (valueSize * 0.52));
  facts.forEach((f, i) => {
    const col = cols === 1 ? 0 : i % 2;
    const row = cols === 1 ? i : Math.floor(i / 2);
    const x = fx + col * colW;
    const y = fy + row * lh;
    const value = wrap(f.value, maxChars)[0] + (f.value.length > maxChars ? '…' : '');
    parts.push(`<text x="${x}" y="${y}" font-size="${labelSize.toFixed(0)}" letter-spacing="1.5" fill="${P.accent}">${esc(f.label.toUpperCase())}</text>`);
    parts.push(`<text x="${x}" y="${y + valueSize + 4}" font-family="${SERIF}" font-size="${valueSize.toFixed(0)}" font-weight="600" fill="${P.text}">${esc(value)}</text>`);
  });

  const foot = `✦ Jyotisha Explorer${o.site ? ` · ${o.site}` : ''}`;
  parts.push(`<text x="${o.format === 'og' ? fx : W / 2}" y="${H - (o.format === 'story' ? 90 : 42)}" text-anchor="${o.format === 'og' ? 'start' : 'middle'}" font-size="${(18 * big).toFixed(0)}" fill="${P.faint}">${esc(foot)}</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">${parts.join('')}</svg>`;
}

/** A few lines of plain text to go with the card in a chat. */
export function shareText(chart: Chart, knowledge?: Knowledge | null, hideName = false): string {
  const name = (!hideName && chart.input.name?.trim()) || 'My';
  const facts = chartFacts(chart, knowledge);
  return [`${name === 'My' ? 'My' : `${name}'s`} Vedic birth chart`, ...facts.map((f) => `${f.label}: ${f.value}`)].join('\n');
}
