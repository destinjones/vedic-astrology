import { useCallback, useEffect, useRef, useState } from 'react';
import type { YogaDefinition, YogaResult } from '@vedic/interpretations';
import type { BirthInput, Chart, PlanetId } from '../types/chart';
import type { Selection } from '../types/ui';
import { computeChart } from '../engine';
import { CITIES } from '../data/cities';
import { NorthChart } from '../components/NorthChart';
import { SouthChart } from '../components/SouthChart';
import { ChartTable } from '../components/ChartTable';
import { Glossed } from '../components/Gloss';
import { useDisplay } from '../lib/display';
import { interpretInput } from './chart';

type Interp = typeof import('@vedic/interpretations');

interface Question {
  chart: Chart;
  present: YogaResult[];
  answer: YogaResult;
  options: YogaDefinition[];
}

interface Score { right: number; total: number; streak: number; best: number }
const SCORE_KEY = 'vedic.quiz.v1';
const loadScore = (): Score => {
  try { const s = JSON.parse(localStorage.getItem(SCORE_KEY) ?? 'null'); if (s && Number.isFinite(s.total)) return s; } catch { /* ignore */ }
  return { right: 0, total: 0, streak: 0, best: 0 };
};

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const shuffle = <T,>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
const pad = (n: number) => String(n).padStart(2, '0');

/** A real chart for a random moment between 1940 and 2010, somewhere in the city list. */
function randomInput(): BirthInput {
  const t = Date.UTC(1940, 0, 1) + Math.random() * (Date.UTC(2010, 11, 31) - Date.UTC(1940, 0, 1));
  const d = new Date(t);
  const city = pick(CITIES);
  return {
    name: 'Quiz chart', date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(Math.floor(Math.random() * 24))}:${pad(Math.floor(Math.random() * 60))}`,
    place: city.name, latitude: city.latitude, longitude: city.longitude, timezone: city.timezone, ayanamsa: 'lahiri',
  };
}

// Yogas so common that they make a poor question on their own.
const EASY = new Set(['budha-aditya', 'raja', 'dhana']);

async function makeQuestion(m: Interp): Promise<Question> {
  for (let tries = 0; tries < 20; tries++) {
    const chart = await computeChart(randomInput());
    const present = m.detectYogas(await interpretInput(chart));
    const ids = new Set(present.map((y) => y.id));
    const pool = present.filter((y) => !EASY.has(y.id));
    if (!pool.length && tries < 5) continue;
    const answer = pick(pool.length ? pool : present.length ? present : []);
    if (!answer) continue;
    const absent = Object.keys(m.YOGA_DEFINITIONS).filter((id) => !ids.has(id));
    const options = shuffle([answer.id, ...shuffle(absent).slice(0, 3)]).map((id) => m.YOGA_DEFINITIONS[id]);
    return { chart, present, answer, options };
  }
  throw new Error('No chart with a yoga turned up');
}

/** Spot the yoga: a real chart, four yogas, exactly one of which forms. */
export function Quiz() {
  const [m, setM] = useState<Interp | null>(null);
  const [q, setQ] = useState<Question | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [score, setScore] = useState<Score>(loadScore);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [south, setSouth] = useState(false);
  const display = useDisplay();
  const result = useRef<HTMLDivElement>(null);
  const firstOption = useRef<HTMLButtonElement>(null);

  useEffect(() => { import('@vedic/interpretations').then(setM).catch((e) => console.error(e)); }, []);
  const next = useCallback(async () => {
    if (!m) return;
    setQ(null); setChosen(null); setHint(false); setSelection(null);
    const question = await makeQuestion(m);
    setQ(question);
    requestAnimationFrame(() => firstOption.current?.focus());
  }, [m]);
  useEffect(() => { if (m && !q) void next(); }, [m, q, next]);
  useEffect(() => { try { localStorage.setItem(SCORE_KEY, JSON.stringify(score)); } catch { /* ignore */ } }, [score]);

  const answer = (id: string) => {
    if (!q || chosen) return;
    setChosen(id);
    const ok = id === q.answer.id;
    setScore((s) => {
      const streak = ok ? s.streak + 1 : 0;
      return { right: s.right + (ok ? 1 : 0), total: s.total + 1, streak, best: Math.max(s.best, streak) };
    });
    const first = q.answer.involved[0] as PlanetId | undefined;
    if (first) setSelection({ kind: 'planet', id: first });
    requestAnimationFrame(() => result.current?.focus());
  };

  const props = q && { chart: q.chart, varga: q.chart.vargas.D1!, selection, hoverPlanet: null, onSelect: setSelection, onHoverPlanet: () => {} };
  return (
    <section className="card quiz" aria-labelledby="quiz-title">
      <div className="card-head">
        <h2 id="quiz-title" className="learn-h2">Spot the yoga</h2>
        <span className="muted" aria-live="polite">
          {score.total ? `${score.right} of ${score.total} right · streak ${score.streak} · best ${score.best}` : 'One of these four yogas forms in this chart. Which?'}
          {score.total > 0 && <> · <button className="link-btn" onClick={() => setScore({ right: 0, total: 0, streak: 0, best: 0 })}>reset</button></>}
        </span>
      </div>
      {!q && <p className="muted" role="status">Casting a chart…</p>}
      {q && props && (
        <div className="quiz-grid">
          <div>
            {display.chartTable ? <ChartTable {...props} /> : south ? <SouthChart {...props} /> : <NorthChart {...props} />}
            <p className="chart-keys">
              {q.chart.input.date} {q.chart.input.time}, {q.chart.input.place}.{' '}
              {!display.chartTable && <button className="link-btn" onClick={() => setSouth((s) => !s)}>{south ? 'North Indian style' : 'South Indian style'}</button>}
            </p>
          </div>
          <div>
            <fieldset className="quiz-options">
              <legend>Which yoga does this chart form?</legend>
              {q.options.map((o, i) => {
                const state = !chosen ? '' : o.id === q.answer.id ? ' is-right' : o.id === chosen ? ' is-wrong' : ' is-dim';
                return (
                  <button key={o.id} ref={i === 0 ? firstOption : undefined} type="button" className={`quiz-option${state}`} aria-pressed={chosen === o.id} disabled={!!chosen && chosen !== o.id && o.id !== q.answer.id} onClick={() => answer(o.id)}>
                    <b>{o.name}</b>
                    {(hint || chosen) && <span className="quiz-rule">{o.rule}</span>}
                  </button>
                );
              })}
            </fieldset>
            {!chosen && <button className="link-btn" onClick={() => setHint((h) => !h)}>{hint ? 'Hide the rules' : 'Show the rules as a hint'}</button>}
            {chosen && (
              <div className="quiz-result" ref={result} tabIndex={-1} role="status">
                <p className={chosen === q.answer.id ? 'good' : 'bad'}><b>{chosen === q.answer.id ? 'Right.' : `Not this time: it is ${q.answer.name}.`}</b></p>
                <p><b>Why it forms:</b> <Glossed text={q.answer.reason} /></p>
                <p className="muted"><b>The rule:</b> {q.options.find((o) => o.id === q.answer.id)?.rule}</p>
                {q.present.length > 1 && <p className="muted">This chart also forms {q.present.filter((y) => y.id !== q.answer.id).map((y) => y.name).filter((n, i, a) => a.indexOf(n) === i).join(', ')}.</p>}
                <button className="btn-primary" onClick={() => void next()}>Next chart</button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
