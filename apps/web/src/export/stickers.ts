/**
 * Graha sticker pack made from the Blender renders in assets/3d/grahas:
 * each graha on a transparent 512×512 canvas with a white die-cut border,
 * which is the size and shape WhatsApp and Telegram stickers expect.
 */
import type { PlanetId } from '../types/chart';
import { grahaArt } from '../data/art';
import { PLANET_BY_ID } from '../data/constants';
import { canvasBlob, loadImage } from './raster';
import { zip, type ZipEntry } from './zip';

export const STICKER_ORDER: PlanetId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];

/** Devanagari names, written on the sticker under the Latin one. */
const DEVANAGARI: Record<PlanetId, string> = {
  sun: 'सूर्य', moon: 'चन्द्र', mars: 'मङ्गल', mercury: 'बुध', jupiter: 'गुरु', venus: 'शुक्र', saturn: 'शनि', rahu: 'राहु', ketu: 'केतु',
};

export interface StickerOptions {
  /** Write the graha's name across the foot of the sticker. */
  label: boolean;
  size?: number;
}

/** One sticker on a canvas. */
export async function drawSticker(id: PlanetId, o: StickerOptions, canvas = document.createElement('canvas')): Promise<HTMLCanvasElement> {
  const N = o.size ?? 512;
  const img = await loadImage(grahaArt(id).image);
  canvas.width = N;
  canvas.height = N;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, N, N);

  const border = Math.round(N * 0.022);
  const art = N * (o.label ? 0.78 : 0.9);
  const ax = (N - art) / 2;
  const ay = o.label ? N * 0.035 : (N - art) / 2;

  // the white die-cut edge: the art's silhouette, filled white, stamped in a ring
  const sil = document.createElement('canvas');
  sil.width = N; sil.height = N;
  const s = sil.getContext('2d')!;
  s.drawImage(img, ax, ay, art, art);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = '#ffffff';
  s.fillRect(0, 0, N, N);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = N * 0.02;
  ctx.shadowOffsetY = N * 0.006;
  for (let a = 0; a < 360; a += 20) {
    const r = (a * Math.PI) / 180;
    ctx.drawImage(sil, Math.cos(r) * border, Math.sin(r) * border);
  }
  ctx.restore();
  ctx.drawImage(img, ax, ay, art, art);

  if (o.label) {
    const info = PLANET_BY_ID[id];
    const text = `${info.sanskrit}`;
    const fs = Math.round(N * 0.1);
    ctx.font = `700 ${fs}px Georgia, 'Cormorant Garamond', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const y = N * 0.94;
    ctx.lineJoin = 'round';
    ctx.lineWidth = N * 0.035;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(text, N / 2, y);
    ctx.fillStyle = grahaArt(id).glow;
    ctx.lineWidth = N * 0.008;
    ctx.strokeStyle = '#2a2338';
    ctx.strokeText(text, N / 2, y);
    ctx.fillText(text, N / 2, y);
    const small = Math.round(N * 0.052);
    ctx.font = `600 ${small}px 'Noto Sans Devanagari', 'Nirmala UI', 'Kohinoor Devanagari', sans-serif`;
    ctx.lineWidth = N * 0.022;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText(DEVANAGARI[id], N / 2, y - fs * 0.98);
    ctx.fillStyle = '#2a2338';
    ctx.fillText(DEVANAGARI[id], N / 2, y - fs * 0.98);
  }
  return canvas;
}

/** True when this browser can write WebP (Chrome, Edge, Firefox; not Safari). */
export function canEncodeWebp(): boolean {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    return c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

/** Smallest WebP under the 100 KB that WhatsApp allows per sticker. */
async function webpUnder(canvas: HTMLCanvasElement, limit = 100_000): Promise<Blob> {
  let q = 0.9;
  let b = await canvasBlob(canvas, 'image/webp', q);
  while (b.size > limit && q > 0.35) { q -= 0.1; b = await canvasBlob(canvas, 'image/webp', q); }
  return b;
}

const README = `Graha sticker pack — Jyotisha Explorer

Nine grahas rendered in Blender for Jyotisha Explorer, as 512×512 stickers
with transparent backgrounds.

  png/   PNG files, for Telegram, Signal, iMessage and anything else
  webp/  WebP files under 100 KB each, the format WhatsApp uses
  tray.png  a 96×96 icon for the pack

Telegram: message @Stickers, send /newpack, then send each file from png/
          as a document (not as a photo).
WhatsApp: WhatsApp only imports packs through a sticker app. Open a sticker
          maker app, create a pack and add the files from webp/.
Signal:   Signal Desktop > File > Create/upload sticker pack, add the PNGs.

The artwork is part of Jyotisha Explorer and shared under the same licence
as the project (AGPL-3.0-or-later). Source: https://github.com/destinjones/vedic-astrology
`;

/** Every sticker in one .zip, with PNG and (where the browser can) WebP copies. */
export async function stickerPack(o: StickerOptions, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const entries: ZipEntry[] = [];
  const webp = canEncodeWebp();
  const bytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
  for (const [i, id] of STICKER_ORDER.entries()) {
    const c = await drawSticker(id, o);
    const slug = PLANET_BY_ID[id].sanskrit.toLowerCase();
    const n = String(i + 1).padStart(2, '0');
    entries.push({ name: `png/${n}-${slug}.png`, data: await bytes(await canvasBlob(c)) });
    if (webp) entries.push({ name: `webp/${n}-${slug}.webp`, data: await bytes(await webpUnder(c)) });
    if (id === 'sun') {
      const tray = document.createElement('canvas');
      tray.width = tray.height = 96;
      tray.getContext('2d')!.drawImage(c, 0, 0, 96, 96);
      entries.push({ name: 'tray.png', data: await bytes(await canvasBlob(tray)) });
    }
    onProgress?.(i + 1, STICKER_ORDER.length);
  }
  entries.push({ name: 'README.txt', data: new TextEncoder().encode(webp ? README : README.replace(/\n {2}webp\/.*\n/, '\n')) });
  return new Blob([zip(entries) as BlobPart], { type: 'application/zip' });
}
