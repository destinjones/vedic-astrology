import { useMemo, useState } from 'react';
import { dashaJunctions, type Chart, type Engine } from '@vedic/engine';
import { doubleTransitWindows } from '@vedic/timing';
import { engineEphemeris, natalFromChart } from '@vedic/timing/engine';
import { PLANET_BY_ID } from '../data/constants';
import { ordinal } from '../lib/astro';

const HOUSE_TOPIC = ['self and health', 'money and family', 'effort and siblings', 'home and mother', 'children and study', 'work, illness and rivals',
  'marriage and partners', 'upheaval and research', 'fortune and teachers', 'career and standing', 'gains and friends', 'loss, travel and retreat'];
const YEAR_MS = 365.2425 * 86400000;
const day = (iso: string | Date) => new Date(iso).toISOString().slice(0, 10);
const month = (d: Date) => d.toISOString().slice(0, 7);
const pn = (id: string) => PLANET_BY_ID[id as keyof typeof PLANET_BY_ID].name;

/** Dasha sandhi and chidra, and the Saturn–Jupiter double transit windows for each house. */
export function ClassicalTiming({ engine, chart }: { engine: Engine; chart: Chart }) {
  const [now] = useState(() => Date.now());
  const junctions = useMemo(() => dashaJunctions(chart.dasha.periods).filter((j) => Date.parse(j.sandhiEnd) > Date.parse(chart.meta.utc)), [chart]);
  const [span, setSpan] = useState<[number, number]>([0, 10]);
  const [rule, setRule] = useState<'house' | 'house-or-lord'>('house');
  const windows = useMemo(() => {
    const eph = engineEphemeris(engine, { ayanamsa: chart.meta.ayanamsa, nodeType: chart.meta.nodeType });
    return doubleTransitWindows(natalFromChart(chart), eph, new Date(now + span[0] * YEAR_MS), new Date(now + span[1] * YEAR_MS), { rule });
  }, [engine, chart, span, rule]); // eslint-disable-line react-hooks/exhaustive-deps
  const byHouse = Array.from({ length: 12 }, (_, i) => windows.filter((w) => w.house === i + 1));

  return (
    <div className="ct">
      <h4 className="sb-title">Dasha sandhi and chidra</h4>
      <p className="sb-note muted">
        The sandhi is the seam between two mahadashas, here from the last pratyantar of the old one to the end of the first pratyantar of the new. The
        chidra is the last antardasha of a mahadasha. Both are held to be unsettled stretches when the old story winds down before the new one has its footing.
      </p>
      <ul className="flag-list">
        {junctions.map((j) => {
          const live = Date.parse(j.sandhiStart) <= now && now < Date.parse(j.sandhiEnd);
          const chidraLive = Date.parse(j.chidra.start) <= now && now < Date.parse(j.chidra.end);
          return (
            <li key={j.at} className={`flag ${live || chidraLive ? 'flag-hard' : 'flag-caution'}`}>
              <b>{pn(j.from)} → {pn(j.to)}</b> on {day(j.at)}
              {(live || chidraLive) && <span className="chip chip-bad pc-chip">now</span>}
              <span className="muted"> · sandhi {day(j.sandhiStart)} to {day(j.sandhiEnd)}; chidra ({pn(j.from)}–{pn(j.chidra.lord)}) {day(j.chidra.start)} to {day(j.chidra.end)}</span>
            </li>
          );
        })}
      </ul>

      <h4 className="sb-title">Saturn–Jupiter double transit</h4>
      <p className="sb-note muted">
        The classical trigger: a house delivers its events when transiting Jupiter and Saturn both touch it, by sign or aspect (K. N. Rao also counts its lord). Unlike Sade Sati,
        which follows Saturn over the Moon, this is read from the lagna for every house. It shows when a house is ripe, and the dasha says whether it will fruit.
      </p>
      <div className="seg" role="radiogroup" aria-label="Range">
        {([[0, 10, 'Next 10 years'], [-20, 0, 'Past 20 years'], [0, 30, 'Next 30 years']] as const).map(([a, b, label]) => (
          <button key={label} role="radio" aria-checked={span[0] === a && span[1] === b} className={span[0] === a && span[1] === b ? 'is-active' : ''} onClick={() => setSpan([a, b])}>{label}</button>
        ))}
      </div>
      <div className="seg" role="radiogroup" aria-label="Rule">
        <button role="radio" aria-checked={rule === 'house'} className={rule === 'house' ? 'is-active' : ''} onClick={() => setRule('house')} title="Both planets occupy or aspect the house itself">House itself</button>
        <button role="radio" aria-checked={rule === 'house-or-lord'} className={rule === 'house-or-lord' ? 'is-active' : ''} onClick={() => setRule('house-or-lord')} title="Either the house or its lord counts (K. N. Rao's wider rule)">House or its lord</button>
      </div>
      <div className="table-wrap">
        <table className="planet-table dt-table">
          <thead><tr><th scope="col">House</th><th scope="col">Windows</th></tr></thead>
          <tbody>
            {byHouse.map((ws, i) => (
              <tr key={i}>
                <th scope="row">{ordinal(i + 1)} <small className="muted">{HOUSE_TOPIC[i]}</small></th>
                <td>
                  {ws.length === 0 ? <span className="muted">none in this range</span> : ws.map((w) => {
                    const live = w.start.getTime() <= now && now < w.end.getTime();
                    return (
                      <span key={w.start.toISOString()} className={`chip ${live ? 'chip-good' : ''}`} title={`Jupiter ${w.jupiter.join(', ')}; Saturn ${w.saturn.join(', ')}`}>
                        {month(w.start)} – {month(w.end)}
                      </span>
                    );
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
