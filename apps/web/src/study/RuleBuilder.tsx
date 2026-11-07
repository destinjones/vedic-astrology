import { useEffect, useId, useMemo, useState } from 'react';
import {
  describeCondition, describeRule, DIGNITIES, emptyRule, evaluateRule, parseRule, RULE_EXAMPLES, ruleId, ruleToTypeScript,
  type ChartInput, type Condition, type Dignity, type PlanetRef, type RelationKind, type RuleGroup, type RuleNode, type YogaRule,
} from '@vedic/interpretations';
import type { Chart, PlanetId } from '../types/chart';
import { computeChart } from '../engine';
import { FAMOUS_CHARTS } from '../data/famousCharts';
import { PLANETS } from '../data/constants';
import { downloadText } from '../lib/backup';
import { useI18n } from '../i18n';
import { interpretInput, lastInput, SAMPLE_INPUT } from './chart';

const DRAFT_KEY = 'vedic.ruleBuilder.v1';
const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const HOUSE_PRESETS: [string, number[]][] = [['Kendra', [1, 4, 7, 10]], ['Trikona', [1, 5, 9]], ['Dusthana', [6, 8, 12]], ['Upachaya', [3, 6, 10, 11]]];
const DIGNITY_LABEL: Record<Dignity, string> = { exalted: 'Exalted', moolatrikona: 'Moolatrikona', own: 'Own sign', great_friend: 'Great friend', friend: 'Friend', neutral: 'Neutral', enemy: 'Enemy', great_enemy: 'Great enemy', debilitated: 'Debilitated' };
const RELATIONS: [RelationKind, string][] = [['sambandha', 'is related to (any sambandha)'], ['conjunction', 'is conjunct'], ['aspects', 'aspects'], ['mutual-aspect', 'is in mutual aspect with'], ['exchange', 'exchanges signs with']];
const CATEGORIES = ['raja', 'dhana', 'mahapurusha', 'lunar', 'solar', 'nabhasa', 'parivartana', 'viparita', 'neecha-bhanga', 'spiritual', 'arishta', 'other'] as const;

const ALL_PLANETS = PLANETS.map((p) => p.id) as PlanetId[];

const b64 = {
  enc: (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))),
};

