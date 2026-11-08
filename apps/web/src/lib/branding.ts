/**
 * The astrologer's own branding: name, practice, contact details and logo,
 * printed on the PDF report, the consultation export, the yearly PDF and the
 * Life Chart Book. It is kept in this browser only and starts empty, so an
 * unbranded install prints nothing but the client's chart.
 */
import { useCallback, useSyncExternalStore } from 'react';
import type { Brand } from '../report/types';

export interface Branding {
  /** The astrologer's name, as it should be printed ("Asha Rao"). Empty means unbranded. */
  name: string;
  /** Practice or business name ("Lotus Jyotish"). */
  practice: string;
  /** A short line under the name ("Vedic astrologer since 2004"). */
  tagline: string;
  email: string;
  phone: string;
  website: string;
  /** Postal address or city, printed with the contact details. */
  address: string;
  /** PNG data URL, at most 480 px on its longest side. */
  logo?: string;
  /** Print the branding on the everyday PDF report and the yearly PDF too, not only on client exports. */
  everyPdf: boolean;
}

export const BRANDING_KEY = 'vedic.branding';
/** Where the consultation export kept its name, tagline, contact and logo before there was one setting. */
export const LEGACY_BRAND_KEY = 'vedic.consultBrand';
const EVENT = 'vedic:branding';

const TEXT_FIELDS = ['name', 'practice', 'tagline', 'email', 'phone', 'website', 'address'] as const;
const MAX = { name: 80, practice: 100, tagline: 140, email: 120, phone: 40, website: 160, address: 200 } as const;

export function emptyBranding(): Branding {
  return { name: '', practice: '', tagline: '', email: '', phone: '', website: '', address: '', everyPdf: true };
}

/** Keeps only well-formed fields, so a hand-edited or old value can never break an export. */
export function normaliseBranding(raw: unknown): Branding {
  const b = emptyBranding();
  if (!raw || typeof raw !== 'object') return b;
  const r = raw as Record<string, unknown>;
  for (const k of TEXT_FIELDS) if (typeof r[k] === 'string') b[k] = (r[k] as string).slice(0, MAX[k]);
  if (typeof r.logo === 'string' && /^data:image\/(png|jpe?g);base64,/.test(r.logo)) b.logo = r.logo;
  if (typeof r.everyPdf === 'boolean') b.everyPdf = r.everyPdf;
  return b;
}

/** The old single "contact" box held a website, an email or a phone number: put it in the field it looks like. */
export function fromLegacy(raw: unknown): Branding {
  const b = normaliseBranding(raw);
  const contact = raw && typeof raw === 'object' && typeof (raw as { contact?: unknown }).contact === 'string' ? (raw as { contact: string }).contact.trim() : '';
  if (contact) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) b.email = contact.slice(0, MAX.email);
    else if (/^\+?[\d\s().-]{6,}$/.test(contact)) b.phone = contact.slice(0, MAX.phone);
    else if (/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(contact)) b.website = contact.slice(0, MAX.website);
    else b.address = contact.slice(0, MAX.address);
  }
  return b;
}

export function hasBranding(b: Branding) {
  return !!b.name.trim();
}

/** "lotusjyotish.com  ·  asha@lotusjyotish.com  ·  +91 98450 12345  ·  Bengaluru" */
export function contactLine(b: Pick<Branding, 'website' | 'email' | 'phone' | 'address'>) {
  return [b.website, b.email, b.phone, b.address].map((s) => s.trim()).filter(Boolean).join('  ·  ');
}

/** What the PDF renderers take, or undefined when there is no name to print. */
export function toBrand(b: Branding): Brand | undefined {
  if (!hasBranding(b)) return undefined;
  const contact = contactLine(b);
  return {
    name: b.name.trim(),
    ...(b.practice.trim() ? { practice: b.practice.trim() } : {}),
    ...(b.tagline.trim() ? { tagline: b.tagline.trim() } : {}),
    ...(contact ? { contact } : {}),
    ...(b.logo ? { logo: b.logo } : {}),
  };
}

/** The brand for the everyday PDFs: only when the astrologer asked for it on every PDF. */
export function everyPdfBrand(b: Branding): Brand | undefined {
  return b.everyPdf ? toBrand(b) : undefined;
}

// ------------------------------------------------------------------ storage

let cache: { raw: string | null; value: Branding } | null = null;

const read = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
/** What the value was read from: the setting itself, or the old consultation-export value while there is no setting yet. */
const source = () => { const raw = read(BRANDING_KEY); return raw ?? `legacy:${read(LEGACY_BRAND_KEY) ?? ''}`; };

/** The saved branding. The same object comes back until it changes, as useSyncExternalStore needs. */
export function loadBranding(): Branding {
  const raw = source();
  if (cache && cache.raw === raw) return cache.value;
  let value: Branding;
  if (!raw.startsWith('legacy:')) {
    try { value = normaliseBranding(JSON.parse(raw)); } catch { value = emptyBranding(); }
  } else {
    let legacy: unknown = null;
    try { legacy = raw.length > 7 ? JSON.parse(raw.slice(7)) : null; } catch { /* malformed */ }
    value = legacy ? fromLegacy(legacy) : emptyBranding();
  }
  cache = { raw, value };
  return value;
}

export function saveBranding(b: Branding) {
  const value = normaliseBranding(b);
  const raw = JSON.stringify(value);
  try {
    localStorage.setItem(BRANDING_KEY, raw);
    localStorage.removeItem(LEGACY_BRAND_KEY);
  } catch { /* storage full or blocked: keep it for this visit */ }
  // if storage refused the write, keep the new value for this visit anyway
  cache = { raw: source(), value };
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

export function clearBranding() {
  saveBranding(emptyBranding());
}

function subscribe(fn: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === BRANDING_KEY || e.key === null) fn(); };
  window.addEventListener(EVENT, fn);
  window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(EVENT, fn); window.removeEventListener('storage', onStorage); };
}

/** The branding, kept in step across every dialog and tab that shows it. */
export function useBranding(): [Branding, (next: Branding | ((b: Branding) => Branding)) => void] {
  const value = useSyncExternalStore(subscribe, loadBranding, emptyBranding);
  const set = useCallback((next: Branding | ((b: Branding) => Branding)) => {
    saveBranding(typeof next === 'function' ? next(loadBranding()) : next);
  }, []);
  return [value, set];
}

/** Shrink an uploaded logo to at most 480 px and keep it as PNG, so it fits in browser storage. */
export function logoToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 480 / Math.max(img.naturalWidth || 480, img.naturalHeight || 480));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round((img.naturalWidth || 480) * k));
      cv.height = Math.max(1, Math.round((img.naturalHeight || 480) * k));
      cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not an image.')); };
    img.src = url;
  });
}
