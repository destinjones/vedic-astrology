import { useEffect, useMemo, useState } from 'react';
import {
  CAPSULE_SCORES, capsuleRecord, capsuleState, FEED_CITIES, openCapsule, panchangaDays, panchangaIcs, parseCapsules,
  posterSvg, scoreCapsule, sealCapsule, untilText, verifyCapsule, type Capsule, type CapsuleScore,
} from '@vedic/personal';
import type { BirthInput, Chart } from '../types/chart';

function download(data: BlobPart, type: string, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chart';

/* ---------- poster ---------- */

export function PosterMaker({ chart }: { chart: Chart }) {
  const ec = chart.engineContext!.chart;
  const [title, setTitle] = useState(chart.input.name ?? '');
  const [birthData, setBirthData] = useState(false);
  const [degrees, setDegrees] = useState(true);
  const svg = useMemo(() => posterSvg(ec, { title, showBirthData: birthData, showDegrees: degrees }), [ec, title, birthData, degrees]);
  const src = useMemo(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, [svg]);
  const name = `${slug(title || chart.input.name || 'my')}-chart-poster`;
  const png = () => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 2400; c.height = 3200;
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => b && download(b, 'image/png', `${name}.png`), 'image/png');
    };
    img.src = src;
  };
  return (
    <div className="ks-poster">
      <img src={src} alt={`Generative poster drawn from this chart's planetary degrees: petals turned to the ascendant, one curve per planet and a constellation joining them.`} width={300} height={400} />
      <div className="ks-form">
        <p className="muted">One poster per chart, drawn only from its own degrees. Born four minutes later, it would look different.</p>
        <label className="field"><span>Title</span><input value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} placeholder="Your name, or leave blank" /></label>
        <label className="ks-check"><input type="checkbox" checked={degrees} onChange={(e) => setDegrees(e.target.checked)} /> Print the planets' degrees</label>
        <label className="ks-check"><input type="checkbox" checked={birthData} onChange={(e) => setBirthData(e.target.checked)} /> Print birth date, time and place</label>
        {birthData && <p className="ks-warn">Anyone you share it with can cast your chart from this.</p>}
        <div className="ks-actions">
          <button className="btn-primary" onClick={png}>Download PNG</button>
          <button className="btn-ghost" onClick={() => download(svg, 'image/svg+xml', `${name}.svg`)}>SVG</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- time capsule ---------- */

const STORE = 'vedic.capsules.v1';
const load = (): Capsule[] => { try { return parseCapsules(JSON.parse(localStorage.getItem(STORE) ?? '[]')); } catch { return []; } };
const store = (list: Capsule[]) => { try { localStorage.setItem(STORE, JSON.stringify(list)); return true; } catch { return false; } };
const chartKey = (i: BirthInput) => `${i.date}|${i.time}|${i.latitude.toFixed(4)}|${i.longitude.toFixed(4)}`;

function runningDasha(chart: Chart): string | undefined {
  const t = Date.now();
  const m = chart.dasha?.find((p) => Date.parse(p.start) <= t && t < Date.parse(p.end));
  const a = m?.sub?.find((p) => Date.parse(p.start) <= t && t < Date.parse(p.end));
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return m ? `${cap(m.lord)}${a ? `–${cap(a.lord)}` : ''} dasha` : undefined;
}

