import { useEffect, useMemo, useRef, useState } from 'react';
import type { BirthInput, Chart, DashaPeriod, PlanetId, VargaId } from '../types/chart';
import type { ChartStyle, Selection } from '../types/ui';
import type { SynastryReport, HouseOverlay, CrossContact } from '@vedic/interpretations';
import { computeChart } from '../engine';
import { BirthForm } from '../components/BirthForm';
import { NorthChart } from '../components/NorthChart';
import { SouthChart } from '../components/SouthChart';
import { VargaSwitcher } from '../components/VargaSwitcher';
import type { ChartOverlay } from '../components/chartShared';
import { NAKSHATRAS, PLANETS, PLANET_BY_ID, signInfo } from '../data/constants';
import { dignityOf, dignityTone, getVarga, houseOf, ordinal } from '../lib/astro';
import { TrustFooter } from '../trust/TrustFooter';
import {
  COUNTRY_NAMES, birthParams, compareHash, famousCharts, parseCompareHash, parsePastedLink, sameBirth, savedCharts,
  toChartInput, type SourceChart,
} from './sources';

const MAX = 4;
const STORE_KEY = 'vedic.compare.v1';
const LETTERS = ['A', 'B', 'C', 'D'];
const SLOT_COLORS = ['#e8b65a', '#b48cff', '#5ec8ff', '#ff8fa3'];

interface Entry {
  key: string;
  input: BirthInput;
  chart: Chart | null;
  error?: string;
}

const nameOf = (i: BirthInput, n: number) => i.name?.trim() || `Chart ${LETTERS[n]}`;
const entryKey = (i: BirthInput) => `${i.date}T${i.time}@${i.latitude.toFixed(3)},${i.longitude.toFixed(3)}/${i.ayanamsa}`;

function loadStored(): BirthInput[] {
  const fromHash = parseCompareHash(location.hash).inputs;
  if (fromHash.length) return fromHash.slice(0, MAX);
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((r) => parsePastedLink('#' + String(r)).inputs).slice(0, MAX);
  } catch { return []; }
}

/** The running maha and antar dasha on a date. */
function currentDasha(d: DashaPeriod[] | undefined, at = new Date()): string {
  if (!d) return '—';
  const t = at.toISOString();
  const maha = d.find((p) => p.start <= t && t < p.end);
  if (!maha) return '—';
  const antar = maha.sub?.find((p) => p.start <= t && t < p.end);
  return `${PLANET_BY_ID[maha.lord].name}${antar ? ` / ${PLANET_BY_ID[antar.lord].name}` : ''}`;
}

