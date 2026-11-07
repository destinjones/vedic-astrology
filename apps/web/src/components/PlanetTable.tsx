import type { Chart } from '../types/chart';
import type { Selection } from '../types/ui';
import { NAKSHATRAS, PLANET_BY_ID, signInfo } from '../data/constants';
import { dignityOf, dignityTone, formatDeg } from '../lib/astro';

interface Props { chart: Chart; selection: Selection | null; onSelect: (s: Selection) => void }

export function PlanetTable({ chart, selection, onSelect }: Props) {
  const a = chart.ascendant;
  return (
    <div className="table-wrap">
      <table className="planet-table">
        <thead>
          <tr><th>Body</th><th>Sign</th><th>Degree</th><th>Nakshatra</th><th>Pada</th><th>House</th><th>Dignity</th><th>State</th></tr>
        </thead>
        <tbody>
          <tr className={selection?.kind === 'asc' ? 'is-selected' : ''} onClick={() => onSelect({ kind: 'asc' })}>
            <td><span className="pt-glyph" style={{ color: 'var(--accent)' }}>↑</span>Ascendant</td>
            <td>{signInfo(a.sign).glyph} {signInfo(a.sign).name}</td>
            <td className="mono">{formatDeg(a.degreeInSign)}</td>
            <td>{NAKSHATRAS[a.nakshatra - 1].name}</td>
            <td>{a.pada}</td><td>1</td><td>—</td><td>—</td>
          </tr>
          {chart.planets.map((p) => {
            const info = PLANET_BY_ID[p.id];
            const dig = dignityOf(p.id, p.sign);
            const sel = selection?.kind === 'planet' && selection.id === p.id;
            return (
              <tr key={p.id} className={sel ? 'is-selected' : ''} onClick={() => onSelect({ kind: 'planet', id: p.id })}>
                <td><span className="pt-glyph" style={{ color: info.color }}>{info.glyph}</span>{info.name}</td>
                <td>{signInfo(p.sign).glyph} {signInfo(p.sign).name}</td>
                <td className="mono">{formatDeg(p.degreeInSign)}</td>
                <td>
                  <button className="text-link" onClick={(e) => { e.stopPropagation(); onSelect({ kind: 'nakshatra', num: p.nakshatra }); }}>
                    {NAKSHATRAS[p.nakshatra - 1].name}
                  </button>
                </td>
                <td>{p.pada}</td>
                <td>{p.house}</td>
                <td><span className={`chip chip-${dignityTone(dig)}`}>{dig}</span></td>
                <td>
                  {p.retrograde && p.id !== 'rahu' && p.id !== 'ketu' && <span className="chip chip-mid" title="Retrograde">℞ Retro</span>}
                  {p.combust && <span className="chip chip-bad" title="Combust">Comb.</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
