import type { Chart } from '../types/chart';
import type { Selection } from '../types/ui';
import { PLANET_BY_ID, signInfo } from '../data/constants';
import { DIGNITY_KEY, dignityOf, dignityTone, formatDeg } from '../lib/astro';
import { useI18n } from '../i18n';

interface Props { chart: Chart; selection: Selection | null; onSelect: (s: Selection) => void }

export function PlanetTable({ chart, selection, onSelect }: Props) {
  const { t, v } = useI18n();
  const a = chart.ascendant;
  return (
    <div className="table-wrap">
      <table className="planet-table">
        <thead>
          <tr><th>{t('table.body')}</th><th>{t('table.sign')}</th><th>{t('table.degree')}</th><th>{t('table.nakshatra')}</th><th>{t('table.pada')}</th><th>{t('table.house')}</th><th>{t('table.dignity')}</th><th>{t('table.state')}</th></tr>
        </thead>
        <tbody>
          <tr className={selection?.kind === 'asc' ? 'is-selected' : ''} onClick={() => onSelect({ kind: 'asc' })}>
            <td><span className="pt-glyph" style={{ color: 'var(--accent)' }}>↑</span>{t('table.ascendant')}</td>
            <td>{signInfo(a.sign).glyph} {v.signs[a.sign - 1]}</td>
            <td className="mono">{formatDeg(a.degreeInSign)}</td>
            <td>{v.nakshatras[a.nakshatra - 1]}</td>
            <td>{a.pada}</td><td>1</td><td>—</td><td>—</td>
          </tr>
          {chart.planets.map((p) => {
            const info = PLANET_BY_ID[p.id];
            const dig = dignityOf(p.id, p.sign);
            const sel = selection?.kind === 'planet' && selection.id === p.id;
            return (
              <tr key={p.id} className={sel ? 'is-selected' : ''} onClick={() => onSelect({ kind: 'planet', id: p.id })}>
                <td><span className="pt-glyph" style={{ color: info.color }}>{info.glyph}</span>{v.planets[p.id].name}</td>
                <td>{signInfo(p.sign).glyph} {v.signs[p.sign - 1]}</td>
                <td className="mono">{formatDeg(p.degreeInSign)}</td>
                <td>
                  <button className="text-link" onClick={(e) => { e.stopPropagation(); onSelect({ kind: 'nakshatra', num: p.nakshatra }); }}>
                    {v.nakshatras[p.nakshatra - 1]}
                  </button>
                </td>
                <td>{p.pada}</td>
                <td>{p.house}</td>
                <td><span className={`chip chip-${dignityTone(dig)}`}>{v.dignity[DIGNITY_KEY[dig]]}</span></td>
                <td>
                  {p.retrograde && p.id !== 'rahu' && p.id !== 'ketu' && <span className="chip chip-mid" title={t('table.retrograde')}>{t('table.retro')}</span>}
                  {p.combust && <span className="chip chip-bad" title={t('table.combust')}>{t('table.combustShort')}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
