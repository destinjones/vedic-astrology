import { useEffect, useMemo, useState } from 'react';
import type { Chart, DashaPeriod } from '../types/chart';
import type { Profile } from '../lib/profiles';
import { computeChart } from '../engine';
import { useI18n } from '../i18n';
import { birthQuality } from '../lib/birthQuality';
import { downloadText } from '../lib/backup';

interface Props {
  profiles: Profile[];
  busy: boolean;
  onOpen: (p: Profile) => void;
  onClose: () => void;
}

interface Row {
  p: Profile;
  chart?: Chart;
  error?: boolean;
}

type SortKey = 'label' | 'date' | 'lagna' | 'moon' | 'nakshatra' | 'dasha' | 'rodden';

const running = (list: DashaPeriod[] | undefined, at: number) =>
  list?.find((d) => Date.parse(d.start) <= at && at < Date.parse(d.end));

/** Every saved chart in one table: the facts a consultant scans a client list for. */
export function BatchView({ profiles, busy, onOpen, onClose }: Props) {
  const { v } = useI18n();
  const [rows, setRows] = useState<Row[]>(() => profiles.map((p) => ({ p })));
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'label', dir: 1 });
  const [now] = useState(() => Date.now());

  // one chart at a time keeps the page responsive with a long client list
  useEffect(() => {
    let live = true;
    setRows(profiles.map((p) => ({ p })));
    (async () => {
      for (let i = 0; i < profiles.length && live; i++) {
        try {
          const chart = await computeChart(profiles[i].input);
          if (live) setRows((r) => r.map((x, j) => (j === i ? { ...x, chart } : x)));
        } catch {
          if (live) setRows((r) => r.map((x, j) => (j === i ? { ...x, error: true } : x)));
        }
        await new Promise((res) => setTimeout(res, 0));
      }
    })();
    return () => { live = false; };
  }, [profiles]);

  const cells = (r: Row) => {
    const c = r.chart;
    const moon = c?.planets.find((x) => x.id === 'moon');
    const sun = c?.planets.find((x) => x.id === 'sun');
    const md = running(c?.dasha, now);
    const ad = running(md?.sub, now);
    return {
      lagna: c ? v.signs[c.ascendant.sign - 1] : '',
      moon: moon ? v.signs[moon.sign - 1] : '',
      sun: sun ? v.signs[sun.sign - 1] : '',
      nakshatra: moon ? `${v.nakshatras[moon.nakshatra - 1]} ${moon.pada}` : '',
      dasha: md ? `${v.planets[md.lord].name}${ad ? ` / ${v.planets[ad.lord].name}` : ''}` : '',
      dashaEnds: ad?.end.slice(0, 10) ?? md?.end.slice(0, 10) ?? '',
      quality: birthQuality(r.p.input)?.level ?? 'good',
    };
  };

  const sorted = useMemo(() => {
    const val = (r: Row): string => {
      const c = cells(r);
      switch (sort.key) {
        case 'label': return r.p.label.toLowerCase();
        case 'date': return r.p.input.date;
        case 'rodden': return r.p.input.rodden ?? 'ZZ';
        default: return c[sort.key];
      }
    };
    return [...rows].sort((a, b) => val(a).localeCompare(val(b)) * sort.dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort, v]);

  const head = (key: SortKey, label: string) => (
    <th aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }))}>
      {label}{sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  );
  const done = rows.filter((r) => r.chart || r.error).length;
  const csv = () => {
    const lines = [['Name', 'Date', 'Time', 'Place', 'Rodden', 'Lagna', 'Moon', 'Nakshatra', 'Sun', 'Dasha now', 'Until'].join(',')];
    for (const r of sorted) {
      const c = cells(r);
      lines.push([r.p.label, r.p.input.date, r.p.input.time, r.p.input.place, r.p.input.rodden ?? '', c.lagna, c.moon, c.nakshatra, c.sun, c.dasha, c.dashaEnds]
        .map((x) => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(','));
    }
    downloadText(lines.join('\r\n'), `jyotisha-batch-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <section className="card batch-card" id="batch">
      <div className="card-head">
        <h3>All saved charts</h3>
        <span className="muted">{done < rows.length ? `working out ${done + 1} of ${rows.length}…` : `${rows.length} charts · dashas as of today`}</span>
        <span className="data-row">
          <button type="button" className="btn-ghost sm" onClick={csv} disabled={done < rows.length}>Download table</button>
          <button type="button" className="btn-ghost sm" onClick={onClose}>Close</button>
        </span>
      </div>
      <div className="batch-scroll">
        <table className="batch-table">
          <thead>
            <tr>
              {head('label', 'Name')}{head('date', 'Born')}{head('rodden', 'Rodden')}{head('lagna', 'Lagna')}{head('moon', 'Moon')}
              {head('nakshatra', 'Nakshatra')}<th>Sun</th>{head('dasha', 'Dasha now')}<th>Until</th><th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const c = cells(r);
              return (
                <tr key={r.p.id}>
                  <td><b>{r.p.label}</b></td>
                  <td>{r.p.input.date} {r.p.input.time.slice(0, 5)}</td>
                  <td className={c.quality === 'poor' ? 'rr-poor' : c.quality !== 'good' ? 'rr-caution' : ''} title={birthQuality(r.p.input)?.title}>{r.p.input.rodden ?? '—'}</td>
                  {r.error ? <td colSpan={6} className="muted">could not be worked out</td> : <>
                    <td>{c.lagna}</td><td>{c.moon}</td><td>{c.nakshatra}</td><td>{c.sun}</td><td>{c.dasha}</td><td className="muted">{c.dashaEnds}</td>
                  </>}
                  <td><button type="button" className="btn-ghost sm" disabled={busy} onClick={() => onOpen(r.p)}>Open</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
