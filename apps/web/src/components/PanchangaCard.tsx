import { useMemo, useState } from 'react';
import { localToUtc, panchangaAt, type Chart, type Engine, type PanchangaAt } from '@vedic/engine';
import { PLANET_BY_ID } from '../data/constants';

const VARA_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmtIn(tz: string, iso: string | undefined, withDate = true) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      ...(withDate ? { day: 'numeric', month: 'short' } : {}),
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace('T', ' ');
  }
}

function localNow(tz: string): { date: string; time: string } {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date());
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
    return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${g('hour')}:${g('minute')}` };
  } catch {
    const d = new Date().toISOString();
    return { date: d.slice(0, 10), time: d.slice(11, 16) };
  }
}

function Limbs({ p, tz }: { p: PanchangaAt; tz: string }) {
  const rows: [string, string, string, string, string][] = [
    ['Tithi', `${p.paksha === 'shukla' ? 'Shukla' : 'Krishna'} ${p.tithiName}`, `${p.tithi > 15 ? p.tithi - 15 : p.tithi} of 15`, p.spans.tithi.end, p.next.tithiName],
    ['Vara', p.varaName, `${VARA_EN[p.vara]}, ruled by ${PLANET_BY_ID[p.varaLord].name}`, '', ''],
    ['Nakshatra', p.nakshatraName, `${p.nakshatra} of 27`, p.spans.nakshatra.end, p.next.nakshatraName],
    ['Yoga', p.yogaName, `${p.yoga} of 27`, p.spans.yoga.end, p.next.yogaName],
    ['Karana', p.karanaName, `half-tithi ${p.karana} of 60`, p.spans.karana.end, p.next.karanaName],
  ];
  return (
    <div className="table-wrap">
      <table className="planet-table pc-table">
        <thead><tr><th scope="col">Limb</th><th scope="col">In force</th><th scope="col">Until</th><th scope="col" className="pc-hide-sm">Then</th></tr></thead>
        <tbody>
          {rows.map(([k, val, which, end, next]) => (
            <tr key={k}>
              <th scope="row">{k}</th>
              <td>
                <b>{val}</b>{k === 'Karana' && p.karanaName === 'Vishti' && <span className="chip chip-bad pc-chip" title="Vishti karana, avoided for new beginnings">Bhadra</span>}
                <small className="pc-which muted">{which}</small>
              </td>
              <td className="mono pc-until">{end ? <><span>{fmtIn(tz, end, true).split(', ')[0]},</span> <span>{fmtIn(tz, end, false)}</span></> : k === 'Vara' ? 'next sunrise' : '—'}</td>
              <td className="muted pc-hide-sm">{next}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The five limbs for the birth moment, and for any date at the birth place. */
export function PanchangaCard({ engine, chart }: { engine: Engine; chart: Chart }) {
  const tz = chart.meta.timezone;
  const place = { latitude: chart.meta.input.place.latitude, longitude: chart.meta.input.place.longitude, ayanamsa: chart.meta.ayanamsa };
  const birth = useMemo(() => panchangaAt(engine, chart.meta.jdUt, place), [engine, chart]); // eslint-disable-line react-hooks/exhaustive-deps
  const [when, setWhen] = useState(() => localNow(tz));
  const any = useMemo(() => {
    try {
      const t = localToUtc(when.date, when.time || '12:00', tz, undefined, place.longitude);
      return panchangaAt(engine, t.utc, place);
    } catch {
      return null;
    }
  }, [engine, when, tz]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="card" id="panchanga">
      <div className="card-head">
        <h3>Panchanga</h3>
        <span className="muted">tithi, vara, nakshatra, yoga and karana · times in {tz}</span>
      </div>
      <div className="pc-grid">
        <div>
          <h4 className="sb-title">At birth</h4>
          <p className="sb-note muted">Sunrise {fmtIn(tz, birth.sunrise, false)}, sunset {fmtIn(tz, birth.sunset, false)}. The vara is the weekday of the sunrise before birth, so a birth before dawn keeps the previous day.</p>
          <Limbs p={birth} tz={tz} />
        </div>
        <div>
          <h4 className="sb-title">On any date</h4>
          <div className="pc-pick">
            <label className="field">Date <input type="date" value={when.date} onChange={(e) => setWhen({ ...when, date: e.target.value })} /></label>
            <label className="field">Time <input type="time" value={when.time} onChange={(e) => setWhen({ ...when, time: e.target.value })} /></label>
            <button type="button" className="btn-ghost" onClick={() => setWhen(localNow(tz))}>Now</button>
          </div>
          <p className="sb-note muted">At {chart.meta.input.place.name ?? 'the birth place'}{any ? `. Sunrise ${fmtIn(tz, any.sunrise, false)}, sunset ${fmtIn(tz, any.sunset, false)}.` : '.'}</p>
          {any ? <Limbs p={any} tz={tz} /> : <p className="muted">Enter a date to see its panchanga.</p>}
        </div>
      </div>
    </section>
  );
}
