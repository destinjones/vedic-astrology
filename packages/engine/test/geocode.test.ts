import { describe, expect, it } from 'vitest';
import { geocode, placeAlias } from '../src/index';

// Tiny stand-in for the Open-Meteo geocoding API
const DB: Record<string, any[]> = {
  puducherry: [
    { name: 'Puducherry', admin1: 'Puducherry', country: 'India', latitude: 11.9339, longitude: 79.8298, population: 227411 },
  ],
  chennai: [{ name: 'Chennai', admin1: 'Tamil Nadu', country: 'India', latitude: 13.0878, longitude: 80.2785 }],
  madras: [{ name: 'Madras', admin1: 'Oregon', country: 'United States', latitude: 44.6335, longitude: -121.1295 }],
  mumbai: [{ name: 'Mumbai', admin1: 'Maharashtra', country: 'India', latitude: 19.0728, longitude: 72.8826 }],
  // GeoNames sometimes knows the old name itself: must not show twice
  bombay: [{ name: 'Mumbai', admin1: 'Maharashtra', country: 'India', latitude: 19.0728, longitude: 72.8826 }],
};

const calls: string[] = [];
const fakeFetch = (async (url: string) => {
  const name = new URL(url).searchParams.get('name')!.toLowerCase();
  calls.push(name);
  return new Response(JSON.stringify({ results: DB[name] }), { status: 200 });
}) as unknown as typeof fetch;

describe('place aliases', () => {
  it('maps former names to modern ones, ignoring case and accents', () => {
    expect(placeAlias('Pondicherry')?.modern).toBe('Puducherry');
    expect(placeAlias('Pondichéry')?.modern).toBe('Puducherry');
    expect(placeAlias('CALCUTTA')?.modern).toBe('Kolkata');
    expect(placeAlias('Bangalore')?.modern).toBe('Bengaluru');
    expect(placeAlias('Paris')).toBeUndefined();
  });

  it('matches a partly typed former name once it is unambiguous', () => {
    expect(placeAlias('Pondich')).toMatchObject({ modern: 'Puducherry', former: 'pondicherry' });
    expect(placeAlias('Bom')).toBeUndefined();
  });
});

describe('geocode with former names', () => {
  it('finds Puducherry for "Pondicherry" and says so', async () => {
    const r = await geocode('Pondicherry', { fetch: fakeFetch });
    expect(r[0].name).toBe('Puducherry, Puducherry, India');
    expect(r[0].formerly).toBe('Pondicherry');
    expect(r[0].timezone).toBe('Asia/Kolkata');
  });

  it('puts Chennai, India ahead of Madras, Oregon', async () => {
    const r = await geocode('Madras', { fetch: fakeFetch });
    expect(r.map((x) => x.name)).toEqual(['Chennai, Tamil Nadu, India', 'Madras, Oregon, United States']);
    expect(r[1].formerly).toBeUndefined();
  });

  it('does not list the same city twice', async () => {
    const r = await geocode('Bombay', { fetch: fakeFetch });
    expect(r).toHaveLength(1);
    expect(r[0].formerly).toBe('Bombay');
  });

  it('lets the part after the comma match the former name', async () => {
    const r = await geocode('Madras, oregon', { fetch: fakeFetch });
    expect(r.map((x) => x.name)).toEqual(['Madras, Oregon, United States']);
  });

  it('only makes one request for ordinary names', async () => {
    calls.length = 0;
    await geocode('Mumbai', { fetch: fakeFetch });
    expect(calls).toEqual(['mumbai']);
  });
});
