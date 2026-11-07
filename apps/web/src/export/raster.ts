/** Turning SVG and canvases into files, downloading them and handing them to the share sheet. */
import { withFonts } from './fonts';

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export const svgBlob = (svg: string) => new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src.slice(0, 60)}`));
    img.src = src;
  });
}

/** Draws an SVG document onto a canvas at the given pixel size. */
export async function svgToCanvas(svg: string, width: number, height: number, canvas = document.createElement('canvas')): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(svgBlob(await withFonts(svg)));
  try {
    const img = await loadImage(url);
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canvasBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('This browser could not encode the image'))), type, quality));
}

export async function svgToPng(svg: string, width: number, height: number): Promise<Blob> {
  return canvasBlob(await svgToCanvas(svg, width, height));
}

/** A file name from a person's name, e.g. "asha-rao-d9.png". */
export const slug = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chart';

/** True when the browser can put this file in the system share sheet (phones, Safari, Edge). */
export function canShareFile(file: File): boolean {
  try { return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }); } catch { return false; }
}

/** Opens the share sheet with the file; returns false when the browser cannot, so the caller can download instead. */
export async function shareFile(file: File, text: string, title: string): Promise<boolean> {
  if (!canShareFile(file)) return false;
  try {
    await navigator.share({ files: [file], text, title });
  } catch (e) {
    // the person closed the sheet: that still counts as handled
    if ((e as DOMException)?.name !== 'AbortError') throw e;
  }
  return true;
}