export function TimeCapsule({ chart }: { chart: Chart }) {
  const key = chartKey(chart.input);
  const [all, setAll] = useState<Capsule[]>(load);
  const [text, setText] = useState('');
  const [months, setMonths] = useState(12);
  const [error, setError] = useState('');
  const [valid, setValid] = useState<Record<string, boolean>>({});
  const mine = all.filter((c) => c.chartKey === key);
  const record = capsuleRecord(mine);
  const save = (list: Capsule[]) => { setAll(list); if (!store(list)) setError('Your browser would not save the capsule.'); };
  const update = (c: Capsule) => save(all.map((x) => (x.id === c.id ? c : x)));

  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === STORE) setAll(load()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  useEffect(() => {
    let live = true;
    Promise.all(mine.map(async (c) => [c.id, await verifyCapsule(c)] as const)).then((r) => { if (live) setValid(Object.fromEntries(r)); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, key]);

  const seal = async () => {
    setError('');
    try {
      const opensAt = new Date();
      opensAt.setMonth(opensAt.getMonth() + months);
      const c = await sealCapsule({ chartKey: key, label: chart.input.name || 'This chart', prediction: text, context: runningDasha(chart), opensAt });
      save([c, ...all]);
      setText('');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="ks-capsule">
      <p className="muted">
        Write down what you expect from the year ahead, seal it, and open it when the time comes. Then score how it went.
        The capsule stays in this browser; the seal shows if the words were changed after sealing.
      </p>
      <label className="field">
        <span>Your prediction</span>
        <textarea rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Within a year I will change jobs, and the new one will involve travel." />
      </label>
      <div className="ks-actions">
        <select value={months} onChange={(e) => setMonths(+e.target.value)} aria-label="Open after">
          <option value={3}>Open in 3 months</option>
          <option value={6}>Open in 6 months</option>
          <option value={12}>Open in a year</option>
          <option value={24}>Open in 2 years</option>
        </select>
        <button className="btn-primary" onClick={seal} disabled={!text.trim()}>Seal the capsule</button>
      </div>
      {error && <p className="ks-warn" role="alert">{error}</p>}
      {record.percent !== null && <p className="ks-record">Your record: <b>{record.percent}%</b> over {record.scored} scored capsule{record.scored === 1 ? '' : 's'}.</p>}
      <ul className="ks-list">
        {mine.map((c) => {
          const state = capsuleState(c);
          return (
            <li key={c.id} className={`ks-item is-${state}`}>
              <div className="ks-item-head">
                <b>{state === 'sealed' ? '🔒 Sealed' : state === 'ready' ? '🔓 Ready to open' : state === 'open' ? 'Opened' : `Scored: ${CAPSULE_SCORES[c.score!]}`}</b>
                <span className="muted">sealed {c.sealedAt.slice(0, 10)}{c.context ? `, in ${c.context}` : ''} · {state === 'sealed' ? `opens ${untilText(c.opensAt)}` : `opened ${c.openedAt?.slice(0, 10) ?? 'now'}${c.openedEarly ? ' (early)' : ''}`}</span>
                {valid[c.id] === false && <span className="ks-warn">seal broken</span>}
              </div>
              {state === 'sealed' && <button className="link-btn" onClick={() => { if (confirm('Open it early? It will be marked as opened early.')) update(openCapsule(c)); }}>Open early</button>}
              {state === 'ready' && <button className="btn-ghost" onClick={() => update(openCapsule(c))}>Open it</button>}
              {(state === 'open' || state === 'scored') && (
                <>
                  <blockquote>{c.prediction}</blockquote>
                  <div className="ks-score" role="radiogroup" aria-label="How did it go?">
                    {CAPSULE_SCORES.map((label, i) => (
                      <button key={label} role="radio" aria-checked={c.score === i} className={c.score === i ? 'is-active' : ''} onClick={() => update(scoreCapsule(c, i as CapsuleScore, c.note ?? ''))}>{label}</button>
                    ))}
                  </div>
                </>
              )}
              <button className="link-btn ks-del" onClick={() => { if (confirm('Delete this capsule for good?')) save(all.filter((x) => x.id !== c.id)); }}>Delete</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- panchanga calendar ---------- */

export function CalendarFeed({ chart }: { chart: Chart }) {
  const { engine, chart: ec } = chart.engineContext!;
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const base = new URL(`${import.meta.env.BASE_URL}feeds/`, location.href);
  const personal = () => {
    setBusy(true);
    // let the button show its busy state before the year is worked out
    setTimeout(() => {
      try {
        const place = { name: chart.input.place, latitude: chart.input.latitude, longitude: chart.input.longitude, timezone: ec.meta.timezone };
        const days = panchangaDays(engine, { place, from: new Date(), days: 366, ayanamsa: chart.input.ayanamsa, natalMoon: ec.planets.moon.longitude });
        const who = chart.input.name || 'me';
        download(panchangaIcs(days, { name: `Panchanga for ${who}`, place, uidSuffix: slug(`${who}-${chart.input.date}`) }), 'text/calendar', `panchanga-${slug(who)}.ics`);
      } finally {
        setBusy(false);
      }
    }, 20);
  };
  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(url); } catch { prompt('Copy this address', url); }
  };
  return (
    <div className="ks-cal">
      <p className="muted">
        Tithi, nakshatra and yoga at sunrise for every day, in your own calendar app. The personal file adds your Tara bala and marks
        each Chandrashtama, worked out here from your birth Moon; nothing is uploaded.
      </p>
      <div className="ks-actions">
        <button className="btn-primary" onClick={personal} disabled={busy}>{busy ? 'Working out the year…' : 'Download my year (.ics)'}</button>
      </div>
      <h4>Or subscribe to a city feed</h4>
      <p className="muted">These update themselves: your calendar fetches them again each day. In Google Calendar, use “From URL” and paste the address.</p>
      <ul className="ks-cities">
        {FEED_CITIES.map((c) => {
          const url = new URL(`panchanga-${c.slug}.ics`, base);
          const webcal = url.href.replace(/^https?:/, 'webcal:');
          return (
            <li key={c.slug}>
              <a href={webcal}>{c.name}</a>
              <button className="link-btn" onClick={() => copy(url.href)}>{copied === url.href ? 'copied' : 'copy link'}</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
