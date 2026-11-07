/**
 * Print poster and phone wallpaper made from the 3D sky. SkyView renders the
 * scene at the size asked for (in tiles, so it can go past the GPU's limit);
 * this module lays the render out with the name, birth data and positions.
 */
import type { Chart, PlanetId } from '../types/chart';
import { NAKSHATRAS, PLANET_BY_ID, signInfo } from '../data/constants';
import { canvasBlob } from './raster';

export interface SkyLabel { id: PlanetId | 'asc'; text: string; color: string; x: number; y: number }
export interface SkyRender { canvas: HTMLCanvasElement; labels: SkyLabel[] }
/** Renders the scene into a canvas of exactly this size, from the current view, with the camera pulled back to fit. */
export type SkyCapture = (width: number, height: number) => Promise<SkyRender>;

export type SkyFormat = 'a2-150' | 'a2-300' | 'iphone' | 'android' | 'desktop';

export const SKY_FORMATS: Record<SkyFormat, { width: number; height: number; label: string; kind: 'poster' | 'phone' | 'desktop' }> = {
  'a2-150': { width: 2480, height: 3508, label: 'A2 poster · 150 dpi (2480×3508)', kind: 'poster' },
  'a2-300': { width: 4961, height: 7016, label: 'A2 poster · 300 dpi, print shop (4961×7016)', kind: 'poster' },
  iphone: { width: 1290, height: 2796, label: 'iPhone lock screen (1290×2796)', kind: 'phone' },
  android: { width: 1080, height: 2400, label: 'Android lock screen (1080×2400)', kind: 'phone' },
  desktop: { width: 3840, height: 2160, label: 'Desktop wallpaper · 4K (3840×2160)', kind: 'desktop' },
};

const SERIF = "'Cormorant Garamond', Georgia, serif";
const SANS = "Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function drawLabels(ctx: CanvasRenderingContext2D, labels: SkyLabel[], scale: number, dy = 0) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.round(15 * scale)}px ${SANS}`;
  for (const l of labels) {
    const w = ctx.measureText(l.text).width + 18 * scale;
    const h = 24 * scale;
    ctx.fillStyle = 'rgba(11,10,26,0.72)';
    ctx.beginPath();
    ctx.roundRect(l.x - w / 2, l.y + dy - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = l.color;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = Math.max(1, 1.2 * scale);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = l.color;
    ctx.fillText(l.text, l.x, l.y + dy + 1);
  }
}

const positionsLine = (chart: Chart) => chart.planets.map((p) => `${PLANET_BY_ID[p.id].abbr} ${signInfo(p.sign).short} ${Math.floor(p.degreeInSign)}°${p.retrograde && p.id !== 'rahu' && p.id !== 'ketu' ? 'R' : ''}`);

