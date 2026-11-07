import { useMemo } from 'react';
import { chartFlags, computeAvasthas, computeAyurdaya, type Chart } from '@vedic/engine';
import { PLANET_BY_ID } from '../data/constants';

const BALADI: Record<string, string> = { bala: 'Bala · infant', kumara: 'Kumara · youth', yuva: 'Yuva · adult', vriddha: 'Vriddha · old', mrita: 'Mrita · dead' };
const JAGRAT: Record<string, string> = { jagrat: 'Jagrat · awake', swapna: 'Swapna · dreaming', sushupti: 'Sushupti · asleep' };
const DEEPTA: Record<string, string> = {
  deepta: 'Deepta · blazing', swastha: 'Swastha · at ease', mudita: 'Mudita · delighted', shanta: 'Shanta · calm', deena: 'Deena · poor',
  duhkhita: 'Duhkhita · grieved', khala: 'Khala · wicked', kopa: 'Kopa · angry', vikala: 'Vikala · crippled',
};
const tone = (f: number) => (f >= 1 ? 'good' : f >= 0.5 ? 'mid' : 'bad');
const DEEPTA_TONE: Record<string, 'good' | 'mid' | 'bad'> = {
  deepta: 'good', swastha: 'good', mudita: 'good', shanta: 'good', deena: 'mid', duhkhita: 'bad', khala: 'bad', kopa: 'bad', vikala: 'bad',
};
const pName = (id: string) => (id === 'asc' ? 'Lagna' : PLANET_BY_ID[id as keyof typeof PLANET_BY_ID].name);

/** Avasthas, critical-degree flags and the ayurdaya arithmetic. */
export function ConditionCard({ chart }: { chart: Chart }) {
  const avasthas = useMemo(() => computeAvasthas(chart), [chart]);
  const flags = useMemo(() => chartFlags(chart), [chart]);
  const ayur = useMemo(() => computeAyurdaya(chart), [chart]);
  return (
    <section className="card" id="condition">
      <div className="card-head">
        <h3>Planet condition</h3>
        <span className="muted">avasthas and critical degrees · whether a well-placed planet can actually deliver</span>
      </div>
      <details className="sb-about">
        <summary>How the avasthas work</summary>
        <p>
          Dignity says where a planet stands; the avasthas say what state it is in. <b>Baladi</b> reads its age from the degree in the sign:
          only the adult gives its full results. <b>Jagradadi</b> says whether it is awake (own or exaltation sign), dreaming (friendly or neutral)
          or asleep (enemy or debilitated). <b>Deeptadi</b> gives nine shades of luminosity from blazing to angry, where a combust planet is angry
          whatever its sign. All three are from BPHS ch. 45.
        </p>
      </details>
      <div className="table-wrap">
        <table className="planet-table">
          <thead>
            <tr><th scope="col">Planet</th><th scope="col">Baladi</th><th scope="col">Jagradadi</th><th scope="col">Deeptadi</th><th scope="col" className="pc-hide-sm">In short</th></tr>
          </thead>
          <tbody>
            {avasthas.map((a) => {
              const info = PLANET_BY_ID[a.planet];
              return (
                <tr key={a.planet}>
                  <th scope="row"><span className="pt-glyph" style={{ color: info.color }} aria-hidden>{info.glyph}</span>{info.name}</th>
                  <td><span className={`chip chip-${tone(a.baladiFactor)}`}>{BALADI[a.baladi]}</span></td>
                  <td><span className={`chip chip-${tone(a.jagradadiFactor)}`}>{JAGRAT[a.jagradadi]}</span></td>
                  <td>
                    <span className={`chip chip-${DEEPTA_TONE[a.deeptadi]}`}>{DEEPTA[a.deeptadi]}</span>
                    {a.vikala && a.deeptadi !== 'vikala' && <span className="chip chip-bad" title="With a natural malefic in the same sign">Vikala</span>}
                  </td>
                  <td className="muted pc-hide-sm">{a.verdict}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h4 className="sb-title">Critical and nourishing degrees</h4>
      {flags.length === 0 ? (
        <p className="muted">No gandanta, abhukta mula, planetary war, mrityu bhaga or pushkara degree in this chart.</p>
      ) : (
        <ul className="flag-list">
          {flags.map((f, i) => (
            <li key={i} className={`flag flag-${f.tone}`}>
              <b>{f.title}</b>
              <span className="muted"> · {f.detail}</span>
              <small className="flag-src">{f.source}</small>
            </li>
          ))}
        </ul>
      )}

      <details className="sb-about ayur">
        <summary>Ayurdaya, the classical longevity arithmetic (read the caveat)</summary>
        <p className="ayur-caveat"><b>This is not a prediction.</b> {ayur.caveat}</p>
        <p>
          The three methods give between <b>{Math.round(ayur.range[0])}</b> and <b>{Math.round(ayur.range[1])}</b> years here. The texts then apply many more
          rules, and practitioners treat these as a starting arithmetic for study, not a figure for a person. BPHS ch. 44; Saravali ch. 40.
        </p>
        <div className="table-wrap">
          <table className="planet-table">
            <thead><tr><th scope="col">Method</th><th scope="col">Years</th><th scope="col">What reduced or raised it</th></tr></thead>
            <tbody>
              {ayur.methods.map((m) => (
                <tr key={m.method}>
                  <th scope="row">{m.method === 'pindayu' ? 'Pindayu' : m.method === 'amsayu' ? 'Amsayu' : 'Nisargayu'}</th>
                  <td className="mono">{m.years.toFixed(1)}</td>
                  <td className="muted">
                    {m.entries.filter((e) => e.notes.length).map((e) => `${pName(e.point)}: ${e.notes.join(', ')}`).join('; ') || 'No reductions'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