export default function CompareApp() {
  const [entries, setEntries] = useState<Entry[]>(() => loadStored().map((input) => ({ key: entryKey(input), input, chart: null })));
  const [adding, setAdding] = useState(entries.length < 2);
  const [style, setStyle] = useState<ChartStyle>('north');
  const [vargaId, setVargaId] = useState<VargaId>('D1');
  const [hover, setHover] = useState<PlanetId | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);

  // Compute any chart that has not been computed yet.
  useEffect(() => {
    for (const e of entries) {
      if (e.chart || e.error) continue;
      computeChart(e.input).then(
        (chart) => setEntries((list) => list.map((x) => (x.key === e.key ? { ...x, chart } : x))),
        (err) => setEntries((list) => list.map((x) => (x.key === e.key ? { ...x, error: String(err) } : x))),
      );
    }
  }, [entries]);

  // Keep the URL and storage in step, so the page can be bookmarked or shared.
  useEffect(() => {
    const inputs = entries.map((e) => e.input);
    history.replaceState(null, '', location.pathname + location.search + compareHash(inputs));
    try { localStorage.setItem(STORE_KEY, JSON.stringify(inputs.map(birthParams))); } catch { /* ignore */ }
  }, [entries]);

  // `#famous=<id>` or `#f=<id>` links add a chart from the library.
  const [famousIds] = useState(() => parseCompareHash(location.hash).famous);
  useEffect(() => {
    const ids = famousIds;
    if (!ids.length) return;
    void famousCharts().then((list) => {
      for (const id of ids) {
        const hit = list.find((f) => f.id === `famous:${id}`);
        if (hit) add(hit.input);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = (input: BirthInput) => {
    setEntries((list) => {
      if (list.length >= MAX || list.some((e) => sameBirth(e.input, input))) return list;
      const next = [...list, { key: entryKey(input), input, chart: null }];
      if (next.length >= 2) setAdding(false);
      return next;
    });
  };
  const remove = (key: string) => setEntries((list) => list.filter((e) => e.key !== key));
  const move = (key: string, dir: -1 | 1) => setEntries((list) => {
    const i = list.findIndex((e) => e.key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const ready = entries.filter((e): e is Entry & { chart: Chart } => !!e.chart);

  return (
    <div className="app compare-app">
      <div className="starfield" aria-hidden />
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <span className="brand-mark">✦</span>
          <div>
            <h1>Compare charts</h1>
            <p>Side by side, and one chart read against another</p>
          </div>
        </a>
        <a className="btn-ghost" href={`${import.meta.env.BASE_URL}app/`}>Open the explorer</a>
      </header>

      <section className="card cmp-picker">
        <div className="card-head">
          <h3>Charts</h3>
          <span className="muted">{entries.length} of {MAX}</span>
        </div>
        <div className="cmp-slots">
          {entries.map((e, n) => (
            <div key={e.key} className="cmp-slot" style={{ '--slot': SLOT_COLORS[n] } as React.CSSProperties}>
              <span className="cmp-letter">{LETTERS[n]}</span>
              <div className="cmp-slot-text">
                <b>{nameOf(e.input, n)}</b>
                <small className="muted">{e.input.date} · {e.input.time} · {e.input.place}</small>
              </div>
              <div className="cmp-slot-actions">
                <button className="icon-btn" aria-label={`Move ${nameOf(e.input, n)} left`} disabled={n === 0} onClick={() => move(e.key, -1)}>‹</button>
                <button className="icon-btn" aria-label={`Move ${nameOf(e.input, n)} right`} disabled={n === entries.length - 1} onClick={() => move(e.key, 1)}>›</button>
                <button className="icon-btn" aria-label={`Remove ${nameOf(e.input, n)}`} onClick={() => remove(e.key)}>×</button>
              </div>
            </div>
          ))}
          {entries.length < MAX && (
            <button className={`cmp-slot cmp-add${adding ? ' is-open' : ''}`} onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
              <span className="cmp-letter">+</span>
              <b>Add a chart</b>
            </button>
          )}
        </div>
        {adding && entries.length < MAX && <AddPanel onAdd={add} taken={entries.map((e) => e.input)} />}
      </section>

      {entries.length === 0 && (
        <p className="cmp-empty muted">Pick two or more charts above: from your saved charts, the famous charts library, a share link, or new birth details.</p>
      )}

      {entries.length > 0 && (
        <>
          <section className="card">
            <div className="card-head">
              <h3>Side by side</h3>
              <div className="seg" role="radiogroup" aria-label="Chart style">
                <button role="radio" aria-checked={style === 'north'} className={style === 'north' ? 'is-active' : ''} onClick={() => setStyle('north')}>North</button>
                <button role="radio" aria-checked={style === 'south'} className={style === 'south' ? 'is-active' : ''} onClick={() => setStyle('south')}>South</button>
              </div>
            </div>
            <VargaSwitcher value={vargaId} onChange={setVargaId} />
            <div className={`cmp-grid cmp-n${entries.length}`} onMouseLeave={() => setHover(null)}>
              {entries.map((e, n) => (
                <figure key={e.key} className="cmp-chart" style={{ '--slot': SLOT_COLORS[n] } as React.CSSProperties}>
                  <figcaption>
                    <span className="cmp-letter">{LETTERS[n]}</span>
                    <b>{nameOf(e.input, n)}</b>
                    {e.chart && <small className="muted">{signInfo(e.chart.ascendant.sign).name} Lagna · Moon in {signInfo(e.chart.planets.find((p) => p.id === 'moon')!.sign).name}</small>}
                  </figcaption>
                  {e.chart ? (
                    style === 'north'
                      ? <NorthChart chart={e.chart} varga={getVarga(e.chart, vargaId)} selection={selection} hoverPlanet={hover} onSelect={setSelection} onHoverPlanet={setHover} />
                      : <SouthChart chart={e.chart} varga={getVarga(e.chart, vargaId)} selection={selection} hoverPlanet={hover} onSelect={setSelection} onHoverPlanet={setHover} />
                  ) : e.error ? <p className="form-error">Could not calculate this chart.</p> : <div className="cmp-loading muted">Calculating…</div>}
                </figure>
              ))}
            </div>
            <p className="legend muted">Hover a planet in any chart to see where it aspects in every chart. Click a planet to highlight it everywhere.</p>
          </section>

          {ready.length >= 2 && <CompareTable entries={entries} vargaId={vargaId} highlight={selection?.kind === 'planet' ? selection.id : hover} />}

          {ready.length >= 2 && <SynastrySection entries={entries} style={style} />}
        </>
      )}

      <footer className="foot muted">
        <p>Sidereal zodiac · whole-sign houses. Synastry readings are for reflection, not a verdict on any relationship.</p>
        <p>Your birth details stay in this browser; the page link carries them in the part after #, which is never sent to a server. Free software under <a href="https://github.com/destinjones/vedic-astrology/blob/main/LICENSE">AGPL-3.0</a>: <a href="https://github.com/destinjones/vedic-astrology">get the source</a>.</p>
        <TrustFooter />
      </footer>
    </div>
  );
}

/* ---------- adding charts ---------- */

type AddTab = 'saved' | 'famous' | 'new' | 'link';

const BLANK: BirthInput = { name: '', date: '1990-01-01', time: '12:00', place: 'New Delhi, India', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata', ayanamsa: 'lahiri' };

function AddPanel({ onAdd, taken }: { onAdd: (i: BirthInput) => void; taken: BirthInput[] }) {
  const saved = useMemo(() => savedCharts(), []);
  const [tab, setTab] = useState<AddTab>(saved.length ? 'saved' : 'famous');
  const [famous, setFamous] = useState<SourceChart[] | null>(null);
  const [q, setQ] = useState('');
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState('');

  useEffect(() => { void famousCharts().then(setFamous, () => setFamous([])); }, []);

  const isTaken = (i: BirthInput) => taken.some((t) => sameBirth(t, i));
  const famousShown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (famous ?? []).filter((f) => !s || `${f.label} ${f.sub ?? ''} ${f.input.place}`.toLowerCase().includes(s));
  }, [famous, q]);
  const groups = useMemo(() => {
    const g = new Map<string, SourceChart[]>();
    for (const f of famousShown) {
      const k = f.group ?? '';
      g.set(k, [...(g.get(k) ?? []), f]);
    }
    return [...g.entries()];
  }, [famousShown]);

  const tabs: [AddTab, string][] = [['saved', 'Saved'], ['famous', 'Famous'], ['new', 'New details'], ['link', 'Share link']];

  return (
    <div className="cmp-add-panel">
      <div className="seg cmp-tabs" role="tablist" aria-label="Where to add a chart from">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'saved' && (
        saved.length ? (
          <ul className="cmp-list">
            {saved.map((s) => <SourceRow key={s.id} s={s} taken={isTaken(s.input)} onAdd={onAdd} />)}
          </ul>
        ) : <p className="muted">No saved charts yet. Charts you save in the explorer, and the one you opened last, show up here.</p>
      )}

      {tab === 'famous' && (
        famous === null ? <p className="muted">Loading…</p> : famous.length === 0 ? (
          <p className="muted">The famous charts library is not part of this build yet.</p>
        ) : (
          <>
            <input className="cmp-search" type="search" placeholder="Search by name, field or place" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search famous charts" />
            <div className="cmp-famous">
              {groups.map(([g, list]) => (
                <div key={g}>
                  {g && <h4>{COUNTRY_NAMES[g] ?? g}</h4>}
                  <ul className="cmp-list">{list.map((s) => <SourceRow key={s.id} s={s} taken={isTaken(s.input)} onAdd={onAdd} />)}</ul>
                </div>
              ))}
              {!famousShown.length && <p className="muted">No match.</p>}
            </div>
          </>
        )
      )}

      {tab === 'new' && <BirthForm initial={BLANK} busy={false} onSubmit={onAdd} submitLabel="Add this chart" />}

      {tab === 'link' && (
        <form className="cmp-link" onSubmit={(e) => {
          e.preventDefault();
          const got = parsePastedLink(link);
          if (!got.inputs.length) { setLinkError('That link has no birth details in it.'); return; }
          got.inputs.forEach(onAdd);
          setLink('');
          setLinkError('');
        }}>
          <label className="field">
            <span>Paste a share link from the explorer or another compare page</span>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…/app/#n=…&d=…" />
          </label>
          <button className="btn-primary" type="submit">Add</button>
          {linkError && <p className="form-error">{linkError}</p>}
        </form>
      )}
    </div>
  );
}

function SourceRow({ s, taken, onAdd }: { s: SourceChart; taken: boolean; onAdd: (i: BirthInput) => void }) {
  return (
    <li>
      <button className="cmp-source" disabled={taken} onClick={() => onAdd(s.input)}>
        <b>{s.label}</b>
        {s.sub && <small className="muted">{s.sub}</small>}
        <span className="cmp-source-add">{taken ? 'Added' : 'Add'}</span>
      </button>
    </li>
  );
}

/* ---------- comparison table ---------- */

function CompareTable({ entries, vargaId, highlight }: { entries: Entry[]; vargaId: VargaId; highlight: PlanetId | null }) {
  const charts = entries.map((e) => e.chart);
  const vargas = charts.map((c) => (c ? getVarga(c, vargaId) : null));
  const shared = (signs: (number | undefined)[]) => {
    const s = signs.filter((x): x is number => x !== undefined);
    return s.length >= 2 && s.some((x, i) => s.indexOf(x) !== i);
  };
  const ascSigns = vargas.map((v) => v?.ascSign);
  const moonNaks = charts.map((c) => c?.planets.find((p) => p.id === 'moon')!.nakshatra);
  const cell = (sign: number | undefined, others: (number | undefined)[]) => {
    if (sign === undefined) return null;
    return others.filter((x) => x === sign).length > 1;
  };

  return (
    <section className="card">
      <div className="card-head">
        <h3>Placements compared</h3>
        <span className="muted">{vargaId} · signs both or all charts share are marked</span>
      </div>
      <div className="table-wrap">
        <table className="planet-table cmp-table">
          <thead>
            <tr>
              <th />
              {entries.map((e, n) => <th key={e.key} style={{ color: SLOT_COLORS[n] }}>{LETTERS[n]} · {nameOf(e.input, n)}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className={shared(ascSigns) ? 'is-shared-row' : ''}>
              <th>Lagna</th>
              {vargas.map((v, n) => <td key={n} className={cell(v?.ascSign, ascSigns) ? 'is-shared' : ''}>{v ? `${signInfo(v.ascSign).glyph} ${signInfo(v.ascSign).name}` : '…'}</td>)}
            </tr>
            {PLANETS.map((pl) => {
              const signs = vargas.map((v) => v?.planets[pl.id]?.sign);
              return (
                <tr key={pl.id} className={`${shared(signs) ? 'is-shared-row' : ''}${highlight === pl.id ? ' is-focus' : ''}`}>
                  <th><span className="pt-glyph" style={{ color: pl.color }}>{pl.glyph}</span>{pl.name}</th>
                  {vargas.map((v, n) => {
                    const c = charts[n];
                    if (!v || !c) return <td key={n}>…</td>;
                    const vp = v.planets[pl.id];
                    const pos = c.planets.find((p) => p.id === pl.id)!;
                    const dig = dignityOf(pl.id, vp.sign);
                    const tone = dignityTone(dig);
                    return (
                      <td key={n} className={cell(vp.sign, signs) ? 'is-shared' : ''}>
                        {signInfo(vp.sign).glyph} {signInfo(vp.sign).name} <span className="muted">· H{vp.house}</span>
                        {vargaId === 'D1' && <span className="muted"> · {Math.floor(pos.degreeInSign)}°</span>}
                        {pos.retrograde && pl.id !== 'rahu' && pl.id !== 'ketu' && <span className="chart-flag"> R</span>}
                        {(dig === 'Exalted' || dig === 'Debilitated' || dig === 'Own sign' || dig === 'Moolatrikona') && <span className={`chip chip-${tone} cmp-dig`}>{dig}</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className={shared(moonNaks) ? 'is-shared-row' : ''}>
              <th>Janma nakshatra</th>
              {charts.map((c, n) => {
                const m = c?.planets.find((p) => p.id === 'moon');
                return <td key={n} className={cell(m?.nakshatra, moonNaks) ? 'is-shared' : ''}>{m ? `${NAKSHATRAS[m.nakshatra - 1].name} ${m.pada}` : '…'}</td>;
              })}
            </tr>
            <tr>
              <th>Dasha now</th>
              {charts.map((c, n) => <td key={n}>{c ? currentDasha(c.dasha) : '…'}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------- synastry ---------- */

const TONE_CLASS = { benefic: 'good', mixed: 'mid', challenging: 'bad' } as const;

function SynastrySection({ entries, style }: { entries: Entry[]; style: ChartStyle }) {
  const [hostIdx, setHostIdx] = useState(0);
  const [guestIdx, setGuestIdx] = useState(1);
  const [picked, setPicked] = useState<PlanetId | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [result, setResult] = useState<{ key: string; report: SynastryReport } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);

  // Keep the indexes valid when charts are removed.
  const n = entries.length;
  const h = hostIdx < n ? hostIdx : 0;
  const g = guestIdx < n && guestIdx !== h ? guestIdx : (h + 1) % n;
  const host = entries[h];
  const guest = entries[g];
  const hostName = nameOf(host.input, h);
  const guestName = nameOf(guest.input, g);

  const pairKey = `${host.key}|${guest.key}|${hostName}|${guestName}`;
  const report = result?.key === pairKey ? result.report : null;

  useEffect(() => {
    if (!host.chart || !guest.chart) return;
    let live = true;
    const [hc, gc] = [host.chart, guest.chart];
    // The reading library is large, so it loads as its own chunk.
    void import('@vedic/interpretations').then((m) => {
      if (live) setResult({ key: pairKey, report: m.synastry({ name: hostName, chart: toChartInput(hc) }, { name: guestName, chart: toChartInput(gc) }) });
    });
    return () => { live = false; };
  }, [host.chart, guest.chart, hostName, guestName, pairKey]);

  useEffect(() => {
    if (!picked || !listRef.current) return;
    listRef.current.querySelector(`[data-planet="${picked}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [picked]);

  if (!host.chart || !guest.chart) return null;
  const hc = host.chart;
  const gc = guest.chart;
  const d1 = getVarga(hc, 'D1');
  const houses: Record<number, PlanetId[]> = {};
  for (let i = 1; i <= 12; i++) houses[i] = [];
  for (const p of gc.planets) houses[houseOf(p.sign, hc.ascendant.sign)].push(p.id);
  const overlay: ChartOverlay = { chart: gc, houses, label: guestName, selected: picked, onSelect: (id) => setPicked((x) => (x === id ? null : id)) };
  const noop = () => {};
  const contacts = report ? (showAll ? report.contacts : report.contacts.slice(0, 8)) : [];

  const options = entries.map((e, i) => <option key={e.key} value={i}>{LETTERS[i]} · {nameOf(e.input, i)}</option>);

  return (
    <section className="card cmp-syn" id="synastry">
      <div className="card-head">
        <h3>Synastry</h3>
        <span className="muted">one person's planets placed in the other's houses</span>
      </div>
      <div className="cmp-syn-pick">
        <label>Houses of
          <select value={h} onChange={(e) => { const v = +e.target.value; setHostIdx(v); if (v === g) setGuestIdx(h); setPicked(null); }}>{options}</select>
        </label>
        <button className="btn-ghost" onClick={() => { setHostIdx(g); setGuestIdx(h); setPicked(null); }} aria-label="Swap the two charts">⇄ Swap</button>
        <label>Planets of
          <select value={g} onChange={(e) => { const v = +e.target.value; setGuestIdx(v); if (v === h) setHostIdx(g); setPicked(null); }}>{options}</select>
        </label>
      </div>

      <div className="explorer-grid">
        <div>
          <div className="chart-stage">
            {style === 'north'
              ? <NorthChart chart={hc} varga={d1} selection={null} hoverPlanet={null} onSelect={noop} onHoverPlanet={noop} overlay={overlay} />
              : <SouthChart chart={hc} varga={d1} selection={null} hoverPlanet={null} onSelect={noop} onHoverPlanet={noop} overlay={overlay} />}
          </div>
          <p className="legend muted">
            <span className="cmp-key">Upright</span> {hostName}'s planets · <span className="cmp-key cmp-key-overlay">underlined</span> {guestName}'s planets. Click one of {guestName}'s planets to read it.
          </p>
        </div>

        <div className="cmp-syn-read">
          {!report ? <p className="muted">Reading the two charts…</p> : (
            <>
              <ul className="cmp-highlights">
                {report.highlights.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
              <div className="cmp-rel">
                {[report.moon, report.lagna].map((r) => (
                  <div key={r.title} className={`reading tone-${r.tone}`}>
                    <h4>{r.title}</h4>
                    <p>{r.text}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {report && (
        <div className="cmp-syn-lists">
          <div>
            <h4>{guestName}'s planets in {hostName}'s houses</h4>
            <ol className="cmp-overlays" ref={listRef}>
              {report.bInA.map((o) => <OverlayItem key={o.planet} o={o} active={picked === o.planet} onPick={() => setPicked((x) => (x === o.planet ? null : o.planet))} />)}
            </ol>
          </div>
          <div>
            <h4>{hostName}'s planets in {guestName}'s houses</h4>
            <ol className="cmp-overlays">
              {report.aInB.map((o) => <OverlayItem key={o.planet} o={o} active={false} />)}
            </ol>
          </div>
          <div className="cmp-contacts">
            <h4>Contacts between the charts</h4>
            {report.contacts.length === 0 ? <p className="muted">No conjunctions or key aspects between these two charts.</p> : (
              <>
                <ul>
                  {contacts.map((c) => <ContactItem key={`${c.a}-${c.b}-${c.kind}`} c={c} />)}
                </ul>
                {report.contacts.length > 8 && (
                  <button className="text-link" onClick={() => setShowAll((s) => !s)}>{showAll ? 'Show fewer' : `Show all ${report.contacts.length}`}</button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function OverlayItem({ o, active, onPick }: { o: HouseOverlay; active: boolean; onPick?: () => void }) {
  const info = PLANET_BY_ID[o.planet];
  const [open, setOpen] = useState(false);
  const shown = active || open;
  return (
    <li data-planet={o.planet} className={`cmp-overlay${active ? ' is-active' : ''}`}>
      <button className="cmp-overlay-head" onClick={onPick ?? (() => setOpen((x) => !x))} aria-expanded={shown}>
        <span className="pt-glyph" style={{ color: info.color }}>{info.glyph}</span>
        <b>{info.name} in the {ordinal(o.house)}</b>
        <span className={`chip chip-${TONE_CLASS[o.tone]}`}>{o.tone === 'benefic' ? 'supportive' : o.tone === 'challenging' ? 'needs care' : 'mixed'}</span>
      </button>
      <p>{o.summary}</p>
      {shown && <p className="muted">{o.detail}</p>}
    </li>
  );
}

function ContactItem({ c }: { c: CrossContact }) {
  return (
    <li className="cmp-contact">
      <span className="cmp-contact-glyphs">
        <span style={{ color: PLANET_BY_ID[c.a].color }}>{PLANET_BY_ID[c.a].glyph}</span>
        <span className="muted">{c.kind === 'conjunction' ? '☌' : c.kind === 'mutual aspect' ? '⇄' : c.from === 'a' ? '→' : '←'}</span>
        <span style={{ color: PLANET_BY_ID[c.b].color }}>{PLANET_BY_ID[c.b].glyph}</span>
      </span>
      <div>
        <b>{c.title}</b> <span className={`chip chip-${TONE_CLASS[c.tone]}`}>{c.kind}</span>
        <p>{c.text}</p>
      </div>
    </li>
  );
}
