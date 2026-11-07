import { useState } from 'react';
import type { Engine, GrahaId, MuhurtaNatal, MuhurtaResult, MuhurtaWindow } from '@vedic/engine';
import type { MatchResult, PoruthamResult, PoruthamRow } from '@vedic/interpretations';
import type { JaiminiMatch, JaiminiMarriage, MarriageTone } from '@vedic/jaimini';
import { MUHURTA_CAVEAT } from '../lib/muhurtaCaveat';

type Seat = 'a' | 'b';
const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const PL: Record<GrahaId, string> = { sun: 'Sun', moon: 'Moon', mars: 'Mars', mercury: 'Mercury', jupiter: 'Jupiter', venus: 'Venus', saturn: 'Saturn', rahu: 'Rahu', ketu: 'Ketu' };
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const plist = (xs: GrahaId[]) => (xs.length ? xs.map((g) => PL[g]).join(', ') : 'none');

export { MUHURTA_CAVEAT };

// ------------------------------------------------------------ three traditions

type Tone = 'good' | 'mid' | 'bad';
const ASHTA_TONE: Record<MatchResult['band'], Tone> = { excellent: 'good', very_good: 'good', acceptable: 'mid', not_recommended: 'bad' };
const PORU_TONE: Record<PoruthamResult['verdict'], Tone> = { good: 'good', acceptable: 'mid', weak: 'bad', not_recommended: 'bad' };
const JAI_TONE: Record<MarriageTone, Tone> = { supportive: 'good', mixed: 'mid', strained: 'bad' };

export function TraditionsCard({ r, p, j }: { r: MatchResult; p: PoruthamResult; j: JaiminiMatch }) {
  const rows: { name: string; school: string; value: string; tone: Tone; href: string }[] = [
    { name: 'Ashtakoota', school: 'North Indian, 36 gunas from the two Moons', value: `${fmt(r.total)}/36 · ${r.bandLabel}`, tone: ASHTA_TONE[r.band], href: '#kootas' },
    { name: 'Porutham', school: 'South Indian, ten agreements from the two stars', value: `${fmt(p.score)}/10 · ${p.verdictLabel}`, tone: PORU_TONE[p.verdict], href: '#porutham' },
    { name: 'Jaimini', school: 'Upapada, Darakaraka and Karakamsa from the whole charts', value: j.tone === 'supportive' ? 'Well supported' : j.tone === 'strained' ? 'Needs care' : 'Mixed', tone: JAI_TONE[j.tone], href: '#jaimini' },
  ];
  const tones = rows.map((x) => x.tone);
  const agree = tones.every((t) => t === tones[0]);
  const verdict = agree
    ? tones[0] === 'good' ? 'All three traditions favour this match.' : tones[0] === 'bad' ? 'All three traditions advise caution.' : 'All three traditions give a middling picture.'
    : 'The traditions disagree, which is common. Ashtakoota and Porutham read only the two Moons, while Jaimini reads the marriage points of the whole charts, so where they differ an astrologer would weigh the Jaimini picture and the 7th houses before deciding.';
  return (
    <section className="card traditions-card">
      <div className="card-head"><h3>Three ways to read the match</h3><span className="muted">different schools, side by side</span></div>
      <ul className="traditions">
        {rows.map((x) => (
          <li key={x.name} className={`tradition tone-${x.tone}`}>
            <a href={x.href}>
              <b>{x.name}</b>
              <small className="muted">{x.school}</small>
              <span className={`chip chip-${x.tone}`}>{x.value}</span>
            </a>
          </li>
        ))}
      </ul>
      <p>{verdict}</p>
    </section>
  );
}

// ------------------------------------------------------------ porutham

const RES_TONE: Record<PoruthamRow['result'], Tone> = { match: 'good', partial: 'mid', no: 'bad' };
const RES_LABEL: Record<PoruthamRow['result'], string> = { match: 'agrees', partial: 'half', no: 'does not agree' };

export function PoruthamPanel({ p, names }: { p: PoruthamResult; names: Record<Seat, string> }) {
  return (
    <section className="card" id="porutham">
      <div className="card-head">
        <h3>Dashakoota (Porutham)</h3>
        <span className={`chip chip-${PORU_TONE[p.verdict]}`}>{fmt(p.score)}/10 · {p.verdictLabel}</span>
      </div>
      <p>{p.summary}</p>
      <p className="muted small">Counted from the bride’s star to the groom’s: {p.starCount}. Rajju: {names.a} {p.rajju.a}, {names.b} {p.rajju.b}.</p>
      <div className="porutham-list">
        {p.rows.map((x) => (
          <details key={x.id} className={`porutham tone-${RES_TONE[x.result]}`}>
            <summary>
              <b>{x.name}{x.essential && <small className="essential" title="A failure here is usually decisive"> essential</small>}</b>
              <small className="muted">{x.area}</small>
              <span className={`chip chip-${RES_TONE[x.result]}`}>{RES_LABEL[x.result]}</span>
            </summary>
            <div className="porutham-body">
              <p className="small"><b>{names.a}</b>: {x.values.a} · <b>{names.b}</b>: {x.values.b}</p>
              <p>{x.explanation}</p>
            </div>
          </details>
        ))}
      </div>
      <p className="muted small">Porutham is the Tamil and Kerala match. Almanacs differ on a few rules (Rasi and Gana especially); where they do, the reading used is named above.</p>
    </section>
  );
}

