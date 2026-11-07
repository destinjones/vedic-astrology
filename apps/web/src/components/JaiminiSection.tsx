import { useMemo, useState } from 'react';
import type { Chart as EngineChart, GrahaId, SignNumber } from '@vedic/engine';
import { charaDashaAt, charaDashaReading, jaimini, type CharaDashaPeriod, type KarakaScheme } from '@vedic/jaimini';
import { PLANET_BY_ID, signInfo } from '../data/constants';
import { ReadingBlock } from './ReadingBlock';
import './jaimini.css';

const SCHEME_KEY = 'vedic.karakaScheme';
const loadScheme = (): KarakaScheme => {
  try { return localStorage.getItem(SCHEME_KEY) === '7' ? 7 : 8; } catch { return 8; }
};

/** Same layout as the South Indian chart: Pisces top-left, running clockwise. */
const CELL: Record<number, [number, number]> = {
  12: [1, 1], 1: [2, 1], 2: [3, 1], 3: [4, 1], 4: [4, 2], 5: [4, 3],
  6: [4, 4], 7: [3, 4], 8: [2, 4], 9: [1, 4], 10: [1, 3], 11: [1, 2],
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
const fmtYears = (y: number) => (Number.isInteger(y) ? `${y} yr` : `${Math.round(y * 12)} mo`);
const SIGN_COLORS = ['#ef4b4b', '#3ecf8e', '#f2c14e', '#cfd8e6', '#f5a524', '#7fd1a8', '#e8a0d8', '#b44b6b', '#f0a050', '#8f8fb8', '#5fb8e8', '#9a8cff'];
const signColor = (s: number) => SIGN_COLORS[s - 1];

/** The Jaimini layer: chara karakas, arudha padas, sign aspects and chara dasha. */
export default function JaiminiSection({ chart }: { chart: EngineChart }) {
  const [scheme, setScheme] = useState<KarakaScheme>(loadScheme);
  const j = useMemo(() => jaimini(chart, { karakaScheme: scheme }), [chart, scheme]);
  const [focus, setFocus] = useState<SignNumber | null>(null);
  const pickScheme = (s: KarakaScheme) => {
    setScheme(s);
    try { localStorage.setItem(SCHEME_KEY, String(s)); } catch { /* ignore */ }
  };

  const occupants = useMemo(() => {
    const m: Record<number, GrahaId[]> = {};
    for (const [g, lon] of Object.entries(j.input.planets)) (m[Math.floor(lon / 30) + 1] ??= []).push(g as GrahaId);
    return m;
  }, [j]);
  const karakaOf = useMemo(() => Object.fromEntries(j.karakas.map((k) => [k.planet, k.id])), [j]);
  const aspected = new Set(focus ? j.rashiDrishti[focus] : []);
  const closeCall = j.karakas.slice(0, -1).find((k) => k.margin < 1);

  return (
    <div className="jaimini">
      <div className="jm-toolbar">
        <p className="muted">Jaimini reads the chart through signs. Karakas come from how far each planet has moved through its sign, and timing runs sign by sign.</p>
        <div className="seg" role="radiogroup" aria-label="Karaka scheme">
          <button role="radio" aria-checked={scheme === 8} className={scheme === 8 ? 'is-active' : ''} onClick={() => pickScheme(8)} title="Sun to Saturn plus Rahu, with a Pitrikaraka">8 karakas</button>
          <button role="radio" aria-checked={scheme === 7} className={scheme === 7 ? 'is-active' : ''} onClick={() => pickScheme(7)} title="Sun to Saturn only">7 karakas</button>
        </div>
      </div>

      <h4 className="yd-title">Chara karakas</h4>
      <div className="jm-table-wrap">
        <table className="planet-table jm-karakas">
          <thead><tr><th>Karaka</th><th>Planet</th><th>Degree</th><th>Sign · house</th><th>Signifies</th></tr></thead>
          <tbody>
            {j.karakas.map((k) => {
              const p = PLANET_BY_ID[k.planet];
              return (
                <tr key={k.id} className={k.id === 'AK' ? 'is-ak' : ''}>
                  <td><b>{k.id}</b> <span className="muted">{k.name}</span></td>
                  <td><span style={{ color: p.color }}>{p.glyph}</span> {p.name}</td>
                  <td className="mono">{k.degree.toFixed(2)}°{k.planet === 'rahu' && <span className="muted" title="Rahu moves backward, so its degree is counted from the end of the sign"> (30° − deg)</span>}</td>
                  <td>{signInfo(k.sign).name} · {k.house}</td>
                  <td className="muted jm-wrap">{k.signifies}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {closeCall && (
        <p className="yd-reason">Close call: {PLANET_BY_ID[closeCall.planet].name} is only {closeCall.margin.toFixed(2)}° ahead of the next karaka, so a small birth-time error could swap their roles.</p>
      )}
      <div className="yd-grid">
        <ReadingBlock reading={j.readings.atmakaraka} />
        <ReadingBlock reading={j.readings.karakamsa} />
        <ReadingBlock reading={j.readings.amatyakaraka} />
        <ReadingBlock reading={j.readings.darakaraka} />
      </div>

      <div className="jm-split">
        <div>
          <h4 className="yd-title">Arudha padas and sign aspects</h4>
          <p className="muted jm-note">Each pada is the image a house projects into the world. Click a sign to light up the signs it aspects by rashi drishti.</p>
          <div className="jm-grid" role="grid" aria-label="Arudha padas by sign">
            {Object.entries(CELL).map(([s, [col, row]]) => {
              const sign = Number(s) as SignNumber;
              const padas = j.arudhas.filter((a) => a.sign === sign);
              const cls = ['jm-cell', sign === j.ascendantSign && 'is-lagna', focus === sign && 'is-focus', aspected.has(sign) && 'is-aspected'].filter(Boolean).join(' ');
              return (
                <button key={s} className={cls} style={{ gridColumn: col, gridRow: row }} onClick={() => setFocus(focus === sign ? null : sign)}
                  aria-pressed={focus === sign} aria-label={`${signInfo(sign).name}${padas.length ? `, ${padas.map((p) => p.name).join(', ')}` : ''}`}>
                  <span className="jm-sign">{signInfo(sign).short}{sign === j.ascendantSign && <em> Asc</em>}</span>
                  <span className="jm-padas">
                    {padas.map((p) => <b key={p.id} className={p.id === 'AL' || p.id === 'UL' ? 'is-key' : ''} title={p.name}>{p.id}</b>)}
                  </span>
                  <span className="jm-occ">
                    {(occupants[sign] ?? []).map((g) => (
                      <span key={g} style={{ color: PLANET_BY_ID[g].color }} title={`${PLANET_BY_ID[g].name}${karakaOf[g] ? ` (${karakaOf[g]})` : ''}`}>
                        {PLANET_BY_ID[g].abbr}{karakaOf[g] && <sub>{karakaOf[g]}</sub>}
                      </span>
                    ))}
                  </span>
                </button>
              );
            })}
            <div className="jm-center">
              {focus ? (
                <>
                  <b>{signInfo(focus).name}</b>
                  <small>{signInfo(focus).modality} sign, aspects {j.rashiDrishti[focus].map((s) => signInfo(s).name).join(', ')}</small>
                </>
              ) : (
                <>
                  <b>AL {signInfo(j.arudhaLagna.sign).name}</b>
                  <b>UL {signInfo(j.upapada.sign).name}</b>
                  <small>Karakamsa {signInfo(j.karakamsa).name}</small>
                </>
              )}
            </div>
          </div>
        </div>
        <div>
          <h4 className="yd-title">Image and marriage</h4>
          <ReadingBlock reading={j.readings.arudhaLagna} open />
          <ReadingBlock reading={j.readings.upapada} />
          <details className="jm-padlist">
            <summary>All twelve padas</summary>
            <ul>
              {j.arudhas.map((a) => (
                <li key={a.id}><b>{a.id}</b> {a.name}: {signInfo(a.sign).name}, house {a.house}
                  <span className="muted"> (house {a.ofHouse} lord {PLANET_BY_ID[a.lord].name} in {signInfo(a.lordSign).name}{a.exception ? ', moved 10 signs on' : ''})</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>

      <CharaDashaView j={j} />
    </div>
  );
}

function CharaDashaView({ j }: { j: ReturnType<typeof jaimini> }) {
  const periods = j.charaDasha.periods;
  const [now] = useState(() => Date.now());
  const { mahadasha: currentMd, antardasha: currentAd } = charaDashaAt(j.charaDasha, new Date(now));
  const currentIdx = currentMd ? periods.indexOf(currentMd) : -1;
  const [open, setOpen] = useState(currentIdx >= 0 ? currentIdx : 0);
  const active: CharaDashaPeriod = periods[Math.min(open, periods.length - 1)];
  const t0 = +new Date(periods[0].start);
  const t1 = +new Date(periods[periods.length - 1].end);
  const pct = (t: number) => ((t - t0) / (t1 - t0)) * 100;
  const reading = charaDashaReading(j, active);

  return (
    <>
      <h4 className="yd-title">Chara dasha</h4>
      <p className="muted jm-note">
        Sign periods from birth, running {j.charaDasha.direction} through the zodiac because the 9th sign from your lagna is {signInfo(((j.ascendantSign + 7) % 12) + 1).name}.
        Lengths follow K. N. Rao’s method, and the second cycle gives each sign 12 years minus its first.
      </p>
      <div className="dasha-bar jm-bar">
        {periods.map((d, i) => {
          const w = pct(+new Date(d.end)) - pct(+new Date(d.start));
          return (
            <button key={i} className={`dasha-seg${i === open ? ' is-open' : ''}${i === currentIdx ? ' is-now' : ''}`}
              style={{ width: `${w}%`, '--c': signColor(d.sign) } as React.CSSProperties}
              onClick={() => setOpen(i)} title={`${signInfo(d.sign).name} · ${d.years} years · ${fmt(d.start)} – ${fmt(d.end)}`}>
              <span>{signInfo(d.sign).short}</span>
            </button>
          );
        })}
        {now > t0 && now < t1 && <div className="dasha-now" style={{ left: `${pct(now)}%` }}><span>Now</span></div>}
      </div>
      <div className="dasha-detail">
        <h4>
          {signInfo(active.sign).glyph} {signInfo(active.sign).name} dasha{' '}
          <span className="muted">{fmt(active.start)} – {fmt(active.end)} · {active.years} years{active.cycle > 1 ? ` · cycle ${active.cycle}` : ''}</span>
        </h4>
        <ReadingBlock reading={reading} open />
        <div className="antar-grid">
          {active.children?.map((s) => {
            const isNow = currentAd?.startJd === s.startJd;
            return (
              <div key={s.startJd} className={`antar${isNow ? ' is-now' : ''}`} style={{ '--c': signColor(s.sign) } as React.CSSProperties}>
                <b>{signInfo(active.sign).short}–{signInfo(s.sign).short}</b>
                <small>{fmt(s.start)} → {fmt(s.end)} · {fmtYears(s.years)}</small>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
