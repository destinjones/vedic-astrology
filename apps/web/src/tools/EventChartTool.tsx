import { useMemo, useState } from 'react';
import { castEventChart, type Chart as EngineChart, type Engine, type EventChartReading, type GrahaId } from '@vedic/engine';
import { EVENT_SIGNIFICATIONS, LIFE_EVENT_KINDS, type LifeEventKind } from '@vedic/timing';
import { loadProfiles, type Profile } from '../lib/profiles';
import { loadEvents, newEventId, saveEvents } from '../lib/lifeEvents';
import { PLANET_BY_ID, signInfo } from '../data/constants';
import { PlaceField, Planet, loadPlace, localParts, ordinal, pname, savePlace, signDeg, type Place } from './shared';

const GRAHAS: GrahaId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];
const KIND_WORD = { conjunction: 'on', opposition: 'opposite', square: 'square to', trine: 'trine to' } as const;
// South Indian layout: fixed signs, read clockwise from Pisces in the top-left
const SOUTH: (number | null)[][] = [
  [12, 1, 2, 3],
  [11, null, null, 4],
  [10, null, null, 5],
  [9, 8, 7, 6],
];

/**
 * Event chart: the sky at the moment something happened, on its own and,
 * if a saved chart is picked, against that birth chart.
 */