// ------------------------------------------------------------ jaimini

function MarriageColumn({ m, name }: { m: JaiminiMarriage; name: string }) {
  return (
    <div className="jm-col">
      <header><b>{name}</b><span className={`chip chip-${JAI_TONE[m.secondFromUl.tone]}`}>2nd from UL: {m.secondFromUl.tone}</span></header>
      <dl className="moon-facts jm-facts">
        <div><dt>Upapada (UL)</dt><dd>{SIGNS[m.upapada.sign - 1]} <small className="muted">house {m.upapada.house}</small></dd></div>
        <div><dt>7th from UL</dt><dd>{SIGNS[m.seventhFromUl.sign - 1]}</dd></div>
        <div><dt>Darakaraka</dt><dd>{PL[m.darakaraka.planet]} <small className="muted">in {SIGNS[m.darakaraka.sign - 1]}</small></dd></div>
        <div><dt>Atmakaraka</dt><dd>{PL[m.karakamsa.atmakaraka]}</dd></div>
        <div><dt>Karakamsa</dt><dd>{SIGNS[m.karakamsa.sign - 1]}</dd></div>
        <div><dt>7th from Karakamsa</dt><dd>{SIGNS[m.karakamsa.seventh - 1]}</dd></div>
      </dl>
      <p className="small">{m.secondFromUl.text}</p>
      <p className="small muted">In the 2nd from UL: {plist(m.secondFromUl.occupants)}; aspecting it: {plist(m.secondFromUl.aspecting)}.</p>
      <p className="small">{m.karakamsa.text}</p>
    </div>
  );
}

export function JaiminiPanel({ j, names }: { j: JaiminiMatch; names: Record<Seat, string> }) {
  return (
    <section className="card" id="jaimini">
      <div className="card-head">
        <h3>Upapada and Karakamsa</h3>
        <span className={`chip chip-${JAI_TONE[j.tone]}`}>{j.tone === 'supportive' ? 'well supported' : j.tone === 'strained' ? 'needs care' : 'mixed'}</span>
      </div>
      <p>{j.summary}</p>
      {j.links.length > 0 && (
        <>
          <h4>Links between the charts</h4>
          <ul className="jm-links">{j.links.map((l) => <li key={`${l.in}${l.point}${l.by}`}>{l.text}</li>)}</ul>
        </>
      )}
      <div className="manglik-sides">
        <MarriageColumn m={j.a} name={names.a} />
        <MarriageColumn m={j.b} name={names.b} />
      </div>
      <p className="muted small">
        Jaimini judges a marriage from the Upapada (the arudha of the 12th house) and the 2nd from it, which shows what sustains the bond, and from the 7th from Karakamsa in the navamsa (Jaimini Sutras 1.3–1.4). The links above are the traditional cross-check: one person’s lagna or Moon on the other’s marriage points.
      </p>
    </section>
  );
}

// ------------------------------------------------------------ wedding dates

const GRADE: Record<MuhurtaWindow['grade'], string> = { excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Weak', avoid: 'Avoid' };

function monthOptions(tz: string) {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    out.push({ value: d.toISOString().slice(0, 7), label: new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d) });
  }
  void tz;
  return out;
}

/** Best windows that touch each other (split only by a minor change) shown as one span, best score first */
function mergeAdjacent(res: MuhurtaResult) {
  const picked = new Set(res.best);
  const out: { w: MuhurtaWindow; end: string; minutes: number }[] = [];
  const used = new Set<MuhurtaWindow>();
  for (const w of res.best) {
    if (used.has(w)) continue;
    let i = res.windows.indexOf(w);
    let lo = i, hi = i;
    while (lo > 0 && picked.has(res.windows[lo - 1]) && !used.has(res.windows[lo - 1])) lo--;
    while (hi < res.windows.length - 1 && picked.has(res.windows[hi + 1]) && !used.has(res.windows[hi + 1])) hi++;
    for (i = lo; i <= hi; i++) used.add(res.windows[i]);
    const first = res.windows[lo];
    const span = res.windows.slice(lo, hi + 1);
    const top = span.reduce((a, b) => (b.score > a.score ? b : a), first);
    out.push({ w: { ...top, start: first.start, startJd: first.startJd }, end: res.windows[hi].end, minutes: span.reduce((t, x) => t + x.minutes, 0) });
  }
  return out;
}

