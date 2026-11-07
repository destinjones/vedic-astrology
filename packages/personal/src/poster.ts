/**
 * A natal chart as generative art: one poster per chart, drawn only from its
 * own degrees. The same chart always gives the same poster; a birth four
 * minutes later gives a visibly different one.
 *
 *   - palette from the element of the rising sign
 *   - twelve petals turned to the exact degree of the ascendant
 *   - one rose curve per planet: lobes from its sign, depth from its degree
 *     in the sign, rotation from its longitude
 *   - a constellation joining the planets in zodiac order
 *   - 27 nakshatra ticks with the birth star lit
 *   - a star field seeded by the whole chart
 */
import type { Chart, GrahaId } from '@vedic/engine';
import { dm, hashString, mulberry32, NAKSHATRA_NAMES, norm360, SIGN_NAMES } from './util';

export interface PosterOptions {
  width?: number;
  height?: number;
  /** Large title; usually the person's name. */
  title?: string;
  /** Print date, time and place under the title. Off by default so a shared poster does not give away birth data. */
  showBirthData?: boolean;
  /** Print each planet's degree in the footer. */
  showDegrees?: boolean;
}

const ELEMENT_PALETTE: Record<string, { bg: [string, string]; ink: string; accent: string; glow: string }> = {
  fire: { bg: ['#2a0a12', '#5b1a10'], ink: '#f7e3c0', accent: '#ffb547', glow: '#ff6a3d' },
  earth: { bg: ['#0f1a10', '#2e3a1a'], ink: '#efe6cf', accent: '#d8b35a', glow: '#8fbf5a' },
  air: { bg: ['#0b1030', '#26346e'], ink: '#e8ecff', accent: '#9fd3ff', glow: '#c3a6ff' },
  water: { bg: ['#03161d', '#0c3a4a'], ink: '#dff6f4', accent: '#7ee0d2', glow: '#5aa7ff' },
};
const ELEMENT_OF = ['fire', 'earth', 'air', 'water'];
const PLANET_HUE: Record<GrahaId, string> = {
  sun: '#ffb547', moon: '#e9eef7', mars: '#ff5a4f', mercury: '#5fd38a', jupiter: '#ffd866',
  venus: '#ff9fd1', saturn: '#7f9cff', rahu: '#a98bff', ketu: '#ffa07a',
};
const GLYPH: Record<GrahaId, string> = { sun: '☉', moon: '☽', mars: '♂', mercury: '☿', jupiter: '♃', venus: '♀', saturn: '♄', rahu: '☊', ketu: '☋' };
const ORDER: GrahaId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];
// U+FE0E asks for the text form, so the glyphs do not turn into coloured emoji
const SIGN_GLYPH = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'].map((g) => g + '\uFE0E');

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const f = (n: number) => +n.toFixed(2);

/** Seed from the chart's own degrees. */
export function posterSeed(chart: Chart): number {
  return hashString([chart.ascendant.longitude, ...ORDER.map((p) => chart.planets[p].longitude)].map((x) => x.toFixed(3)).join('|'));
}

