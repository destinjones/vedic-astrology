import type { PlanetId } from '../types/chart';
import { ART, grahaArt, nakshatraArt, rashiArt } from '../data/art';
import { C } from './theme';

/** An image ready for jsPDF: a JPEG data URL plus its pixel size and a stable alias so it is embedded once. */
export interface Img { data: string; w: number; h: number; alias: string }

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

interface Prep {
  /** Longest side in pixels. */
  max: number;
  /** Background the transparent parts are flattened onto. */
  bg?: string;
  quality?: number;
  /** Rotate clockwise by this many degrees (square images). */
  rotate?: number;
  /** Crop to a centred square of this fraction of the shorter side. */
  crop?: { x: number; y: number; w: number; h: number };
}

/**
 * Downscale (and flatten) a webp from the art set into a JPEG. JPEG keeps the
 * PDF small; the artwork is flattened onto the colour of the page it sits on.
 */
async function prepare(url: string, alias: string, p: Prep): Promise<Img> {
  const img = await load(url);
  const src = p.crop
    ? { x: p.crop.x * img.naturalWidth, y: p.crop.y * img.naturalHeight, w: p.crop.w * img.naturalWidth, h: p.crop.h * img.naturalHeight }
    : { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
  const s = Math.min(1, p.max / Math.max(src.w, src.h));
  const w = Math.round(src.w * s);
  const h = Math.round(src.h * s);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  g.fillStyle = p.bg ?? C.night;
  g.fillRect(0, 0, w, h);
  g.imageSmoothingQuality = 'high';
  if (p.rotate) {
    g.translate(w / 2, h / 2);
    g.rotate((p.rotate * Math.PI) / 180);
    g.translate(-w / 2, -h / 2);
  }
  g.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, w, h);
  return { data: cv.toDataURL('image/jpeg', p.quality ?? 0.86), w, h, alias };
}

export interface ReportArt {
  hero: Img;
  cosmos: Img;
  wheelHero: Img;
  /** Wheel plate rotated so the ascendant sits at 9 o'clock, on paper. */
  wheel: Img;
  graha: Record<PlanetId, Img>;
  /** Medallions, flattened onto `bg` (paper by default). */
  rashi: (sign: number, bg?: string) => Promise<Img>;
  nakshatra: (num: number, bg?: string) => Promise<Img>;
}

const IDS: PlanetId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];

export async function loadArt(ascendant: number): Promise<ReportArt> {
  const memo = new Map<string, Promise<Img>>();
  const once = (key: string, f: () => Promise<Img>) => { if (!memo.has(key)) memo.set(key, f()); return memo.get(key)!; };
  const [hero, cosmos, wheelHero, wheel, ...g] = await Promise.all([
    prepare(ART.heroDesktop, 'hero', { max: 1800, quality: 0.84 }),
    prepare(ART.cosmosDesktop, 'cosmos', { max: 1400, quality: 0.8, crop: { x: 0.1, y: 0.15, w: 0.8, h: 0.5 } }),
    prepare(ART.wheelHero, 'wheel-hero', { max: 1400, bg: C.night }),
    prepare(ART.wheelTop, 'wheel', { max: 1500, bg: C.paper, rotate: ascendant - 180, quality: 0.88 }),
    ...IDS.map((id) => prepare(grahaArt(id).image, `graha-${id}`, { max: 420, bg: C.night })),
  ]);
  return {
    hero, cosmos, wheelHero, wheel,
    graha: Object.fromEntries(IDS.map((id, i) => [id, g[i]])) as Record<PlanetId, Img>,
    rashi: (s, bg = C.paper) => once(`r${s}${bg}`, () => prepare(rashiArt(s), `rashi-${s}-${bg}`, { max: 360, bg })),
    nakshatra: (n, bg = C.paper) => once(`n${n}${bg}`, () => prepare(nakshatraArt(n), `nak-${n}-${bg}`, { max: 360, bg })),
  };
}
