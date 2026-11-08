import { useEffect, useMemo, useRef, useState } from 'react';
import { DOSHA_DEFINITIONS, YOGA_DEFINITIONS, fromEngineChart, interpretChart } from '@vedic/interpretations';
import type { Chart } from '../types/chart';
import { NAKSHATRAS, PLANET_BY_ID, SIGNS } from '../data/constants';
import { chartPlacements, labelFor, nameKeys, ordinal, PLANET_IDS, TOPICS, topicLabel, type Found } from './placements';
import {
  deletePhrase, deleteTemplate, exportLibrary, hasText, importLibrary, newId, phrasesForTopics, readingFromTemplate,
  restoreStarters, saveTemplate, savePhrase, setReading, templateFromReading, useReading, usePhrases, useTemplates, withPhrase,
  type Phrase, type Reading, type ReadingTemplate, type TemplateSection,
} from './store';
import { PhraseTools } from './PhraseTools';
import './practice.css';

type Tab = 'reading' | 'phrases' | 'templates' | 'library';
const TABS: [Tab, string][] = [['reading', 'This client’s reading'], ['phrases', 'Saved phrases'], ['templates', 'Reading templates'], ['library', 'Export and import']];

// every yoga and dosha the app knows, so a phrase can be filed under one this chart does not have
nameKeys([
  ...Object.values(YOGA_DEFINITIONS).map((y) => ({ key: `yoga:${y.id}`, name: y.name })),
  ...Object.values(DOSHA_DEFINITIONS).map((d) => ({ key: `dosha:${d.id}`, name: d.name })),
]);

