import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { YogaResult } from '@vedic/interpretations';
import type { BirthInput, Chart, DashaPeriod, PlanetId } from '../types/chart';
import type { Selection } from '../types/ui';
import { computeChart } from '../engine';
import { NorthChart } from '../components/NorthChart';
import { Glossed, Term } from '../components/Gloss';
import { HOUSES, PLANETS, signInfo } from '../data/constants';
import { DIGNITY_KEY, dignityOf, dignityTone, housesRuledBy, ordinal } from '../lib/astro';
import { useI18n } from '../i18n';
import { interpretInput, lastInput, SAMPLE_INPUT } from './chart';

const DASHA_YEARS: Record<PlanetId, number> = { ketu: 7, venus: 20, sun: 6, moon: 10, mars: 7, rahu: 18, jupiter: 16, saturn: 19, mercury: 17 };
const at = (periods: DashaPeriod[] | undefined, now: number) => periods?.find((p) => Date.parse(p.start) <= now && now < Date.parse(p.end));
const year = (iso: string) => iso.slice(0, 4);

interface Step { id: string; title: string; select: Selection | null; body: ReactNode }

/** A walk through one chart in the order a reader learns it: lagna, houses, Moon, grahas, yogas, dashas. */
export function Primer() {
  const own = useMemo(() => lastInput(), []);
  const [input, setInput] = useState<BirthInput>(own ?? SAMPLE_INPUT);
  const [chart, setChart] = useState<Chart | null>(null);
  const [yogas, setYogas] = useState<YogaResult[] | null>(null);
  const [step, setStep] = useState(0);
  const [selection, setSelection] = useState<Selection | null>({ kind: 'asc' });
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const { v } = useI18n();

  useEffect(() => {
    let live = true;
    setChart(null);
    setYogas(null);
    computeChart(input).then(async (c) => {
      if (!live) return;
      setChart(c);
      const m = await import('@vedic/interpretations');
      const ci = await interpretInput(c);
      if (live) setYogas(m.detectYogas(ci));
    }).catch((e) => console.error(e));
    return () => { live = false; };
  }, [input]);

  const steps = useMemo<Step[]>(() => {
    if (!chart) return [];
    const asc = chart.ascendant;
    const ascSign = signInfo(asc.sign);
    const lord = ascSign.lord as PlanetId;
    const lordPos = chart.planets.find((p) => p.id === lord)!;
    const moon = chart.planets.find((p) => p.id === 'moon')!;
    const now = Date.now();
    const md = at(chart.dasha, now);
    const ad = at(md?.sub, now);
    const nextMd = chart.dasha && md ? chart.dasha[chart.dasha.indexOf(md) + 1] : undefined;
    const dig = PLANETS.filter((p) => p.id !== 'rahu' && p.id !== 'ketu').map((p) => {
      const pos = chart.planets.find((x) => x.id === p.id)!;
      return { id: p.id, d: dignityOf(p.id, pos.sign), pos };
    });
    const strong = dig.filter((x) => dignityTone(x.d) === 'good');
    const weak = dig.filter((x) => x.d === 'Debilitated' || x.pos.combust);
    const name = (id: PlanetId) => v.planets[id].name;
    const sign = (n: number) => v.signs[n - 1];
    const who = input === SAMPLE_INPUT ? 'the sample chart' : input.name ? `${input.name}’s chart` : 'your chart';

    return [
      {
        id: 'lagna', title: '1. The lagna, where the chart begins', select: { kind: 'asc' },
        body: <>
          <p><Glossed text="Every Vedic chart is built on the lagna: the sign rising on the eastern horizon at the moment of birth. It becomes the 1st house, and every other house is counted from it, one sign per house. Two people born on the same day hours apart share their planets' signs but not their lagna, so their charts read very differently." /></p>
          <p className="primer-you">In {who} the lagna is <b>{sign(asc.sign)}</b> {ascSign.glyph}, at {Math.floor(asc.degreeInSign)}°. {sign(asc.sign)} is a {ascSign.element.toLowerCase()} sign of {ascSign.modality.toLowerCase()} quality, and its lord is <b>{name(lord)}</b>, which sits in the {ordinal(lordPos.house)} house. The lagna lord is the chart’s own representative: where it goes, the life tends to follow.</p>
          <p className="muted">In the drawing, the lagna is the top diamond, marked “Asc”. The chart always keeps the 1st house there; the signs move around it.</p>
        </>,
      },
      {
        id: 'houses', title: '2. Twelve houses, twelve areas of life', select: { kind: 'house', num: 10 },
        body: <>
          <p><Glossed text="Each house is a bhava, an area of life: the 1st is the self and body, the 4th home and mother, the 7th partners, the 10th work and standing. The houses fall into families. The kendra houses (1, 4, 7, 10) are the pillars, the trikona houses (1, 5, 9) bring fortune, and the dusthana houses (6, 8, 12) bring struggle that can also heal and free." /></p>
          <p className="primer-you">The sign on a house tells you its lord. In {who} the 10th house of career holds {sign(((asc.sign + 8) % 12) + 1)}, so its lord is {name(signInfo(((asc.sign + 8) % 12) + 1).lord as PlanetId)}. Following each lord to the house it sits in is how a reading connects one area of life to another.</p>
          <ul className="primer-houses">
            {[1, 4, 7, 10, 5, 9].map((h) => <li key={h}><b>{h}</b> {HOUSES[h - 1].bhava}: {HOUSES[h - 1].themes}</li>)}
          </ul>
        </>,
      },
      {
        id: 'moon', title: '3. The Moon, the mind and the birth star', select: { kind: 'planet', id: 'moon' },
        body: <>
          <p><Glossed text="After the lagna, the Moon is the most important point. It stands for the mind and feelings, and Indian astrologers often read the whole chart again with the Moon's sign as the 1st house. The Moon's nakshatra at birth, the janma nakshatra, decides where your dasha sequence begins and is used in matching charts." /></p>
          <p className="primer-you">In {who} the Moon is in <b>{sign(moon.sign)}</b>, in the {ordinal(moon.house)} house, in the nakshatra <b>{v.nakshatras[moon.nakshatra - 1]}</b> (pada {moon.pada}). Your Vimshottari dasha began with the lord of {v.nakshatras[moon.nakshatra - 1]}.</p>
        </>,
      },
      {
        id: 'grahas', title: '4. The grahas and how comfortable they are', select: strong[0] ? { kind: 'planet', id: strong[0].id } : null,
        body: <>
          <p><Glossed text="The nine grahas are the actors. How well each can act depends first on its dignity: exalted is a planet at its best, then moolatrikona and its own sign, then friendly, neutral and enemy signs, down to debilitated, its weakest sign. A combust planet, too close to the Sun, also loses independence." /></p>
          <p className="primer-you">
            {strong.length ? <>In {who}, {strong.map((x) => `${name(x.id)} (${v.dignity[DIGNITY_KEY[x.d]].toLowerCase()})`).join(', ')} {strong.length === 1 ? 'is' : 'are'} in strong dignity. </> : <>No planet in {who} is exalted or in its own sign, which is common. </>}
            {weak.length ? <>{weak.map((x) => `${name(x.id)}${x.pos.combust ? ' (combust)' : ' (debilitated)'}`).join(', ')} {weak.length === 1 ? 'needs' : 'need'} support from elsewhere in the chart.</> : <>None is debilitated or combust.</>}
          </p>
          <p className="muted">A planet also rules the houses whose signs it owns. {name(lord)}, the lagna lord, rules house{housesRuledBy(lord, asc.sign).length > 1 ? 's' : ''} {housesRuledBy(lord, asc.sign).join(' and ')}.</p>
        </>,
      },
      {
        id: 'yogas', title: '5. Yogas, the combinations that stand out', select: yogas?.[0]?.involved[0] ? { kind: 'planet', id: yogas[0].involved[0] as PlanetId } : null,
        body: <>
          <p><Glossed text="A yoga is a combination the classical texts single out: a planet in a particular house from another, two lords joined, an exchange of signs. Each one has a precise rule. Some are common, some rare; a yoga promises a theme, and the dashas decide when it is delivered." /></p>
          {!yogas && <p className="muted">Checking the yogas…</p>}
          {yogas && (
            <>
              <p className="primer-you">{who.charAt(0).toUpperCase() + who.slice(1)} forms {yogas.length} yoga{yogas.length === 1 ? '' : 's'}. The first few, and why each one forms:</p>
              <ul className="primer-yogas">
                {yogas.slice(0, 4).map((y) => <li key={y.id + y.reason}><b>{y.name}</b> <span className="muted">({y.strength})</span>: <Glossed text={y.reason} /></li>)}
              </ul>
              <p>Practise finding them yourself in <a href="#quiz">Spot the yoga</a>, or write your own rule in the <a href="#builder">rule builder</a>.</p>
            </>
          )}
        </>,
      },
      {
        id: 'dashas', title: '6. Dashas, the timing of it all', select: md ? { kind: 'planet', id: md.lord } : null,
        body: <>
          <p><Glossed text="The Vimshottari dasha divides a 120-year life into nine planetary periods, always in the same order: Ketu 7 years, Venus 20, Sun 6, Moon 10, Mars 7, Rahu 18, Jupiter 16, Saturn 19, Mercury 17. Each mahadasha is split into nine antardasha sub-periods in the same order. A planet's period brings its houses, its dignity and its yogas to the front of life." /></p>
          {md ? (
            <p className="primer-you">
              Right now {who} runs the <b>{name(md.lord)}</b> mahadasha ({year(md.start)}–{year(md.end)}, {DASHA_YEARS[md.lord]} years in full){ad ? <>, in the <b>{name(ad.lord)}</b> antardasha until {ad.end.slice(0, 10)}</> : null}.
              {' '}{name(md.lord)} sits in the {ordinal(chart.planets.find((p) => p.id === md.lord)!.house)} house, so that house’s matters are in focus.
              {nextMd ? <> The {name(nextMd.lord)} mahadasha follows in {year(nextMd.start)}.</> : null}
            </p>
          ) : <p className="muted">This chart has no dasha dates (the preview calculator does not work them out).</p>}
        </>,
      },
      {
        id: 'next', title: '7. Where to go from here', select: null,
        body: <>
          <p>That is the order a reading takes: the lagna and its lord, the houses and their lords, the Moon, the condition of each graha, the yogas, and the dashas that time them. Everything else in the explorer, the sixteen divisional charts, the strength scores, the transits, refines one of those six steps.</p>
          <ul>
            <li><a href={`${import.meta.env.BASE_URL}app/`}>Open the chart in the explorer</a> and click any planet or house for its full reading.</li>
            <li>Look words up in the <a href="#glossary">glossary</a>. Underlined words in any reading show their meaning when you hover or focus them, like <Term id="vargottama" />.</li>
            <li>Test yourself with <a href="#quiz">Spot the yoga</a>.</li>
          </ul>
        </>,
      },
    ];
  }, [chart, yogas, v, input]);

  // move focus to the new step's heading so screen readers and keyboard users follow along
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    heading.current?.focus();
  }, [step]);
  useEffect(() => { setSelection(steps[step]?.select ?? null); }, [steps, step]);

  const cur = steps[step];
  return (
    <section className="card primer" aria-labelledby="primer-title">
      <div className="card-head">
        <h2 id="primer-title" className="learn-h2">Read a chart in seven steps</h2>
        <span className="muted">
          {own && input !== own ? <button className="link-btn" onClick={() => setInput(own)}>Use my chart</button>
            : own ? <button className="link-btn" onClick={() => setInput(SAMPLE_INPUT)}>Use the sample chart</button>
              : 'Using the sample chart. Open your own in the explorer and it appears here.'}
        </span>
      </div>
      <ol className="primer-steps" aria-label="Steps">
        {(steps.length ? steps : Array.from({ length: 7 }, (_, i) => ({ id: String(i), title: '…' }))).map((s, i) => (
          <li key={s.id}>
            <button type="button" className={i === step ? 'is-active' : ''} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)} disabled={!steps.length}>
              {s.title.replace(/^\d+\.\s*/, '').split(',')[0]}
            </button>
          </li>
        ))}
      </ol>
      {!chart && <p className="muted" role="status">Working out the chart…</p>}
      {chart && cur && (
        <div className="primer-grid">
          <div className="primer-chart">
            <NorthChart chart={chart} varga={chart.vargas.D1!} selection={selection} hoverPlanet={null} onSelect={setSelection} onHoverPlanet={() => {}} />
          </div>
          <div className="primer-body">
            <h3 ref={heading} tabIndex={-1}>{cur.title}</h3>
            {cur.body}
            <div className="primer-nav">
              <button className="btn-ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>Back</button>
              <span className="muted">{step + 1} of {steps.length}</span>
              <button className="btn-primary" onClick={() => setStep((s) => s + 1)} disabled={step === steps.length - 1}>Next</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
