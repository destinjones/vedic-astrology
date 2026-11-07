import { useState } from 'react';
import { PRASHNA_TOPICS, castPrashna, localToUtc, type Engine, type PrashnaResult, type PrashnaTopic, type PrashnaVerdict } from '@vedic/engine';
import { KpCuspTable, KpSignificationTable, KpWheel, PlaceField, Planet, RulingPlanets, fmtLocal, loadPlace, localParts, ordinal, pname, savePlace, signDeg, type Place } from './shared';

const VERDICT: Record<PrashnaVerdict, { label: string; cls: string }> = {
  yes: { label: 'Yes', cls: 'v-yes' },
  likely_yes: { label: 'Likely yes', cls: 'v-yes' },
  mixed: { label: 'Mixed', cls: 'v-mid' },
  likely_no: { label: 'Likely no', cls: 'v-no' },
  no: { label: 'No', cls: 'v-no' },
};

export function PrashnaTool({ engine }: { engine: Engine }) {
  const [place, setPlace] = useState<Place>(loadPlace);
  const [topic, setTopic] = useState<PrashnaTopic>('career');
  const [question, setQuestion] = useState('');
  const [method, setMethod] = useState<'time' | 'number'>('time');
  const [num, setNum] = useState<number | ''>('');
  const [useNow, setUseNow] = useState(true);
  const init = localParts(new Date(), place.timezone);
  const [date, setDate] = useState(init.date);
  const [time, setTime] = useState(init.time);
  const [res, setRes] = useState<PrashnaResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const def = PRASHNA_TOPICS.find((t) => t.id === topic)!;

  const ask = () => {
    try {
      setErr(null);
      if (method === 'number' && !(typeof num === 'number' && num >= 1 && num <= 249)) throw new Error('Pick a number from 1 to 249.');
      const when = useNow ? new Date() : localToUtc(date, time, place.timezone).utc;
      setRes(castPrashna(engine, {
        when, latitude: place.latitude, longitude: place.longitude, timezone: place.timezone,
        topic, question: question.trim() || undefined, kpNumber: method === 'number' ? (num as number) : undefined,
      }));
      requestAnimationFrame(() => document.getElementById('prashna-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="tools-grid">
      <section className="card tools-form">
        <h3>Your question</h3>
        <form className="birth-form" onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <label className="field span-2">
            <span>What is it about?</span>
            <select value={topic} onChange={(e) => setTopic(e.target.value as PrashnaTopic)}>
              {PRASHNA_TOPICS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className="field span-2">
            <span>Ask it in your own words <small className="muted">(optional)</small></span>
            <textarea rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={def.example} />
          </label>
          <div className="field span-2">
            <span>Method</span>
            <div className="seg" role="radiogroup" aria-label="Method">
              <button type="button" role="radio" aria-checked={method === 'time'} className={method === 'time' ? 'is-active' : ''} onClick={() => setMethod('time')}>Moment of asking</button>
              <button type="button" role="radio" aria-checked={method === 'number'} className={method === 'number' ? 'is-active' : ''} onClick={() => setMethod('number')}>KP number 1–249</button>
            </div>
          </div>
          {method === 'number' && (
            <div className="field span-2">
              <span>Think of the question, then the first number from 1 to 249 that comes to mind</span>
              <div className="kp-num-row">
                <input type="number" min={1} max={249} value={num} onChange={(e) => setNum(e.target.value === '' ? '' : Math.round(Number(e.target.value)))} placeholder="e.g. 108" />
                <button type="button" className="btn-ghost" onClick={() => setNum(1 + Math.floor(Math.random() * 249))}>Pick one for me</button>
              </div>
            </div>
          )}
          <div className="span-2"><PlaceField label="Where you are now" value={place} onChange={(p) => { setPlace(p); savePlace(p); }} /></div>
          <label className="field span-2 check">
            <input type="checkbox" checked={useNow} onChange={(e) => setUseNow(e.target.checked)} />
            <span>Use this moment</span>
          </label>
          {!useNow && (
            <>
              <label className="field"><span>Date asked</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
              <label className="field"><span>Time asked</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
            </>
          )}
          {err && <p className="form-error span-2" role="alert">{err}</p>}
          <button className="btn-primary span-2">Cast the Prashna</button>
        </form>
        <details className="kp-explain">
          <summary>How the answer is worked out</summary>
          <p>For {def.label.toLowerCase()}, the deciding point is the <b>{ordinal(def.cusp)} cusp</b>. Its sub lord must signify houses <b>{def.favourable.join(', ')}</b> and not <b>{def.adverse.join(', ')}</b>: {def.why}.</p>
          <p>In the number method the ascendant is set to the start of the KP sub with that number, and the other cusps are cast for the moment that degree rises where you are today. The planets stay where they are at the moment you ask.</p>
          <p>Ask once, sincerely, about something that matters to you. Asking the same question again and again does not give a better answer.</p>
        </details>
      </section>

      {res && <PrashnaAnswer res={res} tz={place.timezone} placeName={place.name} />}
    </div>
  );
}

function PrashnaAnswer({ res, tz, placeName }: { res: PrashnaResult; tz: string; placeName: string }) {
  const v = VERDICT[res.verdict];
  const pct = (res.score + 100) / 2;
  return (
    <>
      <section className="card prashna-verdict" id="prashna-result">
        <div className={`verdict-badge ${v.cls}`}>{v.label}</div>
        <div className="verdict-body">
          {res.question && <p className="verdict-q">“{res.question}”</p>}
          <p>{res.summary}</p>
          <div className="meter" aria-label={`Score ${res.score} from -100 to 100`}><span style={{ left: `${pct}%` }} /></div>
          <div className="meter-scale muted"><span>No</span><span>Mixed</span><span>Yes</span></div>
          <p className="muted kp-note">
            {res.topic.label} · {res.method === 'kp_number' ? `KP number ${res.kpNumber}, ascendant ${signDeg(res.chart.cusps[0].longitude)}` : `asked ${fmtLocal(res.chart.utc, tz)}`} · {placeName}
          </p>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h3>Why</h3></div>
        <ul className="factor-list">
          {res.factors.map((f, i) => (
            <li key={i} className={`factor f-${f.effect}`}>
              <b>{f.label}</b>
              <span>{f.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-head"><h3>When</h3></div>
        <p>{res.timingNote}</p>
        {res.fruitful.length > 0 && <div className="kp-plist">{res.fruitful.map((g) => <Planet key={g} id={g} />)}</div>}
        <h4>Ruling planets of the moment</h4>
        <RulingPlanets chart={res.chart} />
      </section>

      <section className="card kp-wheel-card">
        <div className="card-head"><h3>Prashna chart</h3><span className="muted">the {ordinal(res.topic.cusp)} house is highlighted</span></div>
        <KpWheel chart={res.chart} highlight={res.topic.cusp} />
        <p className="muted kp-note">Deciding sub lord: {pname(res.subLord)}, signifying {res.subLordHouses.join(', ') || 'no houses'}.</p>
      </section>

      <section className="card span-all">
        <div className="card-head"><h3>Cusps</h3></div>
        <KpCuspTable chart={res.chart} highlight={res.topic.cusp} />
      </section>
      <section className="card span-all">
        <div className="card-head"><h3>Significators</h3><span className="muted"><span className="h-good">green</span> fulfils, <span className="h-bad">red</span> denies</span></div>
        <KpSignificationTable chart={res.chart} mark={{ good: res.topic.favourable, bad: res.topic.adverse }} />
      </section>
    </>
  );
}
