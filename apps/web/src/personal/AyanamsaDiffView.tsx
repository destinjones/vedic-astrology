import { useMemo } from 'react';
import { ayanamsaDiff, AYANAMSA_LABEL } from '@vedic/personal';
import type { Chart } from '../types/chart';
import { useI18n } from '../i18n';

const SIGN_SHORT = ['Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi'];
const dm = (lon: number) => {
  const d = lon % 30;
  return `${Math.floor(d)}°${String(Math.floor((d % 1) * 60)).padStart(2, '0')}′`;
};
const arcmin = (x: number) => (Math.abs(x) < 0.05 ? '0′' : `${x > 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}′`);

/** Same chart, four ayanamsas, side by side, with the arcminute deltas and every boundary crossing. */
export default function AyanamsaDiffView({ chart }: { chart: Chart }) {
  const { v } = useI18n();
  const { engine, chart: ec } = chart.engineContext!;
  const diff = useMemo(() => ayanamsaDiff(engine, ec.meta.input, chart.input.ayanamsa, undefined, ec.meta.nodeType), [engine, ec, chart.input.ayanamsa]);
  const name = (b: string) => (b === 'asc' ? 'Lagna' : v.planets[b as keyof typeof v.planets].name);
  return (
    <div className="ayd">
      <p className="muted ayd-lead">
        An ayanamsa is the offset between the tropical and sidereal zodiacs. Schools disagree about it by up to a degree and a half,
        and every sidereal longitude moves by the same amount (a smaller ayanamsa moves every planet forward), so what matters is which placements cross a line. Cells in gold
        land in a different sign, nakshatra or pada than under {AYANAMSA_LABEL[diff.base]}, the ayanamsa your chart uses.
      </p>
      <div className="ayd-scroll">
        <table className="ayd-table">
          <thead>
            <tr>
              <th scope="col"></th>
              {diff.ayanamsas.map((a) => (
                <th key={a} scope="col" className={a === diff.base ? 'is-base' : ''}>
                  {AYANAMSA_LABEL[a]}
                  <small className="mono">{diff.values[a].degrees.toFixed(4)}° {a === diff.base ? '(yours)' : arcmin(diff.values[a].deltaArcmin)}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {diff.rows.map((r) => (
              <tr key={r.body} className={r.differs ? 'is-differs' : ''}>
                <th scope="row">{name(r.body)}</th>
                {diff.ayanamsas.map((a) => {
                  const c = r.cells[a];
                  const moved = c.changes.sign || c.changes.nakshatra || c.changes.pada;
                  return (
                    <td key={a} className={`${moved ? 'is-moved' : ''} ${a === diff.base ? 'is-base' : ''}`}>
                      <span className="mono">{SIGN_SHORT[c.sign - 1]} {dm(c.longitude)}</span>
                      <small>{v.nakshatras[c.nakshatra - 1]} {c.pada}{c.changes.navamsa ? ' · new D9' : ''}</small>
                      {a !== diff.base && <small className="mono ayd-delta">{arcmin(c.deltaArcmin)}</small>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <th scope="row">First dasha change</th>
              {diff.ayanamsas.map((a) => (
                <td key={a} className={diff.dasha[a].lord !== diff.dasha[diff.base].lord ? 'is-moved' : ''}>
                  <span className="mono">{diff.dasha[a].firstChange.slice(0, 10)}</span>
                  <small>{a === diff.base ? `born in ${v.planets[diff.dasha[a].lord].name} dasha` : `${diff.dasha[a].shiftDays > 0 ? '+' : ''}${diff.dasha[a].shiftDays} days`}</small>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <ul className="ayd-notes">{diff.notes.map((n) => <li key={n}>{n}</li>)}</ul>
    </div>
  );
}
