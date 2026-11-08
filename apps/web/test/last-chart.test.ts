import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

const person = { name: 'Previous client', date: '1985-01-02', time: '03:04', place: 'Dallas', latitude: 32.7, longitude: -96.8, timezone: 'America/Chicago', ayanamsa: 'lahiri' };

describe('birth details kept for this visit only', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.stubGlobal('sessionStorage', new MemoryStorage());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('never reads the last chart from localStorage, and removes the old copy', async () => {
    localStorage.setItem('vedic.lastInput', JSON.stringify(person));
    const { readLastChart } = await import('../src/lib/lastChart');
    expect(readLastChart()).toBeNull();
    expect(localStorage.getItem('vedic.lastInput')).toBeNull();
  });

  it('keeps the last chart in sessionStorage', async () => {
    const { readLastChart, writeLastChart } = await import('../src/lib/lastChart');
    writeLastChart(person);
    expect(readLastChart()).toEqual(person);
    expect(sessionStorage.getItem('vedic.lastInput')).not.toBeNull();
    expect(localStorage.getItem('vedic.lastInput')).toBeNull();
  });

  it('clears every key older versions left in localStorage', async () => {
    for (const k of ['vedic.lastInput', 'vedic.match', 'vedic.compare.v1', 'vedic.rectify.v2']) localStorage.setItem(k, '{}');
    localStorage.setItem('vedic.profiles.v1', '[]');
    const { forgetLegacyVisitData } = await import('../src/lib/lastChart');
    forgetLegacyVisitData();
    for (const k of ['vedic.lastInput', 'vedic.match', 'vedic.compare.v1', 'vedic.rectify.v2']) expect(localStorage.getItem(k)).toBeNull();
    // saved charts are the astrologer's own and stay
    expect(localStorage.getItem('vedic.profiles.v1')).toBe('[]');
  });
});
