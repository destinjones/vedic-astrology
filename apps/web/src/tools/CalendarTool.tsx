import { useEffect, useMemo, useState } from 'react';
import { panchangaMonth, type Engine, type GrahaId, type PanchangaDay, type PanchangaDayNatal, type TimeSpan } from '@vedic/engine';
import { PLANET_BY_ID } from '../data/constants';
import { PlaceField, fmtLocal, loadPlace, loadSavedBirth, localParts, savePlace, type Place } from './shared';

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LIMB_LABEL = { tithi: 'Tithi', nakshatra: 'Nakshatra', yoga: 'Yoga', karana: 'Karana', rashi: 'Moon enters' } as const;

const t = (iso: string | undefined, tz: string) => (iso ? fmtLocal(iso, tz, { timeStyle: 'short' }) : '–');
const spanText = (s: TimeSpan | undefined, tz: string) => (s ? `${t(s.start, tz)} – ${t(s.end, tz)}` : '–');

function special(d: PanchangaDay): string | null {
  const x = d.atSunrise.tithi;
  if (x === 15) return 'Purnima';
  if (x === 30) return 'Amavasya';
  if (x === 11 || x === 26) return 'Ekadashi';
  return null;
}

export function CalendarTool({ engine }: { engine: Engine }) {
  const saved = loadSavedBirth();
  const [place, setPlace] = useState<Place>(loadPlace);
  const [month, setMonth] = useState(() => localParts(new Date(), place.timezone).date.slice(0, 7));
  const [personal, setPersonal] = useState(!!saved);
  const [sel, setSel] = useState<number | null>(null);

  const natal = useMemo<PanchangaDayNatal | null>(() => {
    if (!saved) return null;
    try {
      const c = engine.computeChart({ date: saved.date, time: saved.time, place: { latitude: saved.latitude, longitude: saved.longitude, timezone: saved.timezone } }, { vargas: ['D1'], dashaLevels: 1 });
      return { label: saved.name, moonNakshatra: c.planets.moon.nakshatra, moonSign: c.planets.moon.sign };
    } catch { return null; }
  }, [engine, saved?.date, saved?.time, saved?.latitude, saved?.longitude]); // eslint-disable-line react-hooks/exhaustive-deps

  const [y, m] = month.split('-').map(Number);
  const days = useMemo(() => {
    try {
      return panchangaMonth(engine, y, m, { latitude: place.latitude, longitude: place.longitude, timezone: place.timezone, natals: personal && natal ? [natal] : [] });
    } catch { return []; }
  }, [engine, y, m, place.latitude, place.longitude, place.timezone, personal, natal]);

  const today = localParts(new Date(), place.timezone).date;
  useEffect(() => {
    const i = days.findIndex((d) => d.date === today);
    setSel(i >= 0 ? i : 0);
  }, [days, today]);

  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  };
  const lead = days.length ? days[0].weekday : 0;
  const tz = place.timezone;
  const day = sel !== null ? days[sel] : null;

  return (
    <div className="tools-grid cal-layout">
      <section className="card tools-form">
        <h3>Panchanga calendar</h3>
        <div className="birth-form">
          <div className="span-2"><PlaceField label="Place" value={place} onChange={(p) => { setPlace(p); savePlace(p); }} /></div>
          <label className="field span-2"><span>Month</span><input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></label>
          {natal && (
            <label className="field span-2 check">
              <input type="checkbox" checked={personal} onChange={(e) => setPersonal(e.target.checked)} />
              <span>Mark Tara bala and Chandrashtama for {saved?.name || 'my saved chart'}</span>
            </label>
          )}
        </div>
        <details className="kp-explain">
          <summary>How the day is read</summary>
          <p>Each Vedic day runs from sunrise to the next sunrise. The tithi and nakshatra shown in a cell are the ones in force at sunrise, as printed panchangas give them; the day view lists every change through the day.</p>
          <p><b>Rahu kalam, Yamaganda and Gulika kalam</b> are fixed eighths of the daylight, different for each weekday. <b>Abhijit</b> is the 8th of the 15 day muhurtas, around local noon, skipped on Wednesdays. <b>Horas</b> split the day and the night into twelve each, starting with the weekday's lord and running Saturn, Jupiter, Mars, Sun, Venus, Mercury, Moon.</p>
          <p><b>Bhadra</b> is the Vishti karana; where she dwells depends on the Moon's sign. <b>Panchaka</b> marks the Moon in Aquarius and Pisces. <b>Chandrashtama</b> is the Moon in the 8th sign from your birth Moon.</p>
        </details>
      </section>

      <section className="card cal-card">
        <div className="card-head">
          <button className="btn-ghost" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <h3>{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)))}</h3>
          <button className="btn-ghost" onClick={() => shift(1)} aria-label="Next month">›</button>
        </div>
        <div className="cal-grid" role="grid" aria-label="Panchanga month">
          {WEEK.map((w) => <div key={w} className="cal-wd" role="columnheader">{w}</div>)}
          {Array.from({ length: lead }, (_, i) => <div key={`x${i}`} className="cal-empty" />)}
          {days.map((d, i) => {
            const sp = special(d);
            const p = d.personal[0];
            return (
              <button key={d.date} role="gridcell" className={`cal-day ${sel === i ? 'is-active' : ''} ${d.date === today ? 'is-today' : ''} ${d.atSunrise.paksha}`} onClick={() => setSel(i)}>
                <span className="cal-num">{Number(d.date.slice(8))}</span>
                <span className="cal-tithi">{d.atSunrise.paksha === 'shukla' ? 'S' : 'K'} {d.atSunrise.tithiName}</span>
                <span className="cal-tithi-short">{d.atSunrise.paksha === 'shukla' ? 'S' : 'K'}{((d.atSunrise.tithi - 1) % 15) + 1}</span>
                <span className="cal-nak">{d.atSunrise.nakshatraName}</span>
                <span className="cal-flags">
                  {sp && <i className="flag flag-moon" title={sp}>{sp === 'Purnima' ? '○' : sp === 'Amavasya' ? '●' : 'E'}</i>}
                  {d.bhadra.length > 0 && <i className="flag flag-bhadra" title="Bhadra (Vishti) during the day">B</i>}
                  {d.panchaka.length > 0 && <i className="flag flag-panchaka" title="Panchaka during the day">P</i>}
                  {p && p.chandrashtama.length > 0 && <i className="flag flag-c8" title="Chandrashtama">8</i>}
                  {p && [3, 5, 7].includes(p.tara.number) && <i className="flag flag-tara" title={`${p.tara.name} tara at sunrise`}>T</i>}
                </span>
              </button>
            );
          })}
        </div>
        <p className="muted small cal-key">○ Purnima · ● Amavasya · E Ekadashi · B Bhadra · P Panchaka{personal && natal ? ' · 8 Chandrashtama · T harmful tara' : ''}</p>
      </section>

      {day && <DayDetail d={day} tz={tz} />}
    </div>
  );
}