export function posterSvg(chart: Chart, opts: PosterOptions = {}): string {
  const W = opts.width ?? 1200;
  const H = opts.height ?? 1600;
  const cx = W / 2;
  const cy = H * 0.41;
  const R = Math.min(W, H) * 0.36;
  const rnd = mulberry32(posterSeed(chart));
  const asc = chart.ascendant;
  const pal = ELEMENT_PALETTE[ELEMENT_OF[(asc.sign - 1) % 4]];
  // the ascendant points left and the signs run counter-clockwise from it, as on a horoscope wheel
  const rot = (lon: number) => ((180 + norm360(lon - asc.longitude)) * Math.PI) / 180;
  const pt = (lon: number, r: number): [number, number] => [cx + r * Math.cos(rot(lon)), cy - r * Math.sin(rot(lon))];
  const parts: string[] = [];

  parts.push(`<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${pal.bg[0]}"/><stop offset="1" stop-color="${pal.bg[1]}"/></linearGradient>
<radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${pal.glow}" stop-opacity="0.35"/><stop offset="1" stop-color="${pal.glow}" stop-opacity="0"/></radialGradient>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${f(R * 0.01)}"/></filter>
</defs>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#bg)"/>`);

  // star field
  const stars: string[] = [];
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = rnd() ** 3 * 2.2 + 0.3;
    stars.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" opacity="${f(0.25 + rnd() * 0.6)}"/>`);
  }
  parts.push(`<g fill="${pal.ink}">${stars.join('')}</g>`);
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${f(R * 1.35)}" fill="url(#halo)"/>`);

  // twelve petals, turned to the ascendant degree
  const petals: string[] = [];
  for (let s = 0; s < 12; s++) {
    const a0 = asc.longitude - (asc.longitude % 30) + s * 30;
    const [x1, y1] = pt(a0, R * 0.18);
    const [x2, y2] = pt(a0 + 15, R * 0.98);
    const [x3, y3] = pt(a0 + 30, R * 0.18);
    const [c1x, c1y] = pt(a0 + 2, R * 0.75);
    const [c2x, c2y] = pt(a0 + 28, R * 0.75);
    petals.push(`<path d="M${f(x1)} ${f(y1)} Q${f(c1x)} ${f(c1y)} ${f(x2)} ${f(y2)} Q${f(c2x)} ${f(c2y)} ${f(x3)} ${f(y3)}" opacity="${s === 0 ? 0.55 : 0.18}"/>`);
  }
  parts.push(`<g fill="none" stroke="${pal.accent}" stroke-width="${f(R * 0.004)}">${petals.join('')}</g>`);

  // rings and nakshatra ticks
  const moonNak = chart.planets.moon.nakshatra;
  const ticks: string[] = [];
  for (let k = 0; k < 27; k++) {
    const lon = (k * 360) / 27;
    const lit = k + 1 === moonNak;
    const [a, b] = [pt(lon, R * 1.04), pt(lon, R * (lit ? 1.16 : 1.09))];
    ticks.push(`<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="${lit ? pal.glow : pal.ink}" stroke-width="${lit ? f(R * 0.012) : f(R * 0.003)}" opacity="${lit ? 1 : 0.5}"/>`);
  }
  for (let s = 0; s < 12; s++) {
    const [x, y] = pt(s * 30 + 15, R * 1.22);
    ticks.push(`<text x="${f(x)}" y="${f(y)}" font-size="${f(R * 0.07)}" text-anchor="middle" dominant-baseline="central" fill="${pal.ink}" opacity="${s + 1 === asc.sign ? 0.95 : 0.4}">${SIGN_GLYPH[s]}</text>`);
  }
  parts.push(`<g fill="none" stroke="${pal.ink}" stroke-opacity="0.35" stroke-width="${f(R * 0.003)}"><circle cx="${cx}" cy="${cy}" r="${f(R * 1.04)}"/><circle cx="${cx}" cy="${cy}" r="${f(R * 0.18)}"/></g>`);
  parts.push(`<g font-family="serif">${ticks.join('')}</g>`);

  // one rose curve per planet
  const roses: string[] = [];
  for (const p of ORDER) {
    const pl = chart.planets[p];
    const k = 2 + ((pl.sign + ORDER.indexOf(p)) % 6); // lobes
    const depth = 0.25 + (pl.degreeInSign / 30) * 0.55;
    const scale = R * (0.42 + 0.06 * ORDER.indexOf(p));
    const phase = (pl.longitude * Math.PI) / 180;
    const pts: string[] = [];
    for (let i = 0; i <= 360; i++) {
      const t = (i / 360) * Math.PI * 2;
      const r = scale * (1 - depth + depth * Math.abs(Math.cos((k * t) / 2)));
      pts.push(`${f(cx + r * Math.cos(t + phase))} ${f(cy - r * Math.sin(t + phase))}`);
    }
    roses.push(`<path d="M${pts.join(' L')}Z" stroke="${PLANET_HUE[p]}" opacity="${p === 'moon' || p === 'sun' ? 0.75 : 0.42}"/>`);
  }
  parts.push(`<g fill="none" stroke-width="${f(R * 0.0045)}" style="mix-blend-mode:screen">${roses.join('')}</g>`);

  // constellation in zodiac order
  const byLon = [...ORDER].sort((a, b) => norm360(chart.planets[a].longitude - asc.longitude) - norm360(chart.planets[b].longitude - asc.longitude));
  const cpts = byLon.map((p) => pt(chart.planets[p].longitude, R * (0.86 + 0.08 * ((ORDER.indexOf(p) % 3) - 1))));
  parts.push(`<polygon points="${cpts.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}" fill="${pal.accent}" fill-opacity="0.05" stroke="${pal.accent}" stroke-opacity="0.6" stroke-width="${f(R * 0.004)}"/>`);
  const dots = byLon.map((p, i) => {
    const [x, y] = cpts[i];
    const r = R * (p === 'sun' || p === 'moon' ? 0.03 : 0.022);
    return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 2.2)}" fill="${PLANET_HUE[p]}" opacity="0.35" filter="url(#soft)"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${PLANET_HUE[p]}"/><text x="${f(x)}" y="${f(y - r * 2.4)}" font-size="${f(R * 0.05)}" text-anchor="middle" fill="${pal.ink}" opacity="0.85">${GLYPH[p]}</text>`;
  });
  parts.push(`<g font-family="serif">${dots.join('')}</g>`);
  // ascendant marker
  const [ax, ay] = pt(asc.longitude, R * 1.04);
  const [bx, by] = pt(asc.longitude, R * 0.18);
  parts.push(`<line x1="${f(ax)}" y1="${f(ay)}" x2="${f(bx)}" y2="${f(by)}" stroke="${pal.glow}" stroke-width="${f(R * 0.006)}" opacity="0.8"/>`);

  // type
  const ty = cy + R * 1.5;
  const title = esc((opts.title ?? '').trim() || `Born under ${NAKSHATRA_NAMES[chart.planets.moon.nakshatra - 1]}`);
  parts.push(`<text x="${cx}" y="${f(ty)}" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-size="${f(W * 0.07)}" fill="${pal.ink}" letter-spacing="2">${title}</text>`);
  const moonSign = SIGN_NAMES[chart.planets.moon.sign - 1];
  const sub = `${SIGN_NAMES[asc.sign - 1]} rising · ${moonSign} Moon · ${NAKSHATRA_NAMES[moonNak - 1]}`;
  parts.push(`<text x="${cx}" y="${f(ty + W * 0.055)}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="${f(W * 0.022)}" fill="${pal.accent}" letter-spacing="4">${esc(sub.toUpperCase())}</text>`);
  let line = ty + W * 0.1;
  if (opts.showBirthData) {
    const i = chart.meta.input;
    parts.push(`<text x="${cx}" y="${f(line)}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="${f(W * 0.018)}" fill="${pal.ink}" opacity="0.7">${esc(`${i.date} · ${i.time} · ${i.place.name ?? ''}`)}</text>`);
    line += W * 0.035;
  }
  if (opts.showDegrees !== false) {
    const deg = ORDER.map((p) => `${GLYPH[p]} ${dm(chart.planets[p].longitude)} ${SIGN_GLYPH[chart.planets[p].sign - 1]}`).join('   ');
    parts.push(`<text x="${cx}" y="${f(line)}" text-anchor="middle" font-family="serif" font-size="${f(W * 0.017)}" fill="${pal.ink}" opacity="0.55">${esc(deg)}</text>`);
  }
  parts.push(`<text x="${cx}" y="${f(H - W * 0.03)}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="${f(W * 0.013)}" fill="${pal.ink}" opacity="0.4" letter-spacing="3">DRAWN FROM THIS CHART'S OWN DEGREES · JYOTISHA EXPLORER</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('\n')}</svg>`;
}