function initialRule(): YogaRule {
  const m = /[#&]rule=([\w-]+)/.exec(location.hash);
  if (m) { try { const r = parseRule(JSON.parse(b64.dec(m[1]))); if (r) return r; } catch { /* ignore */ } }
  try { const r = parseRule(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null')); if (r) return r; } catch { /* ignore */ }
  return RULE_EXAMPLES[0];
}

const newCondition = (kind: Condition['kind']): Condition => {
  switch (kind) {
    case 'house': return { kind, planet: 'jupiter', houses: [1, 4, 7, 10], from: 'lagna' };
    case 'sign': return { kind, planet: 'mars', signs: [1, 8] };
    case 'dignity': return { kind, planet: { lordOf: 1 }, dignities: ['exalted', 'own'] };
    case 'relation': return { kind, a: { lordOf: 9 }, b: { lordOf: 10 }, via: 'sambandha' };
    case 'state': return { kind, planet: 'saturn', state: 'retrograde' };
  }
};

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

/* ------------------------------------------------------------------ pickers */

function PlanetPicker({ value, onChange, label }: { value: PlanetRef; onChange: (r: PlanetRef) => void; label: string }) {
  const { v } = useI18n();
  const kind = typeof value === 'string' ? value : 'lordOf' in value ? `lord:${value.lordOf}` : 'any';
  return (
    <span className="rb-planet">
      <select aria-label={label} value={kind} onChange={(e) => {
        const x = e.target.value;
        if (x === 'any') onChange({ anyOf: typeof value === 'string' ? [value] : ['jupiter', 'venus'] });
        else if (x.startsWith('lord:')) onChange({ lordOf: Number(x.slice(5)) });
        else onChange(x as PlanetId);
      }}>
        <optgroup label="Planet">{ALL_PLANETS.map((p) => <option key={p} value={p}>{v.planets[p].name}</option>)}</optgroup>
        <optgroup label="Lord of a house">{Array.from({ length: 12 }, (_, i) => <option key={i} value={`lord:${i + 1}`}>Lord of the {i + 1}{['st', 'nd', 'rd'][i] ?? 'th'}</option>)}</optgroup>
        <option value="any">Any of several…</option>
      </select>
      {typeof value === 'object' && 'anyOf' in value && (
        <span className="rb-chips" role="group" aria-label={`${label}: any of`}>
          {ALL_PLANETS.map((p) => (
            <button key={p} type="button" aria-pressed={value.anyOf.includes(p)} className={value.anyOf.includes(p) ? 'is-on' : ''}
              onClick={() => { const next = toggle(value.anyOf, p); if (next.length) onChange({ anyOf: next }); }}>{v.planets[p].short}</button>
          ))}
        </span>
      )}
    </span>
  );
}

function NumberChips({ values, max, names, onChange, label, presets }: { values: number[]; max: number; names?: string[]; onChange: (xs: number[]) => void; label: string; presets?: [string, number[]][] }) {
  return (
    <span className="rb-chips-wrap">
      <span className="rb-chips" role="group" aria-label={label}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button key={n} type="button" aria-pressed={values.includes(n)} className={values.includes(n) ? 'is-on' : ''} title={names?.[n - 1]}
            aria-label={names ? names[n - 1] : `${n}`} onClick={() => onChange(toggle(values, n).sort((a, b) => a - b))}>{names ? names[n - 1].slice(0, 3) : n}</button>
        ))}
      </span>
      {presets && <span className="rb-presets">{presets.map(([n, xs]) => <button key={n} type="button" className="link-btn" onClick={() => onChange(xs)}>{n}</button>)}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ editors */

type Results = Map<RuleNode, boolean>;
const Badge = ({ pass }: { pass: boolean | undefined }) =>
  pass === undefined ? null : <span className={`rb-badge ${pass ? 'is-pass' : 'is-fail'}`}>{pass ? '✓ holds' : '✗ does not hold'}</span>;

function ConditionEditor({ c, onChange, onRemove, results }: { c: Condition; onChange: (c: Condition) => void; onRemove: () => void; results: Results }) {
  const { v } = useI18n();
  const id = useId();
  return (
    <li className="rb-cond">
      <div className="rb-row">
        <select aria-label="Kind of condition" value={c.kind} onChange={(e) => onChange(newCondition(e.target.value as Condition['kind']))}>
          <option value="house">Planet in a house</option>
          <option value="sign">Planet in a sign</option>
          <option value="dignity">Planet’s dignity</option>
          <option value="relation">Two planets related</option>
          <option value="state">Planet’s condition</option>
        </select>
        <button type="button" className="btn-ghost sm" onClick={onRemove} aria-label={`Remove: ${describeCondition(c)}`}>Remove</button>
      </div>
      <div className="rb-row">
        {c.kind === 'relation' ? (
          <>
            <PlanetPicker label="First planet" value={c.a} onChange={(a) => onChange({ ...c, a })} />
            <select aria-label="Relation" value={c.via} onChange={(e) => onChange({ ...c, via: e.target.value as RelationKind })}>
              {RELATIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <PlanetPicker label="Second planet" value={c.b} onChange={(b) => onChange({ ...c, b })} />
          </>
        ) : (
          <PlanetPicker label="Planet" value={c.planet} onChange={(planet) => onChange({ ...c, planet })} />
        )}
        {c.kind === 'house' && (
          <>
            <span>in house</span>
            <NumberChips label="Houses" values={c.houses} max={12} presets={HOUSE_PRESETS} onChange={(houses) => onChange({ ...c, houses })} />
            <label htmlFor={id}>counted from</label>
            <select id={id} value={c.from} onChange={(e) => onChange({ ...c, from: e.target.value as 'lagna' })}>
              <option value="lagna">the lagna</option>
              {ALL_PLANETS.map((p) => <option key={p} value={p}>{v.planets[p].name}</option>)}
            </select>
          </>
        )}
        {c.kind === 'sign' && <><span>in</span><NumberChips label="Signs" values={c.signs} max={12} names={SIGNS} onChange={(signs) => onChange({ ...c, signs })} /></>}
        {c.kind === 'dignity' && (
          <span className="rb-chips" role="group" aria-label="Dignities">
            {DIGNITIES.map((d) => <button key={d} type="button" aria-pressed={c.dignities.includes(d)} className={c.dignities.includes(d) ? 'is-on' : ''} onClick={() => onChange({ ...c, dignities: toggle(c.dignities, d) })}>{DIGNITY_LABEL[d]}</button>)}
          </span>
        )}
        {c.kind === 'state' && (
          <select aria-label="Condition" value={c.state} onChange={(e) => onChange({ ...c, state: e.target.value as 'retrograde' })}>
            <option value="retrograde">is retrograde</option>
            <option value="combust">is combust</option>
            <option value="strong">is strong (exalted, moolatrikona or own)</option>
            <option value="weak">is weak (debilitated or combust)</option>
            <option value="benefic">acts as a benefic</option>
          </select>
        )}
      </div>
      <p className="rb-says">{describeCondition(c)} <Badge pass={results.get(c)} /></p>
    </li>
  );
}

const OPS: { label: string; op: 'all' | 'any'; negate: boolean }[] = [
  { label: 'All of these', op: 'all', negate: false },
  { label: 'Any of these', op: 'any', negate: false },
  { label: 'None of these', op: 'any', negate: true },
  { label: 'Not all of these', op: 'all', negate: true },
];

function GroupEditor({ g, onChange, onRemove, results, depth }: { g: RuleGroup; onChange: (g: RuleGroup) => void; onRemove?: () => void; results: Results; depth: number }) {
  const opIndex = OPS.findIndex((o) => o.op === g.op && o.negate === !!g.negate);
  const setItem = (i: number, n: RuleNode) => onChange({ ...g, items: g.items.map((x, j) => (j === i ? n : x)) });
  const removeItem = (i: number) => onChange({ ...g, items: g.items.filter((_, j) => j !== i) });
  return (
    <div className={`rb-group depth-${depth}`} role="group" aria-label={`${OPS[opIndex].label}, ${g.items.length} item${g.items.length === 1 ? '' : 's'}`}>
      <div className="rb-row">
        <select aria-label="How the conditions combine" value={opIndex} onChange={(e) => { const o = OPS[Number(e.target.value)]; onChange({ ...g, op: o.op, negate: o.negate || undefined }); }}>
          {OPS.map((o, i) => <option key={o.label} value={i}>{o.label}</option>)}
        </select>
        <Badge pass={results.get(g)} />
        {onRemove && <button type="button" className="btn-ghost sm" onClick={onRemove}>Remove group</button>}
      </div>
      <ul className="rb-items">
        {g.items.map((n, i) => n.kind === 'group'
          ? <li key={i}><GroupEditor g={n} depth={depth + 1} results={results} onChange={(x) => setItem(i, x)} onRemove={() => removeItem(i)} /></li>
          : <ConditionEditor key={i} c={n} results={results} onChange={(x) => setItem(i, x)} onRemove={() => removeItem(i)} />)}
      </ul>
      <div className="rb-row">
        <button type="button" className="btn-ghost sm" onClick={() => onChange({ ...g, items: [...g.items, newCondition('house')] })}>+ Condition</button>
        {depth < 3 && <button type="button" className="btn-ghost sm" onClick={() => onChange({ ...g, items: [...g.items, { kind: 'group', op: 'any', items: [newCondition('house')] }] })}>+ Group</button>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ the page */

export function RuleBuilder() {
  const [rule, setRule] = useState<YogaRule>(initialRule);
  const [chart, setChart] = useState<{ ui: Chart; ci: ChartInput } | null>(null);
  const [famous, setFamous] = useState<{ done: number; hits: string[] } | null>(null);
  const [copied, setCopied] = useState('');
  const input = useMemo(() => lastInput() ?? SAMPLE_INPUT, []);

  useEffect(() => {
    let live = true;
    computeChart(input).then(async (ui) => { const ci = await interpretInput(ui); if (live) setChart({ ui, ci }); }).catch((e) => console.error(e));
    return () => { live = false; };
  }, [input]);
  useEffect(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(rule)); } catch { /* ignore */ } setFamous(null); }, [rule]);

  const evaluation = useMemo(() => (chart ? evaluateRule(rule.root, chart.ci) : null), [rule, chart]);
  const results: Results = useMemo(() => new Map(evaluation?.trace.map((t) => [t.node, t.pass]) ?? []), [evaluation]);
  const code = useMemo(() => ruleToTypeScript(rule), [rule]);
  const text = describeRule(rule.root);

  const testFamous = async () => {
    const hits: string[] = [];
    setFamous({ done: 0, hits });
    for (const [i, f] of FAMOUS_CHARTS.entries()) {
      const ui = await computeChart(f.input);
      if (evaluateRule(rule.root, await interpretInput(ui)).pass) hits.push(f.label);
      setFamous({ done: i + 1, hits: [...hits] });
      // let the page breathe between charts
      await new Promise((r) => setTimeout(r, 0));
    }
  };
  const copy = async (what: string, s: string) => {
    try { await navigator.clipboard.writeText(s); setCopied(what); setTimeout(() => setCopied(''), 2000); } catch { setCopied('Copy failed: select the text instead'); }
  };
  const shareUrl = () => `${location.origin}${location.pathname}#builder&rule=${b64.enc(JSON.stringify(rule))}`;

  return (
    <section className="card rule-builder" aria-labelledby="rb-title">
      <div className="card-head">
        <h2 id="rb-title" className="learn-h2">Yoga rule builder</h2>
        <label className="muted">Start from{' '}
          <select value="" onChange={(e) => { const i = Number(e.target.value); setRule(i < 0 ? emptyRule() : structuredClone(RULE_EXAMPLES[i])); }}>
            <option value="" disabled>an example…</option>
            {RULE_EXAMPLES.map((r, i) => <option key={r.id} value={i}>{r.name}</option>)}
            <option value={-1}>a blank rule</option>
          </select>
        </label>
      </div>
      <p className="muted">Write a yoga as conditions, see at once whether a chart forms it, then export it as TypeScript for the interpretation library. The examples reproduce the built-in detectors exactly.</p>

      <div className="rb-meta">
        <label>Name <input value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value, id: ruleId(e.target.value) })} /></label>
        <label>Category <select value={rule.category} onChange={(e) => setRule({ ...rule, category: e.target.value as YogaRule['category'] })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <label>Tone <select value={rule.tone} onChange={(e) => setRule({ ...rule, tone: e.target.value as YogaRule['tone'] })}><option value="benefic">supportive</option><option value="mixed">mixed</option><option value="challenging">challenging</option></select></label>
        <label className="rb-summary">What it gives <input value={rule.summary} placeholder="One sentence for the reading" onChange={(e) => setRule({ ...rule, summary: e.target.value })} /></label>
      </div>

      <div className="rb-layout">
        <div>
          <GroupEditor g={rule.root} depth={0} results={results} onChange={(root) => setRule({ ...rule, root })} />
        </div>
        <aside className="rb-side">
          <h3>The rule</h3>
          <p className="rb-rule">{text}.</p>
          <h3>In {input === SAMPLE_INPUT ? 'the sample chart' : input.name ? `${input.name}’s chart` : 'your chart'}</h3>
          {!evaluation ? <p className="muted">Working out the chart…</p> : (
            <p className={evaluation.pass ? 'good' : 'bad'} role="status"><b>{rule.name} {evaluation.pass ? 'forms' : 'does not form'}.</b></p>
          )}
          <h3>In the famous charts</h3>
          {!famous && <button className="btn-ghost sm" onClick={() => void testFamous()}>Test against {FAMOUS_CHARTS.length} famous charts</button>}
          {famous && (
            <p role="status">
              {famous.done < FAMOUS_CHARTS.length ? `Checked ${famous.done} of ${FAMOUS_CHARTS.length}… ` : ''}
              {famous.hits.length} form it{famous.hits.length ? `: ${famous.hits.join('; ')}` : ''}.
            </p>
          )}
        </aside>
      </div>

      <h3>Export</h3>
      <div className="rb-export-actions">
        <button className="btn-primary" onClick={() => void copy('TypeScript copied', code)}>Copy TypeScript</button>
        <button className="btn-ghost" onClick={() => downloadText(code, `${rule.id}.ts`)}>Download {rule.id}.ts</button>
        <button className="btn-ghost" onClick={() => void copy('Link copied', shareUrl())}>Copy a share link</button>
        <span className="muted" aria-live="polite">{copied}</span>
      </div>
      <pre className="rb-code" tabIndex={0} aria-label="Generated TypeScript"><code>{code}</code></pre>
      <p className="muted">The code imports only helpers the interpretation package exports. To add it to the app, paste the definition into <code>YOGA_DEFINITIONS</code> in <code>packages/interpretations/src/yogas.ts</code> and call the detector from <code>detectAll</code>.</p>
    </section>
  );
}