function DayDetail({ d, tz }: { d: PanchangaDay; tz: string }) {
  const now = Date.now();
  const p = d.personal[0];
  return (
    <section className="card span-all">
      <div className="card-head">
        <h3>{fmtLocal(d.sunrise ?? `${d.date}T12:00:00Z`, tz, { dateStyle: 'full' })}</h3>
        <span className="muted">{d.weekdayName} · day lord {PLANET_BY_ID[d.dayLord].name}</span>
      </div>
      {!d.hasSunrise && <p className="muted">The Sun does not rise and set here today, so the day periods and horas are left out.</p>}
      <div className="cal-detail">
        <div>
          <h4>Sun and day periods</h4>
          <table className="kp-table cal-table">
            <tbody>
              <tr><th>Sunrise</th><td>{t(d.sunrise, tz)}</td></tr>
              <tr><th>Sunset</th><td>{t(d.sunset, tz)}</td></tr>
              <tr className="bad"><th>Rahu kalam</th><td>{spanText(d.rahuKalam, tz)}</td></tr>
              <tr className="bad"><th>Yamaganda</th><td>{spanText(d.yamaganda, tz)}</td></tr>
              <tr className="mid"><th>Gulika kalam</th><td>{spanText(d.gulikaKalam, tz)}</td></tr>
              <tr className="good"><th>Abhijit</th><td>{d.abhijit ? spanText(d.abhijit, tz) : 'not on Wednesdays'}</td></tr>
              {d.bhadra.map((b, i) => <tr key={i} className={b.loka === 'earth' ? 'bad' : 'mid'}><th>Bhadra</th><td>{spanText(b, tz)} <small className="muted">({b.loka === 'earth' ? 'on earth, harmful' : `in ${b.loka === 'heaven' ? 'heaven' : 'the netherworld'}`})</small></td></tr>)}
              {d.panchaka.map((b, i) => <tr key={`p${i}`} className="mid"><th>Panchaka</th><td>{spanText(b, tz)}</td></tr>)}
              {p && <tr className={[3, 5, 7].includes(p.tara.number) ? 'bad' : 'good'}><th>Tara at sunrise</th><td>{p.tara.name} ({p.tara.number})</td></tr>}
              {p?.chandrashtama.map((b, i) => <tr key={`c${i}`} className="bad"><th>Chandrashtama</th><td>{spanText(b, tz)}</td></tr>)}
            </tbody>
          </table>
        </div>
        <div>
          <h4>The five limbs at sunrise</h4>
          <table className="kp-table cal-table">
            <tbody>
              <tr><th>Tithi</th><td>{d.atSunrise.paksha === 'shukla' ? 'Shukla' : 'Krishna'} {d.atSunrise.tithiName}</td></tr>
              <tr><th>Nakshatra</th><td>{d.atSunrise.nakshatraName}</td></tr>
              <tr><th>Yoga</th><td>{d.atSunrise.yogaName}</td></tr>
              <tr><th>Karana</th><td>{d.atSunrise.karanaName}</td></tr>
              <tr><th>Moon</th><td>{d.atSunrise.moonSignName}</td></tr>
            </tbody>
          </table>
          <h4 className="cal-sub">Changes until the next sunrise</h4>
          <table className="kp-table cal-table">
            <tbody>
              {d.changes.length === 0 && <tr><td className="muted">None</td></tr>}
              {d.changes.map((c) => <tr key={`${c.limb}${c.atJd}`}><th>{t(c.at, tz)}</th><td>{LIMB_LABEL[c.limb]} {c.name}</td></tr>)}
            </tbody>
          </table>
        </div>
        {d.horas.length > 0 && (
          <div>
            <h4>Horas</h4>
            <ol className="hora-list">
              {d.horas.map((h, i) => {
                const on = now >= new Date(h.start).getTime() && now < new Date(h.end).getTime();
                const info = PLANET_BY_ID[h.lord as GrahaId];
                return (
                  <li key={i} className={`${h.day ? 'day' : 'night'} ${on ? 'is-now' : ''}`}>
                    <span className="mono">{t(h.start, tz)}</span>
                    <span style={{ color: info.color }}>{info.glyph} {info.name}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