export default function PracticeDialog({ chart, onClose, initialTab = 'reading' }: { chart: Chart; onClose: () => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const dialog = useRef<HTMLDialogElement>(null);
  const ec = chart.engineContext?.chart;
  const found = useMemo<Found | null>(() => {
    if (!ec) return null;
    const r = interpretChart(fromEngineChart(ec));
    return { yogas: r.yogas.map((y) => ({ id: y.id, name: y.name })), doshas: r.doshas.map((d) => ({ id: d.id, name: d.name, present: d.present })) };
  }, [ec]);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const who = chart.input.name?.trim() || 'this chart';

  return (
    <dialog ref={dialog} className="consult-dialog book-dialog practice-dialog" onClose={onClose} onCancel={onClose} aria-labelledby="practice-title">
      <form method="dialog" onSubmit={(e) => e.preventDefault()}>
        <header>
          <h3 id="practice-title">Readings and phrases</h3>
          <p className="muted">
            Your own reading templates and write-ups, reused for every client. Phrases you save for a placement are suggested whenever it comes up again,
            here, in the consultation PDF and in the Life Chart Book. Everything stays in this browser; export it to keep a copy or move it to another.
          </p>
        </header>
        <div className="book-tabs" role="tablist" aria-label="Readings and phrases">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        <div className="book-panel" role="tabpanel">
          {tab === 'reading' && <ReadingTab chart={chart} found={found} who={who} />}
          {tab === 'phrases' && <PhrasesTab chart={chart} found={found} />}
          {tab === 'templates' && <TemplatesTab />}
          {tab === 'library' && <LibraryTab />}
        </div>
        <footer>
          <button type="button" className="btn-primary" onClick={() => dialog.current?.close()}>Done</button>
        </footer>
      </form>
    </dialog>
  );
}

// ------------------------------------------------------------------ this client's reading

function ReadingTab({ chart, found, who }: { chart: Chart; found: Found | null; who: string }) {
  const templates = useTemplates();
  const phrases = usePhrases();
  const reading = useReading(chart.input);
  const [pick, setPick] = useState(templates[0]?.id ?? '');
  const [fill, setFill] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  if (!reading) {
    const t = templates.find((x) => x.id === pick) ?? templates[0];
    return (
      <fieldset>
        <legend>Start a reading for {who}</legend>
        {!templates.length ? (
          <p className="muted">You have no reading templates yet. Make one in Reading templates, or add the starter templates there.</p>
        ) : (
          <>
            <label>Template
              <select value={t?.id} onChange={(e) => setPick(e.target.value)}>
                {templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            {t && (
              <div className="practice-item">
                <h4>{t.name}</h4>
                {t.about && <p>{t.about}</p>}
                <p>{t.sections.map((s) => s.heading).join(' · ')}</p>
              </div>
            )}
            <label className="consult-section">
              <input type="checkbox" checked={fill} onChange={(e) => setFill(e.target.checked)} />
              <span><b>Start with my saved phrases</b><small className="muted">Each section begins with your phrases for the placements it covers in this chart. You edit from there.</small></span>
            </label>
            <div className="practice-row end">
              <button type="button" className="btn-primary" disabled={!t} onClick={() => t && setReading(chart.input, readingFromTemplate(t, { chart, phrases, found, fill }))}>Start reading</button>
            </div>
          </>
        )}
      </fieldset>
    );
  }

  const update = (patch: Partial<Reading>) => setReading(chart.input, { ...reading, ...patch, updatedAt: new Date().toISOString() });
  const setSection = (i: number, patch: Partial<Reading['sections'][number]>) => update({ sections: reading.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i: number, d: -1 | 1) => {
    const s = [...reading.sections];
    const j = i + d;
    if (j < 0 || j >= s.length) return;
    [s[i], s[j]] = [s[j], s[i]];
    update({ sections: s });
  };
  const fillEmpty = () => {
    let n = 0;
    update({
      sections: reading.sections.map((s) => {
        if (s.text.trim()) return s;
        const text = phrasesForTopics(phrases, chart, s.topics, found).reduce((acc, p) => withPhrase(acc, p.text), '');
        if (text) n++;
        return text ? { ...s, text } : s;
      }),
    });
    setNote(n ? `Filled ${n} section${n === 1 ? '' : 's'} from your phrases.` : 'No saved phrases match the empty sections.');
  };
  const base = templates.find((t) => t.id === reading.templateId);

  return (
    <fieldset>
      <legend>Reading for {who}</legend>
      <p className="muted">
        {hasText(reading) ? 'Printed in the Consultation export, after your note.' : 'Write in any section; sections left empty are not printed.'} Saved as you type.
      </p>
      <label>Title<input value={reading.title} onChange={(e) => update({ title: e.target.value })} /></label>
      <label>Opening line<textarea rows={2} value={reading.intro} onChange={(e) => update({ intro: e.target.value })} placeholder="optional, e.g. Prepared for our session on 12 March" /></label>
      {reading.sections.map((s, i) => (
        <div key={s.id} className="practice-section">
          <div className="practice-row">
            <input aria-label="Section heading" value={s.heading} onChange={(e) => setSection(i, { heading: e.target.value })} />
            <button type="button" className="btn-ghost sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${s.heading} up`}>↑</button>
            <button type="button" className="btn-ghost sm" onClick={() => move(i, 1)} disabled={i === reading.sections.length - 1} aria-label={`Move ${s.heading} down`}>↓</button>
            <button type="button" className="btn-ghost sm" onClick={() => update({ sections: reading.sections.filter((_, j) => j !== i) })} disabled={reading.sections.length === 1} aria-label={`Remove ${s.heading}`}>✕</button>
          </div>
          {(s.guide || s.topics.length > 0) && (
            <p className="practice-guide">{s.guide}{s.topics.length > 0 && ` (About: ${s.topics.map(topicLabel).join(', ')}.)`}</p>
          )}
          <textarea aria-label={s.heading} rows={4} value={s.text} onChange={(e) => setSection(i, { text: e.target.value })} placeholder="Blank lines start new paragraphs." />
          <PhraseTools chart={chart} topics={s.topics.length ? s.topics : ['all']} found={found} value={s.text} onChange={(text) => setSection(i, { text })} />
        </div>
      ))}
      <div className="practice-row">
        <button type="button" className="btn-ghost sm" onClick={() => update({ sections: [...reading.sections, { id: newId('s'), heading: 'New section', guide: '', topics: [], text: '' }] })}>Add a section</button>
        <button type="button" className="btn-ghost sm" onClick={fillEmpty}>Fill empty sections from my phrases</button>
        <button type="button" className="btn-ghost sm" onClick={() => {
          saveTemplate(templateFromReading(reading, base));
          setNote(base ? `Saved these sections back to “${base.name}”.` : `Saved as a new template, “${reading.title}”.`);
        }}>{base ? `Save sections to “${base.name}”` : 'Save as a template'}</button>
        <span className="grow" />
        <button type="button" className="btn-ghost sm" onClick={() => { if (confirm(`Delete this reading for ${who} and start again?`)) setReading(chart.input, null); }}>Start over</button>
      </div>
      {note && <p className="muted" role="status">{note}</p>}
    </fieldset>
  );
}

// ------------------------------------------------------------------ saved phrases

const KINDS = [
  ['p-nak', 'Planet in nakshatra'], ['p-sign', 'Planet in sign'], ['p-house', 'Planet in house'],
  ['asc-sign', 'Rising sign'], ['asc-nak', 'Rising nakshatra'], ['house-sign', 'House in sign'], ['lord', 'Lord of a house in a house'],
  ['yoga', 'Yoga'], ['dosha', 'Dosha'],
] as const;
type Kind = typeof KINDS[number][0];

/** Builds any placement key, whether or not it is in this chart. */
function KeyBuilder({ onAdd }: { onAdd: (key: string) => void }) {
  const [kind, setKind] = useState<Kind>('p-nak');
  const [a, setA] = useState('moon');
  const [b, setB] = useState('1');
  const houses = Array.from({ length: 12 }, (_, i) => i + 1);
  const planetSel = <select aria-label="Planet" value={a} onChange={(e) => setA(e.target.value)}>{PLANET_IDS.map((id) => <option key={id} value={id}>{PLANET_BY_ID[id].name}</option>)}</select>;
  const houseSel = (v: string, set: (s: string) => void, label: string) => <select aria-label={label} value={v} onChange={(e) => set(e.target.value)}>{houses.map((h) => <option key={h} value={h}>{ordinal(h)} house</option>)}</select>;
  const signSel = <select aria-label="Sign" value={b} onChange={(e) => setB(e.target.value)}>{SIGNS.map((s) => <option key={s.num} value={s.num}>{s.name}</option>)}</select>;
  const nakSel = <select aria-label="Nakshatra" value={b} onChange={(e) => setB(e.target.value)}>{NAKSHATRAS.map((n) => <option key={n.num} value={n.num}>{n.name}</option>)}</select>;
  const yogaSel = <select aria-label="Yoga" value={b} onChange={(e) => setB(e.target.value)}><option value="">Choose…</option>{Object.values(YOGA_DEFINITIONS).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select>;
  const doshaSel = <select aria-label="Dosha" value={b} onChange={(e) => setB(e.target.value)}><option value="">Choose…</option>{Object.values(DOSHA_DEFINITIONS).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>;
  const reset = (k: Kind) => { setKind(k); setB(k === 'yoga' || k === 'dosha' ? '' : '1'); if (k === 'house-sign' || k === 'lord') setA('1'); else if (k.startsWith('p-')) setA('moon'); };
  const key = {
    'p-nak': `p:${a}:nak:${b}`, 'p-sign': `p:${a}:sign:${b}`, 'p-house': `p:${a}:house:${b}`,
    'asc-sign': `asc:sign:${b}`, 'asc-nak': `asc:nak:${b}`, 'house-sign': `house:${a}:sign:${b}`, lord: `lord:${a}:house:${b}`,
    yoga: b ? `yoga:${b}` : '', dosha: b ? `dosha:${b}` : '',
  }[kind];
  return (
    <div className="practice-row">
      <select aria-label="Kind of placement" value={kind} onChange={(e) => reset(e.target.value as Kind)}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      {kind.startsWith('p-') && planetSel}
      {(kind === 'house-sign' || kind === 'lord') && houseSel(a, setA, kind === 'lord' ? 'Lord of' : 'House')}
      {(kind === 'p-sign' || kind === 'asc-sign' || kind === 'house-sign') && signSel}
      {(kind === 'p-nak' || kind === 'asc-nak') && nakSel}
      {(kind === 'p-house' || kind === 'lord') && houseSel(b, setB, 'In house')}
      {kind === 'yoga' && yogaSel}
      {kind === 'dosha' && doshaSel}
      <button type="button" className="btn-ghost sm" disabled={!key} onClick={() => onAdd(key)}>Add</button>
    </div>
  );
}

function PhraseEditor({ chart, found, start, onDone }: { chart: Chart; found: Found | null; start: Phrase; onDone: () => void }) {
  const [p, setP] = useState(start);
  const here = useMemo(() => chartPlacements(chart, found), [chart, found]);
  const addKey = (k: string) => k && setP((x) => (x.keys.includes(k) ? x : { ...x, keys: [...x.keys, k] }));
  return (
    <div className="practice-item">
      <label>Name<input value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} placeholder="optional, e.g. Moon in Rohini, the gardener" /></label>
      <label>Your write-up<textarea rows={5} value={p.text} onChange={(e) => setP({ ...p, text: e.target.value })} placeholder="What you say about this placement. Blank lines start new paragraphs." /></label>
      <div className="practice-tags" aria-label="Filed under">
        {p.keys.length === 0 && <span className="muted">Not filed under any placement yet. Add at least one so it can be suggested.</span>}
        {p.keys.map((k) => <span key={k} className="practice-tag hit">{labelFor(k)}<button type="button" aria-label={`Remove ${labelFor(k)}`} onClick={() => setP({ ...p, keys: p.keys.filter((x) => x !== k) })}>✕</button></span>)}
      </div>
      <div className="practice-row">
        <select aria-label="Add a placement from this chart" value="" onChange={(e) => addKey(e.target.value)}>
          <option value="">Add a placement from this chart…</option>
          {here.filter((x) => !p.keys.includes(x.key)).map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
        </select>
      </div>
      <KeyBuilder onAdd={addKey} />
      <div className="practice-row end">
        <button type="button" className="btn-ghost sm" onClick={onDone}>Cancel</button>
        <button type="button" className="btn-primary sm" disabled={!p.text.trim() || !p.keys.length} onClick={() => { savePhrase({ ...p, text: p.text.trim(), title: p.title.trim() }); onDone(); }}>Save phrase</button>
      </div>
    </div>
  );
}

function PhrasesTab({ chart, found }: { chart: Chart; found: Found | null }) {
  const phrases = usePhrases();
  const [scope, setScope] = useState<'chart' | 'all'>('chart');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Phrase | null>(null);
  const here = useMemo(() => new Set(chartPlacements(chart, found).map((x) => x.key)), [chart, found]);
  const hits = phrases.filter((p) => p.keys.some((k) => here.has(k)));
  const shown = (scope === 'chart' ? hits : phrases).filter((p) => {
    const s = q.trim().toLowerCase();
    return !s || p.title.toLowerCase().includes(s) || p.text.toLowerCase().includes(s) || p.keys.some((k) => labelFor(k).toLowerCase().includes(s));
  });

  return (
    <fieldset>
      <legend>Saved phrases</legend>
      <p className="muted">Your own write-ups, filed under placements. {hits.length} of your {phrases.length} phrase{phrases.length === 1 ? '' : 's'} match this chart.</p>
      <div className="practice-row">
        <select aria-label="Show" value={scope} onChange={(e) => setScope(e.target.value as 'chart' | 'all')}>
          <option value="chart">Matching this chart</option>
          <option value="all">All phrases</option>
        </select>
        <input type="search" className="grow" aria-label="Search phrases" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, e.g. Rohini" />
        {!editing && <button type="button" className="btn-primary sm" onClick={() => setEditing({ id: newId('ph'), title: '', text: '', keys: [], updatedAt: '' })}>New phrase</button>}
      </div>
      {editing && <PhraseEditor key={editing.id} chart={chart} found={found} start={editing} onDone={() => setEditing(null)} />}
      <div className="practice-list">
        {shown.length === 0 && !editing && (
          <p className="muted">
            {phrases.length ? 'No phrases here.' : 'No phrases yet. Write one here, or use “Save as a phrase” under any note in the Life Chart Book or any section of a reading.'}
          </p>
        )}
        {shown.filter((p) => p.id !== editing?.id).map((p) => (
          <div key={p.id} className="practice-item">
            {p.title && <h4>{p.title}</h4>}
            <p>{p.text}</p>
            <div className="practice-tags">{p.keys.map((k) => <span key={k} className={`practice-tag${here.has(k) ? ' hit' : ''}`}>{labelFor(k)}</span>)}</div>
            <div className="practice-row end">
              <button type="button" className="btn-ghost sm" onClick={() => setEditing(p)}>Edit</button>
              <button type="button" className="btn-ghost sm" onClick={() => { if (confirm(`Delete the phrase “${p.title || p.text.slice(0, 40)}”?`)) deletePhrase(p.id); }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

// ------------------------------------------------------------------ reading templates

function TemplateEditor({ start, onDone }: { start: ReadingTemplate; onDone: () => void }) {
  const [t, setT] = useState(start);
  const setSec = (i: number, patch: Partial<TemplateSection>) => setT({ ...t, sections: t.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i: number, d: -1 | 1) => {
    const s = [...t.sections];
    const j = i + d;
    if (j < 0 || j >= s.length) return;
    [s[i], s[j]] = [s[j], s[i]];
    setT({ ...t, sections: s });
  };
  const ok = t.name.trim() && t.sections.length && t.sections.every((s) => s.heading.trim());
  return (
    <div className="practice-item">
      <label>Name<input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} placeholder="e.g. Career reading" /></label>
      <label>About<input value={t.about} onChange={(e) => setT({ ...t, about: e.target.value })} placeholder="optional, for you" /></label>
      {t.sections.map((s, i) => (
        <div key={s.id} className="practice-section">
          <div className="practice-row">
            <input aria-label="Section heading" value={s.heading} onChange={(e) => setSec(i, { heading: e.target.value })} placeholder="Heading, printed" />
            <button type="button" className="btn-ghost sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
            <button type="button" className="btn-ghost sm" onClick={() => move(i, 1)} disabled={i === t.sections.length - 1} aria-label="Move down">↓</button>
            <button type="button" className="btn-ghost sm" onClick={() => setT({ ...t, sections: t.sections.filter((_, j) => j !== i) })} disabled={t.sections.length === 1} aria-label="Remove section">✕</button>
          </div>
          <label>Your prompt (not printed)<input value={s.guide} onChange={(e) => setSec(i, { guide: e.target.value })} placeholder="What to cover here" /></label>
          <details>
            <summary className="muted">About: {s.topics.length ? s.topics.map(topicLabel).join(', ') : 'anything in the chart'}</summary>
            <div className="practice-topics">
              {TOPICS.map((x) => (
                <label key={x.id} className="phrase-key">
                  <input type="checkbox" checked={s.topics.includes(x.id)} onChange={() => setSec(i, { topics: s.topics.includes(x.id) ? s.topics.filter((y) => y !== x.id) : [...s.topics, x.id] })} />
                  {x.label}
                </label>
              ))}
            </div>
          </details>
        </div>
      ))}
      <div className="practice-row">
        <button type="button" className="btn-ghost sm" onClick={() => setT({ ...t, sections: [...t.sections, { id: newId('s'), heading: '', guide: '', topics: [] }] })}>Add a section</button>
        <span className="grow" />
        <button type="button" className="btn-ghost sm" onClick={onDone}>Cancel</button>
        <button type="button" className="btn-primary sm" disabled={!ok} onClick={() => { saveTemplate({ ...t, name: t.name.trim() }); onDone(); }}>Save template</button>
      </div>
    </div>
  );
}

function TemplatesTab() {
  const templates = useTemplates();
  const [editing, setEditing] = useState<ReadingTemplate | null>(null);
  const blank = (): ReadingTemplate => ({ id: newId('tpl'), name: '', about: '', sections: [{ id: newId('s'), heading: '', guide: '', topics: [] }], updatedAt: '' });
  return (
    <fieldset>
      <legend>Reading templates</legend>
      <p className="muted">Your standard reading structures. Each section names what it is about, so your saved phrases for those placements are offered as you write.</p>
      <div className="practice-row">
        {!editing && <button type="button" className="btn-primary sm" onClick={() => setEditing(blank())}>New template</button>}
        <button type="button" className="btn-ghost sm" onClick={restoreStarters}>Add the starter templates</button>
      </div>
      {editing && !templates.some((t) => t.id === editing.id) && <TemplateEditor key={editing.id} start={editing} onDone={() => setEditing(null)} />}
      <div className="practice-list">
        {templates.length === 0 && !editing && <p className="muted">No templates. Make one, or add the starter templates.</p>}
        {templates.map((t) => (editing?.id === t.id ? <TemplateEditor key={t.id} start={editing} onDone={() => setEditing(null)} /> : (
          <div key={t.id} className="practice-item">
            <h4>{t.name}</h4>
            {t.about && <p>{t.about}</p>}
            <p>{t.sections.map((s) => s.heading).join(' · ')}</p>
            <div className="practice-row end">
              <button type="button" className="btn-ghost sm" onClick={() => setEditing(t)}>Edit</button>
              <button type="button" className="btn-ghost sm" onClick={() => setEditing({ ...t, id: newId('tpl'), name: `${t.name} (copy)`, sections: t.sections.map((s) => ({ ...s })) })}>Duplicate</button>
              <button type="button" className="btn-ghost sm" onClick={() => { if (confirm(`Delete the template “${t.name}”? Readings already made from it are kept.`)) deleteTemplate(t.id); }}>Delete</button>
            </div>
          </div>
        )))}
      </div>
    </fieldset>
  );
}

// ------------------------------------------------------------------ export and import

function LibraryTab() {
  const phrases = usePhrases();
  const templates = useTemplates();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const download = () => {
    const blob = new Blob([exportLibrary()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `jyotisha-practice-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
  };
  const upload = async (f: File) => {
    try {
      const r = importLibrary(await f.text());
      setMsg({ ok: true, text: r.added || r.updated ? `Added ${r.added} and updated ${r.updated}.` : 'Nothing new: everything in that file is already here.' });
    } catch {
      setMsg({ ok: false, text: 'That file is not a practice library.' });
    }
  };
  return (
    <fieldset>
      <legend>Export and import</legend>
      <p className="muted">
        One file with your {templates.length} template{templates.length === 1 ? '' : 's'} and {phrases.length} phrase{phrases.length === 1 ? '' : 's'}. Importing merges:
        new items are added, the newer edit of the same item wins, and nothing here is deleted. Client readings stay with each chart and are not in this file.
      </p>
      <div className="practice-row">
        <button type="button" className="btn-primary sm" onClick={download}>Export library</button>
        <button type="button" className="btn-ghost sm" onClick={() => file.current?.click()}>Import library</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
      </div>
      {msg && <p className={msg.ok ? 'muted' : 'report-error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
    </fieldset>
  );
}