/** Lays out the finished image for a format. */
export async function composeSky(chart: Chart, capture: SkyCapture, format: SkyFormat, o: { labels: boolean; hideName?: boolean }): Promise<HTMLCanvasElement> {
  const F = SKY_FORMATS[format];
  const W = F.width, H = F.height;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d')!;
  await document.fonts?.ready;
  const name = (!o.hideName && chart.input.name?.trim()) || '';
  const asc = signInfo(chart.ascendant.sign);
  const moon = chart.planets.find((p) => p.id === 'moon')!;
  ctx.fillStyle = '#05050f';
  ctx.fillRect(0, 0, W, H);

  if (F.kind === 'poster') {
    const s = W / 1000;
    const artH = Math.round(H * 0.74);
    const art = await capture(W, artH);
    ctx.drawImage(art.canvas, 0, 0);
    if (o.labels) drawLabels(ctx, art.labels, s * 1.6);
    // fade the render into the text panel
    const g = ctx.createLinearGradient(0, artH - 260 * s, 0, artH);
    g.addColorStop(0, 'rgba(5,5,15,0)');
    g.addColorStop(1, 'rgba(5,5,15,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, artH - 260 * s, W, 260 * s);
    ctx.fillStyle = '#05050f';
    ctx.fillRect(0, artH, W, H - artH);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    let y = artH + 20 * s;
    ctx.fillStyle = '#ece8f6';
    ctx.font = `600 ${Math.round(78 * s)}px ${SERIF}`;
    ctx.fillText(name || 'The sky at my birth', W / 2, y + 30 * s);
    y += 82 * s;
    ctx.fillStyle = '#a39cbf';
    ctx.font = `400 ${Math.round(24 * s)}px ${SANS}`;
    ctx.fillText(`${chart.input.date} · ${chart.input.time.slice(0, 5)} · ${chart.input.place}`, W / 2, y);
    y += 56 * s;
    ctx.fillStyle = '#e8b65a';
    ctx.font = `600 ${Math.round(30 * s)}px ${SERIF}`;
    ctx.fillText(`${asc.sanskrit} lagna · Moon in ${signInfo(moon.sign).sanskrit} · ${NAKSHATRAS[moon.nakshatra - 1].name} nakshatra`, W / 2, y);
    y += 58 * s;
    ctx.fillStyle = '#c9c3dc';
    ctx.font = `500 ${Math.round(19 * s)}px ${SANS}`;
    const pos = positionsLine(chart);
    ctx.fillText(pos.slice(0, 5).join('    '), W / 2, y);
    ctx.fillText(pos.slice(5).join('    '), W / 2, y + 30 * s);
    ctx.strokeStyle = 'rgba(232,182,90,0.4)';
    ctx.lineWidth = 2 * s;
    ctx.strokeRect(24 * s, 24 * s, W - 48 * s, H - 48 * s);
    ctx.fillStyle = '#6f6890';
    ctx.font = `400 ${Math.round(14 * s)}px ${SANS}`;
    ctx.fillText('Sidereal positions · Jyotisha Explorer · the planets drawn at their true longitudes on the zodiac wheel', W / 2, H - 50 * s);
    return out;
  }

  if (F.kind === 'phone') {
    const s = W / 430;
    const art = await capture(W, H);
    ctx.drawImage(art.canvas, 0, 0);
    if (o.labels) drawLabels(ctx, art.labels, s * 0.75);
    // keep the clock legible: darken the top third, and the foot for the text
    const top = ctx.createLinearGradient(0, 0, 0, H * 0.36);
    top.addColorStop(0, 'rgba(5,5,15,0.78)');
    top.addColorStop(1, 'rgba(5,5,15,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, H * 0.36);
    const foot = ctx.createLinearGradient(0, H * 0.8, 0, H);
    foot.addColorStop(0, 'rgba(5,5,15,0)');
    foot.addColorStop(1, 'rgba(5,5,15,0.9)');
    ctx.fillStyle = foot;
    ctx.fillRect(0, H * 0.8, W, H * 0.2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8b65a';
    ctx.font = `600 ${Math.round(22 * s)}px ${SERIF}`;
    ctx.fillText(`${asc.sanskrit} lagna · Moon in ${signInfo(moon.sign).sanskrit}`, W / 2, H - 92 * s);
    ctx.fillStyle = '#a39cbf';
    ctx.font = `400 ${Math.round(11 * s)}px ${SANS}`;
    ctx.fillText(name ? `${name} · ${chart.input.date}` : chart.input.date, W / 2, H - 70 * s);
    return out;
  }

  // desktop wallpaper: full bleed, a small caption bottom-left
  const s = W / 1920;
  const art = await capture(W, H);
  ctx.drawImage(art.canvas, 0, 0);
  if (o.labels) drawLabels(ctx, art.labels, s * 1.2);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e8b65a';
  ctx.font = `600 ${Math.round(30 * s)}px ${SERIF}`;
  ctx.fillText(`${name ? name + ' · ' : ''}${asc.sanskrit} lagna · Moon in ${signInfo(moon.sign).sanskrit}`, 56 * s, H - 70 * s);
  ctx.fillStyle = '#a39cbf';
  ctx.font = `400 ${Math.round(15 * s)}px ${SANS}`;
  ctx.fillText(`${chart.input.date} · ${chart.input.time.slice(0, 5)} · ${chart.input.place}`, 56 * s, H - 42 * s);
  return out;
}

/** The poster as an A2 PDF (420×594 mm) with the image filling the page. */
export async function posterPdf(canvas: HTMLCanvasElement): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a2', orientation: 'portrait', compress: true });
  const jpeg = await canvasBlob(canvas, 'image/jpeg', 0.92);
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  pdf.addImage(bytes, 'JPEG', 0, 0, 420, 594);
  pdf.setProperties({ title: 'Birth sky poster', creator: 'Jyotisha Explorer' });
  return pdf.output('blob');
}