export function EventChartTool({ engine }: { engine: Engine }) {
  const profiles = useMemo(loadProfiles, []);
  const [place, setPlace] = useState<Place>(loadPlace);
  const init = localParts(new Date(), place.timezone);
  const [label, setLabel] = useState('');
  const [date, setDate] = useState(init.date);
  const [time, setTime] = useState(init.time);
  const [who, setWho] = useState<string>(profiles[0]?.id ?? '');
  const [res, setRes] = useState<{ reading: EventChartReading; profile?: Profile; label: string; place: Place } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const cast = () => {
    try {
      setErr(null);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}/.test(time)) throw new Error('Enter the date and time of the event.');
      const profile = profiles.find((p) => p.id === who);
      let natal: EngineChart | undefined;
      if (profile) {
        const i = profile.input;
        natal = engine.computeChart(
          { date: i.date, time: i.time, name: i.name, place: { name: i.place, latitude: i.latitude, longitude: i.longitude, timezone: i.timezone || undefined }, utcOffsetMinutes: i.utcOffsetMinutes },
          { ayanamsa: i.ayanamsa, dashaLevels: 3 },
        );
      }
      const reading = castEventChart(engine, { date, time, name: label || undefined, place: { name: place.name, latitude: place.latitude, longitude: place.longitude, timezone: place.timezone } }, natal);
      setRes({ reading, profile, label: label.trim(), place });
      requestAnimationFrame(() => document.getElementById('event-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="tools-grid">
      <section className="card tools-form">
        <h3>The moment</h3>
        <form className="birth-form" onSubmit={(e) => { e.preventDefault(); cast(); }}>
          <label className="field span-2">
            <span>What happened <small className="muted">(optional)</small></span>
            <input value={label} maxLength={120} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Wedding ceremony, signed the lease, the accident" />
          </label>
          <label className="field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
          <label className="field"><span>Time</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></label>
          <div className="span-2"><PlaceField label="Where it happened" value={place} onChange={(p) => { setPlace(p); savePlace(p); }} /></div>
          <label className="field span-2">
            <span>Read it against a birth chart</span>
            <select value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">No, just the event</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            {!profiles.length && <small className="muted">Save a chart in the chart explorer to compare against it here.</small>}
          </label>
          {err && <p className="form-error span-2" role="alert">{err}</p>}
          <button className="btn-primary span-2">Cast the event chart</button>
        </form>
        <details className="kp-explain">
          <summary>What an event chart shows</summary>
          <p>A chart for the moment something happened. On its own it shows the lagna and Moon of the moment, the classical way to read the quality of an event. Against a birth chart it shows which of the person's houses each planet was moving through, exact contacts with their natal planets and lagna, and the dasha periods they were running, down to the sookshma.</p>
          <p>It is not a Prashna (no question is asked) and not a birth chart (an event has no life of dashas to run). An exact time matters: the lagna moves a degree every four minutes.</p>
        </details>
      </section>

      {res && <EventResult {...res} />}
    </div>
  );
}

function SouthGrid({ chart }: { chart: EngineChart }) {
  const bySign = new Map<number, string[]>();
  for (const g of GRAHAS) {
    const s = chart.planets[g].sign;
    bySign.set(s, [...(bySign.get(s) ?? []), `${PLANET_BY_ID[g].abbr}${chart.planets[g].retrograde && g !== 'rahu' && g !== 'ketu' ? 'ᴿ' : ''}`]);
  }
  return (
    <div className="event-south" role="img" aria-label="Event chart, South Indian style">
      {SOUTH.flatMap((row, r) => row.map((s, c) => {
        if (s === null) return r === 1 && c === 1 ? <div key="mid" className="event-mid"><b>{signInfo(chart.ascendant.sign).name} rising</b><small>{signDeg(chart.ascendant.longitude)}</small></div> : null;
        return (
          <div key={s} className={`event-cell${chart.ascendant.sign === s ? ' is-asc' : ''}`}>
            <small>{signInfo(s).short}</small>
            <span>{chart.ascendant.sign === s && <i>As </i>}{(bySign.get(s) ?? []).join(' ')}</span>
          </div>
        );
      }))}
    </div>
  );
}

function EventResult({ reading, profile, label, place }: { reading: EventChartReading; profile?: Profile; label: string; place: Place }) {
  const { chart, natal } = reading;
  const [kind, setKind] = useState<LifeEventKind>('other');
  const [saved, setSaved] = useState(false);
  const save = () => {
    if (!profile) return;
    const list = loadEvents(profile.input);
    saveEvents(profile.input, [...list, { id: newEventId(), kind, date: chart.meta.input.date, precision: 'day', title: label || undefined, note: `Event chart: ${chart.meta.input.time.slice(0, 5)} at ${place.name}` }]);
    setSaved(true);
  };
  return (
    <>
      <section className="card" id="event-result">
        <div className="card-head"><h3>{label || 'Event chart'}</h3><span className="muted">{chart.meta.input.date} {chart.meta.input.time.slice(0, 5)} · {place.name}</span></div>
        <p>{reading.summary}</p>
        <SouthGrid chart={chart} />
      </section>

      <section className="card">
        <div className="card-head"><h3>Planets of the moment</h3></div>
        <div className="table-wrap">
        <table className="kp-table">
          <thead><tr><th>Planet</th><th>Position</th><th>Nakshatra</th><th>House</th>{natal && <th>{profile?.label}'s house</th>}</tr></thead>
          <tbody>
            <tr><td><b>Lagna</b></td><td>{signDeg(chart.ascendant.longitude)}</td><td>{chart.ascendant.nakshatraName} {chart.ascendant.pada}</td><td>1</td>{natal && <td>{ordinal(natal.lagnaHouse)}</td>}</tr>
            {GRAHAS.map((g) => {
              const p = chart.planets[g];
              return (
                <tr key={g}>
                  <td><Planet id={g} />{p.retrograde && g !== 'rahu' && g !== 'ketu' ? ' R' : ''}</td>
                  <td>{signDeg(p.longitude)}</td>
                  <td>{p.nakshatraName} {p.pada}</td>
                  <td>{p.house}</td>
                  {natal && <td>{ordinal(natal.houses[g])}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </section>

      {natal && profile && (
        <>
          <section className="card">
            <div className="card-head"><h3>Against {profile.label}'s chart</h3><span className="muted">age {natal.age.toFixed(1)}</span></div>
            <h4>Dasha periods running</h4>
            <div className="kp-plist">
              {natal.dasha.map((d, i) => (
                <span key={i} className="event-dasha"><small>{['Maha', 'Antar', 'Pratyantar', 'Sookshma'][i]}</small> <Planet id={d.lord} /> <small className="muted">{d.start.slice(0, 10)} – {d.end.slice(0, 10)}</small></span>
              ))}
            </div>
            <h4>Exact contacts with natal points</h4>
            {natal.contacts.length ? (
              <ul className="factor-list">
                {natal.contacts.slice(0, 14).map((c, i) => (
                  <li key={i} className={`factor f-${c.kind === 'trine' ? 'positive' : c.kind === 'conjunction' ? 'neutral' : 'negative'}`}>
                    <b>{pname(c.planet)} {KIND_WORD[c.kind]} natal {c.natal === 'asc' ? 'lagna' : pname(c.natal)}</b>
                    <span>{c.orb.toFixed(2)}° from exact</span>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">No planet of the moment is within a few degrees of a natal point.</p>}
          </section>
          <section className="card">
            <div className="card-head"><h3>Keep it</h3></div>
            <p className="muted">Add this to {profile.label}'s life events, so the event checker and birth time finder can use it.</p>
            <div className="kp-num-row">
              <select value={kind} onChange={(e) => { setKind(e.target.value as LifeEventKind); setSaved(false); }} aria-label="Kind of event">
                {LIFE_EVENT_KINDS.map((k) => <option key={k} value={k}>{EVENT_SIGNIFICATIONS[k].label}</option>)}
              </select>
              <button type="button" className="btn-ghost" onClick={save} disabled={saved}>{saved ? 'Saved ✓' : 'Save as a life event'}</button>
            </div>
          </section>
        </>
      )}
    </>
  );
}