const local = (iso: string, tz: string, o: Intl.DateTimeFormatOptions) => {
  try { return new Intl.DateTimeFormat(undefined, { ...o, timeZone: tz }).format(new Date(iso)); } catch { return iso; }
};

export function WeddingDates({ engine, natals, place }: {
  engine: Engine;
  natals: [MuhurtaNatal, MuhurtaNatal];
  place: { name: string; latitude: number; longitude: number; timezone: string };
}) {
  const months = monthOptions(place.timezone);
  const [from, setFrom] = useState(months[0].value);
  const [span, setSpan] = useState(3);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<MuhurtaResult | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const run = () => {
    setBusy(true); setErr(null);
    setTimeout(async () => {
      try {
        const { findMuhurtas, localToUtc } = await import('@vedic/engine');
        const start = localToUtc(`${from}-01`, '00:00', place.timezone).utc;
        const end = new Date(Math.min(start.getTime() + 92 * 86400000 - 60000, new Date(Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1 + span, 1)).getTime()));
        setRes(findMuhurtas(engine, { activity: 'marriage', start, end, latitude: place.latitude, longitude: place.longitude, timezone: place.timezone, natals, stepMinutes: 15, limit: 10 }));
        setOpen(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }, 20);
  };

  return (
    <section className="card wedding-card" id="wedding-dates">
      <div className="card-head"><h3>Wedding dates for the two of you</h3><span className="muted">muhurta from both birth Moons</span></div>
      <p className="small">
        Searches the panchanga for a vivaha muhurta that suits both charts: Tara bala and Chandra bala are checked for each of you, so a day of Chandrashtama or Naidhana tara for either partner is ruled out. The usual wedding rules apply on top: the recommended stars and weekdays, no Rikta tithi, Vishti or Vyatipata, Jupiter and Venus visible (not combust), no Kharmas, the 7th and 8th houses of the muhurta chart free of malefics, and Rahu kalam and Yamaganda avoided.
      </p>
      <div className="wedding-form">
        <label className="field"><span>From</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)}>{months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
        </label>
        <label className="field"><span>Search</span>
          <select value={span} onChange={(e) => setSpan(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n} month{n > 1 ? 's' : ''}</option>)}</select>
        </label>
        <button className="btn-primary" disabled={busy} onClick={run}>{busy ? 'Searching…' : 'Find wedding dates'}</button>
      </div>
      <p className="muted small">Place: {place.name || `${place.latitude.toFixed(2)}, ${place.longitude.toFixed(2)}`} ({place.timezone}), from the second partner’s birthplace. For another place or more options use the <a href={`${import.meta.env.BASE_URL}tools/#muhurta`}>Muhurta tool</a>.</p>
      {err && <p className="form-error" role="alert">{err}</p>}
      {res && (
        <>
          <p className="muhurta-caveat" role="note">{MUHURTA_CAVEAT}</p>
          {res.best.length === 0 ? (
            <p>No window in this range passes every rule for both of you. Try a later start or a longer search; Kharmas, combust Venus or Jupiter, and each partner’s Chandrashtama can close long stretches.</p>
          ) : (
            <ol className="wedding-list">
              {mergeAdjacent(res).map(({ w, end, minutes }) => {
                const i = res.windows.indexOf(w);
                return (
                  <li key={i} className={`wd wd-${w.grade}`}>
                    <button className="wd-head" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                      <span className="wd-score">{w.score}</span>
                      <span className="wd-when">
                        <b>{local(w.start, res.timezone, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</b>
                        <span>{local(w.start, res.timezone, { timeStyle: 'short' })} to {local(end, res.timezone, { timeStyle: 'short' })} <small className="muted">({minutes} min)</small></span>
                      </span>
                      <span className="wd-tags">
                        <span className="chip">{w.state.nakshatraName}</span>
                        <span className="chip">{w.state.lagnaName} lagna</span>
                        <span className={`chip ${w.grade === 'excellent' || w.grade === 'good' ? 'chip-good' : 'chip-mid'}`}>{GRADE[w.grade]}</span>
                      </span>
                    </button>
                    {open === i && (
                      <ul className="wd-factors">
                        {w.factors.map((f) => (
                          <li key={f.key} className={f.points > 0 ? 'f-pos' : f.points < 0 ? 'f-neg' : ''}>
                            <b>{f.label} <small className="mono">{f.points > 0 ? `+${f.points}` : f.points}</small></b> <span>{f.detail}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
