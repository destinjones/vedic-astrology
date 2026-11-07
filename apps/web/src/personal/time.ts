/** Local date and time `minutes` away from the recorded one, as plain strings. */
export function shiftLocal(date: string, time: string, minutes: number): { date: string; time: string } {
  const [h, m, s = '0'] = time.split(':');
  const t = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), +h, +m, +s) + minutes * 60_000;
  const iso = new Date(t).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}
