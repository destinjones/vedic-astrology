import { describe, expect, it } from 'vitest';
import { computeVimshottari, createAstronomyEphemeris, PLANETS, type NatalChart, type Positions } from '@vedic/timing';
import { buildClients, matchesClient, sortClients } from '../src/lib/clients';
import { chartAlerts, dashaAlerts, reachOutText, reminderAlerts } from '../src/lib/alerts';
import { parseTab, type Tab, type Workspace } from '../src/lib/tabs';
import { mergeTab } from '../src/lib/backup';
import type { Profile } from '../src/lib/profiles';

const asha = { name: 'Asha', date: '1990-08-15', time: '06:30', place: 'New Delhi', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata', ayanamsa: 'lahiri' as const };
const ravi = { ...asha, name: 'Ravi', date: '1985-01-02', place: 'Mumbai', latitude: 19.076, longitude: 72.8777 };
const meena = { ...asha, name: 'Meena', date: '1977-03-09', place: 'Chennai', latitude: 13.0827, longitude: 80.2707 };
const tab = (patch: Partial<Tab>): Tab => ({ id: 't1', label: 'Asha', input: asha, notes: '', log: [], events: [], ...patch });
const profile = (id: string, input: typeof asha): Profile => ({ id, label: input.name, input, savedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' });

describe('client list', () => {
  it('lists open tabs, closed tabs and saved charts once per person', () => {
    const ws: Workspace = {
      tabs: [tab({ readings: [{ id: 'r1', date: '2026-10-01', summary: 'Career' }], log: [{ id: 'p1', kind: 'prediction', text: 'New job by spring', at: '2026-10-01T10:00:00Z', outcome: 'open' }] }), { id: 'blank', label: 'Chart 2', notes: '', log: [], events: [] }],
      activeId: 't1',
      archived: [tab({ id: 't2', label: 'Ravi', input: ravi, followUp: { date: '2026-11-10' } })],
    };
    const rows = buildClients(ws, [profile('a', asha), profile('m', meena)]);
    expect(rows.map((r) => [r.label, r.where])).toEqual([['Asha', 'open'], ['Ravi', 'closed'], ['Meena', 'saved']]);
    expect(rows[0].profile?.id).toBe('a');
    expect(rows[0].lastReading?.summary).toBe('Career');
    expect(rows[0].lastPrediction?.text).toBe('New job by spring');
    expect(rows[0].openPredictions).toBe(1);
    expect(sortClients(rows, 'follow-up')[0].label).toBe('Ravi');
    expect(sortClients(rows, 'name').map((r) => r.label)).toEqual(['Asha', 'Meena', 'Ravi']);
    expect(rows.filter((r) => matchesClient(r, 'career')).map((r) => r.label)).toEqual(['Asha']);
  });

  it('stores readings and follow-ups and drops bad ones', () => {
    const t = parseTab({ id: 'x', label: 'A', notes: '', log: [], events: [], readings: [{ id: 'r', date: '2026-01-02', summary: 'ok' }, { date: 'soon' }], followUp: { date: '2026-13-40' } }, 1)!;
    expect(t.readings?.map((r) => r.id)).toEqual(['r']);
    expect(t.followUp).toBeUndefined();
    expect(parseTab({ id: 'y', followUp: { date: '2026-12-01', note: 'call' } }, 1)!.followUp).toEqual({ date: '2026-12-01', note: 'call' });
  });

  it('sync joins readings from both devices and keeps the sooner follow-up', () => {
    const here = tab({ readings: [{ id: 'r1', date: '2026-01-01', summary: 'a' }], followUp: { date: '2026-12-01' } });
    const there = tab({ readings: [{ id: 'r2', date: '2026-02-01', summary: 'b' }, { id: 'r1', date: '2026-01-01', summary: 'a' }], followUp: { date: '2026-11-20', note: 'after trip' } });
    const m = mergeTab(here, there);
    expect(m.readings?.map((r) => r.id)).toEqual(['r2', 'r1']);
    expect(m.followUp).toEqual({ date: '2026-11-20', note: 'after trip' });
    expect(mergeTab(tab({}), tab({})).readings).toBeUndefined();
  });
});

describe('upcoming alerts', () => {
  it('raises follow-ups and predictions coming due, including overdue ones', () => {
    const t = tab({
      followUp: { date: '2026-11-01', note: 'Ask about the move' },
      log: [
        { id: 'p1', kind: 'prediction', text: 'Promotion', at: '2026-01-01T00:00:00Z', about: '2026-12-01', outcome: 'open' },
        { id: 'p2', kind: 'prediction', text: 'Settled already', at: '2026-01-01T00:00:00Z', about: '2026-11-15', outcome: 'came-true' },
        { id: 'p3', kind: 'prediction', text: 'Too far out', at: '2026-01-01T00:00:00Z', about: '2027-06-01', outcome: 'open' },
      ],
    });
    const a = reminderAlerts(t, new Date('2027-01-01T00:00:00Z'), '2026-11-08');
    expect(a.map((x) => [x.kind, x.title])).toEqual([['follow-up', 'Follow-up overdue'], ['prediction', 'Prediction comes due']]);
    expect(reachOutText('Asha Rao', a[0])).toMatch(/^Hi Asha,/);
  });

  // a natal chart with the Moon in Aries, born 1990
  const pos = (lon: number) => ({ longitude: lon, speed: 0.5 });
  const planets = Object.fromEntries(PLANETS.map((p) => [p, pos(100)])) as Positions;
  planets.Moon = pos(10);
  planets.Saturn = pos(285); // Capricorn
  const natal: NatalChart = { birth: new Date('1990-08-15T01:00:00Z'), ascendant: 130, planets };
  const eph = createAstronomyEphemeris();

  it('finds Saturn, Jupiter and Rahu changes for 2025 from the Moon', () => {
    const list = chartAlerts(eph, natal, [], new Date('2025-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'));
    const rising = list.find((x) => x.title.startsWith('Sade Sati begins'));
    // sidereal Saturn entered Pisces, the 12th from an Aries Moon, at the end of March 2025
    expect(rising?.date.slice(0, 7)).toBe('2025-03');
    const jup = list.find((x) => x.kind === 'jupiter' && x.title.includes('Gemini'));
    expect(jup?.date.slice(0, 7)).toBe('2025-05');
    expect(jup?.detail).toMatch(/^3rd from the Moon/);
    expect(list.some((x) => x.kind === 'nodes' && x.title.startsWith('Rahu enters Aquarius'))).toBe(true);
    expect(list.map((x) => x.date)).toEqual([...list.map((x) => x.date)].sort());
  });

  it('lists the mahadasha and antardasha changes inside the window only', () => {
    const mahas = computeVimshottari(natal);
    const all = dashaAlerts(mahas, new Date('1990-01-01T00:00:00Z'), new Date('2100-01-01T00:00:00Z'));
    const year = dashaAlerts(mahas, new Date('2030-01-01T00:00:00Z'), new Date('2031-01-01T00:00:00Z'));
    expect(all.filter((x) => x.title.includes('Mahadasha')).length).toBeGreaterThan(5);
    expect(year.length).toBeGreaterThan(0);
    expect(year.length).toBeLessThan(5);
    for (const a of year) expect(a.date >= '2030-01-01' && a.date < '2031-01-01').toBe(true);
    expect(new Set(all.map((x) => x.id)).size).toBe(all.length);
  });
});
