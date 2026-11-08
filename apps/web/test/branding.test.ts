import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BRANDING_KEY, LEGACY_BRAND_KEY, contactLine, emptyBranding, everyPdfBrand, fromLegacy, loadBranding, normaliseBranding, saveBranding, toBrand,
} from '../src/lib/branding';
import { brandFooter, brandSub } from '../src/report/types';

const store = new Map<string, string>();
const fake = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

describe('astrologer branding', () => {
  beforeEach(() => { store.clear(); (globalThis as { localStorage?: unknown }).localStorage = fake; });
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage; });

  it('starts empty, so nothing is printed until the astrologer fills it in', () => {
    const b = loadBranding();
    expect(b).toEqual(emptyBranding());
    expect(b.name).toBe('');
    expect(toBrand(b)).toBeUndefined();
    expect(everyPdfBrand(b)).toBeUndefined();
  });

  it('builds the PDF brand from the fields, skipping empty ones', () => {
    const b = { ...emptyBranding(), name: ' Asha Rao ', practice: 'Lotus Jyotish', website: 'lotusjyotish.com', email: 'asha@lotusjyotish.com', phone: '' };
    expect(contactLine(b)).toBe('lotusjyotish.com  ·  asha@lotusjyotish.com');
    const brand = toBrand(b)!;
    expect(brand).toEqual({ name: 'Asha Rao', practice: 'Lotus Jyotish', contact: 'lotusjyotish.com  ·  asha@lotusjyotish.com' });
    expect(brandSub(brand)).toBe('Lotus Jyotish');
    expect(brandFooter(brand)).toEqual(['Asha Rao, Lotus Jyotish', 'lotusjyotish.com  ·  asha@lotusjyotish.com']);
    expect(everyPdfBrand({ ...b, everyPdf: false })).toBeUndefined();
    expect(everyPdfBrand(b)?.name).toBe('Asha Rao');
  });

  it('drops malformed values and anything that is not an image logo', () => {
    const b = normaliseBranding({ name: 7, practice: 'P', logo: 'javascript:alert(1)', everyPdf: 'yes', email: 'x'.repeat(500) });
    expect(b.name).toBe('');
    expect(b.practice).toBe('P');
    expect(b.logo).toBeUndefined();
    expect(b.everyPdf).toBe(true);
    expect(b.email.length).toBe(120);
    expect(normaliseBranding({ logo: 'data:image/png;base64,AAAA' }).logo).toBe('data:image/png;base64,AAAA');
  });

  it('moves the old consultation-export details over once, sorting the contact into the right field', () => {
    expect(fromLegacy({ name: 'A', contact: 'a@b.co' }).email).toBe('a@b.co');
    expect(fromLegacy({ name: 'A', contact: '+91 98450 12345' }).phone).toBe('+91 98450 12345');
    expect(fromLegacy({ name: 'A', contact: 'https://asha.in/book' }).website).toBe('https://asha.in/book');
    expect(fromLegacy({ name: 'A', contact: 'Jayanagar, Bengaluru' }).address).toBe('Jayanagar, Bengaluru');

    store.set(LEGACY_BRAND_KEY, JSON.stringify({ name: 'Old Name', tagline: 'T', contact: 'old@site.com', logo: 'data:image/png;base64,QQ==' }));
    const b = loadBranding();
    expect(b).toMatchObject({ name: 'Old Name', tagline: 'T', email: 'old@site.com', logo: 'data:image/png;base64,QQ==' });
    saveBranding({ ...b, practice: 'New' });
    expect(store.has(LEGACY_BRAND_KEY)).toBe(false);
    expect(JSON.parse(store.get(BRANDING_KEY)!).practice).toBe('New');
    expect(loadBranding().practice).toBe('New');
  });
});
