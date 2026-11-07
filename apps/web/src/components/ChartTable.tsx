import type { Chart, VargaChart } from '../types/chart';
import type { Selection } from '../types/ui';
import { PLANETS } from '../data/constants';
import { addSigns, DIGNITY_KEY, dignityOf, formatDeg, occupantsByHouse } from '../lib/astro';
import { useI18n } from '../i18n';

interface Props {
  chart: Chart;
  varga: VargaChart;
  selection: Selection | null;
  onSelect: (s: Selection) => void;
}

/**
 * The chart as plain tables: every body with its sign, house, degree and dignity, then every house
 * with its sign and occupants. It carries everything the drawing does, for screen readers,
 * for readers who prefer rows to a diagram, and for copying into notes.
 */
export function ChartTable({ chart, varga, selection, onSelect }: Props) {
  const { t, v } = useI18n();
  const isD1 = varga.id === 'D1';
  const occ = occupantsByHouse(varga);
  const who = chart.input.name || t('chart.birthChart');
  const flags = (id: (typeof PLANETS)[number]['id']) => {
    const p = chart.planets.find((x) => x.id === id)!;
    const out: string[] = [];
    if (p.retrograde && id !== 'rahu' && id !== 'ketu') out.push(t('table.retrograde'));
    if (p.combust) out.push(t('table.combust'));
    return out.join(', ') || '—';
  };
  const btn = (label: string, s: Selection, pressed: boolean) => (
    <button type="button" className="text-link" aria-pressed={pressed} onClick={() => onSelect(s)}>{label}</button>
  );

  return (
    <div className="table-wrap chart-table-wrap">
      <table className="planet-table chart-table">
        <caption>{varga.id} {v.vargas[varga.id]} · {who}. {t('table.ascendant')}: {v.signs[varga.ascSign - 1]}.</caption>
        <thead>
          <tr>
            <th scope="col">{t('table.body')}</th>
            <th scope="col">{t('table.sign')}</th>
            <th scope="col">{t('table.house')}</th>
            {isD1 && <th scope="col">{t('table.degree')}</th>}
            {isD1 && <th scope="col">{t('table.nakshatra')}</th>}
            <th scope="col">{t('table.dignity')}</th>
            {isD1 && <th scope="col">{t('table.state')}</th>}
          </tr>
        </thead>
        <tbody>
          <tr className={selection?.kind === 'asc' ? 'is-selected' : ''}>
            <th scope="row">{btn(t('table.ascendant'), { kind: 'asc' }, selection?.kind === 'asc')}</th>
            <td>{v.signs[varga.ascSign - 1]}</td>
            <td>1</td>
            {isD1 && <td className="mono">{formatDeg(chart.ascendant.degreeInSign)}</td>}
            {isD1 && <td>{v.nakshatras[chart.ascendant.nakshatra - 1]} {chart.ascendant.pada}</td>}
            <td>—</td>
            {isD1 && <td>—</td>}
          </tr>
          {PLANETS.map(({ id }) => {
            const place = varga.planets[id];
            const pos = chart.planets.find((x) => x.id === id)!;
            const sel = selection?.kind === 'planet' && selection.id === id;
            return (
              <tr key={id} className={sel ? 'is-selected' : ''}>
                <th scope="row">{btn(v.planets[id].name, { kind: 'planet', id }, sel)}</th>
                <td>{v.signs[place.sign - 1]}</td>
                <td>{place.house}</td>
                {isD1 && <td className="mono">{formatDeg(pos.degreeInSign)}</td>}
                {isD1 && <td>{v.nakshatras[pos.nakshatra - 1]} {pos.pada}</td>}
                <td>{v.dignity[DIGNITY_KEY[dignityOf(id, place.sign)]]}</td>
                {isD1 && <td>{flags(id)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>

      <table className="planet-table chart-table">
        <caption>{t('table.house')} · {t('table.sign')}</caption>
        <thead>
          <tr><th scope="col">{t('table.house')}</th><th scope="col">{t('table.sign')}</th><th scope="col">{t('table.body')}</th></tr>
        </thead>
        <tbody>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => {
            const sel = selection?.kind === 'house' && selection.num === h;
            return (
              <tr key={h} className={sel ? 'is-selected' : ''}>
                <th scope="row">{btn(`${h} · ${v.bhavas[h - 1]}`, { kind: 'house', num: h }, sel)}</th>
                <td>{v.signs[addSigns(varga.ascSign, h - 1) - 1]}</td>
                <td>{occ[h].map((id) => v.planets[id].name).join(', ') || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
