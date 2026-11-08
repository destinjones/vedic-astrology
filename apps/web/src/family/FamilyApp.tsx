import { useEffect, useMemo, useState } from 'react';
import type { BirthInput, Chart, DashaPeriod } from '../types/chart';
import { BirthForm } from '../components/BirthForm';
import { computeChart } from '../engine';
import { ART } from '../data/art';
import { NAKSHATRAS, PLANET_BY_ID, signInfo } from '../data/constants';
import { TrustFooter } from '../trust/TrustFooter';
import { compareHash, toChartInput } from '../compare/sources';
import { loadProfiles, shareHash, storeProfiles, upsertProfile, sameBirth, type Profile } from '../lib/profiles';
import {
  RELATIONS, RELATION_LABEL, inverseRelation, linkPeople, loadLinks, pruneLinks, relativesOf, storeLinks, unlink,
  type FamilyLink, type Relation, type Relative,
} from '../lib/family';
import type { FamilyMember, FamilyTheme, PairReading } from '../lib/familyReading';

type ReadingLib = typeof import('../lib/familyReading');

const BASE = import.meta.env.BASE_URL;
const BLANK: BirthInput = { name: '', date: '', time: '', place: '', latitude: NaN, longitude: NaN, timezone: '', ayanamsa: 'lahiri' };
const TONE = { benefic: 'good', mixed: 'mid', challenging: 'bad' } as const;

/** Rows of the family map, top to bottom. */
const ROWS: { title: string; relations: Relation[] }[] = [
  { title: 'Parents', relations: ['father', 'mother', 'parent'] },
  { title: 'Spouse and siblings', relations: ['spouse', 'sibling'] },
  { title: 'Children', relations: ['child'] },
  { title: 'Other relatives', relations: ['other'] },
];

function focusFromHash(profiles: Profile[]): string | null {
  const id = new URLSearchParams(location.hash.slice(1)).get('p');
  return id && profiles.some((p) => p.id === id) ? id : null;
}

function currentDasha(d: DashaPeriod[] | undefined, at = new Date()): string | null {
  const t = at.toISOString();
  const maha = d?.find((p) => p.start <= t && t < p.end);
  if (!maha) return null;
  const antar = maha.sub?.find((p) => p.start <= t && t < p.end);
  return `${PLANET_BY_ID[maha.lord].name}${antar ? ` / ${PLANET_BY_ID[antar.lord].name}` : ''}`;
}

export default function FamilyApp() {
  const [profiles, setProfiles] = useState<Profile[]>(loadProfiles);
  const [links, setLinks] = useState<FamilyLink[]>(() => pruneLinks(loadLinks(), loadProfiles().map((p) => p.id)));
  const [focusId, setFocusId] = useState<string | null>(() => {
    const ps = loadProfiles();
    const ls = loadLinks();
    return focusFromHash(ps) ?? ps.find((p) => ls.some((l) => l.fromId === p.id || l.toId === p.id))?.id ?? ps[0]?.id ?? null;
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [charts, setCharts] = useState<Record<string, Chart | { error: string }>>({});
  const [lib, setLib] = useState<ReadingLib | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const focus = focusId ? byId.get(focusId) ?? null : null;
  const relatives = useMemo(() => (focus ? relativesOf(links, focus.id).filter((r) => byId.has(r.profileId)) : []), [links, focus, byId]);

  useEffect(() => { void import('../lib/familyReading').then(setLib); }, []);

  // keep the page bookmarkable on the person in focus
  useEffect(() => {
    history.replaceState(null, '', location.pathname + location.search + (focusId ? `#p=${encodeURIComponent(focusId)}` : ''));
  }, [focusId]);
  useEffect(() => {
    const onHash = () => { const id = focusFromHash(loadProfiles()); if (id) { setFocusId(id); setSelected(null); } };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  // another tab may save charts or links; pick them up
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'vedic.profiles.v1') setProfiles(loadProfiles());
      if (e.key === 'vedic.family.v1') setLinks(loadLinks());
    };
    addEventListener('storage', onStorage);
    return () => removeEventListener('storage', onStorage);
  }, []);

  const needed = useMemo(() => (focus ? [focus, ...relatives.map((r) => byId.get(r.profileId)!)] : []), [focus, relatives, byId]);
  useEffect(() => {
    for (const p of needed) {
      if (charts[p.id]) continue;
      computeChart(p.input).then(
        (c) => setCharts((m) => ({ ...m, [p.id]: c })),
        (e) => setCharts((m) => ({ ...m, [p.id]: { error: String(e) } })),
      );
    }
  }, [needed, charts]);

  const chartOf = (id: string): Chart | null => { const c = charts[id]; return c && 'planets' in c ? c : null; };
  const member = (p: Profile): FamilyMember | null => {
    const c = chartOf(p.id);
    return c ? { id: p.id, name: p.label, chart: toChartInput(c) } : null;
  };

  const focusMember = focus ? member(focus) : null;
  const readings = useMemo(() => {
    const out = new Map<string, PairReading>();
    if (!lib || !focusMember) return out;
    for (const r of relatives) {
      const p = byId.get(r.profileId);
      const m = p && member(p);
      if (m) out.set(r.profileId, lib.readPair(focusMember, m, r.relation));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, charts, relatives, focusId]);

  const themes = useMemo<FamilyTheme[]>(() => {
    if (!lib) return [];
    const ms = needed.map(member).filter((m): m is FamilyMember => !!m);
    if (ms.length !== needed.length) return [];
    return lib.familyThemes(ms, Object.fromEntries(needed.map((p) => [p.id, p.input.date])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, charts, needed]);

  const saveLinks = (next: FamilyLink[]) => {
    setLinks(next);
    setSaveError(storeLinks(next) ? null : 'This browser would not save the link (private mode or full storage). It will be lost when the page closes.');
  };
  const addRelative = (toId: string, relation: Relation, note: string) => {
    if (!focus) return;
    saveLinks(linkPeople(links, focus.id, toId, relation, note));
    setSelected(toId);
  };
  const addNewChart = (input: BirthInput, relation: Relation, note: string) => {
    const next = upsertProfile(profiles, input.name || 'Unnamed', input);
    setProfiles(next);
    if (!storeProfiles(next)) setSaveError('This browser would not save the chart (private mode or full storage).');
    const saved = next.find((p) => sameBirth(p.input, input))!;
    if (!focus) { setFocusId(saved.id); return; }
    addRelative(saved.id, relation, note);
  };
  const changeRelation = (r: Relative, relation: Relation) => {
    // stored from the focus person's side, so the new relation reads naturally
    saveLinks(linkPeople(links, focus!.id, r.profileId, relation, r.link.note));
  };
  const refocus = (id: string) => { setFocusId(id); setSelected(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const sel = relatives.find((r) => r.profileId === selected) ?? null;
  const familyInputs = needed.map((p) => ({ ...p.input, name: p.input.name || p.label }));

  return (
    <div className="app family-app">
      <div className="backdrop backdrop-cosmos" aria-hidden style={{ '--bg-desktop': `url("${ART.cosmosDesktop}")`, '--bg-mobile': `url("${ART.cosmosMobile}")` } as React.CSSProperties} />
      <div className="starfield" aria-hidden />
      <header className="topbar">
        <a className="brand" href={BASE}>
          <span className="brand-mark">✦</span>
          <div>
            <p className="brand-title">Jyotisha Explorer</p>
            <p>Family charts, read together</p>
          </div>
        </a>
        <div className="topbar-actions">
          <a className="btn-ghost" href={`${BASE}app/`}>Birth chart explorer</a>
          <a className="btn-ghost" href={`${BASE}compare/`}>Compare charts</a>
        </div>
      </header>

      <section className="fam-intro">
        <p className="fam-eyebrow">Linked family charts</p>
        <h1>Family charts: one family, read together.</h1>
        <p className="muted">
          Link a person’s spouse, children, parents and siblings from your saved charts, then read each relative against them: where
          the relative’s Lagna and Moon fall among the houses that stand for that bond, how their Moons and Lagnas relate, the closest
          contacts between the charts, and Ashtakoota matching for the couple. The links stay in this browser.
        </p>
      </section>

      {saveError && <p className="form-error" role="alert">{saveError}</p>}

      {!profiles.length ? (
        <section className="card fam-empty">
          <h2>Start with one chart</h2>
          <p className="muted">Family charts link charts you have saved. Add the first person here, or save charts in the <a href={`${BASE}app/`}>explorer</a>.</p>
          <BirthForm initial={BLANK} busy={false} submitLabel="Save this chart" onSubmit={(i) => addNewChart(i, 'other', '')} />
        </section>
      ) : focus && (
        <>
          <section className="card fam-focus-bar">
            <label>
              <span className="muted small">Person in focus</span>
              <select value={focus.id} onChange={(e) => refocus(e.target.value)}>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <div className="fam-actions">
              <a className="btn-ghost" href={`${BASE}app/${shareHash(focus.input)}`}>Open {focus.label}’s chart</a>
              {familyInputs.length > 1 && (
                <a className="btn-ghost" href={`${BASE}compare/${compareHash(familyInputs.slice(0, 4))}`}>
                  Compare {familyInputs.length > 4 ? 'the first four' : 'the family'} side by side
                </a>
              )}
            </div>
          </section>

          <section className="fam-map" aria-label={`${focus.label}'s family`}>
            {ROWS.slice(0, 1).map(mapRow)}
            <div className="fam-row fam-row-centre">
              <h2 className="sr-only">{focus.label}</h2>
              <ul>
                <li><PersonCard profile={focus} chart={chartOf(focus.id)} error={errorOf(charts[focus.id])} relationLabel="In focus" isFocus /></li>
                {relatives.filter((r) => ROWS[1].relations.includes(r.relation)).map((r) => <li key={r.link.id}>{card(r)}</li>)}
              </ul>
            </div>
            {ROWS.slice(2).map(mapRow)}
          </section>

          <AddRelative profiles={profiles.filter((p) => p.id !== focus.id && !relatives.some((r) => r.profileId === p.id))} focusName={focus.label} onLink={addRelative} onNew={addNewChart} />

          {sel && (
            <RelativeDetail
              key={sel.link.id}
              focus={focus}
              rel={sel}
              profile={byId.get(sel.profileId)!}
              reading={readings.get(sel.profileId) ?? null}
              onRelation={(r) => changeRelation(sel, r)}
              onUnlink={() => { saveLinks(unlink(links, sel.link.id)); setSelected(null); }}
              onRefocus={() => refocus(sel.profileId)}
            />
          )}

          {relatives.length > 0 && (
            <section className="card fam-themes">
              <div className="card-head"><h2>What runs through the family</h2></div>
              {themes.length ? (
                <ul>
                  {themes.map((t) => (
                    <li key={t.kind + t.title}>
                      <b>{t.title}</b> <span className="muted">· {t.members.map((id) => byId.get(id)?.label).join(', ')}</span>
                      <p>{t.text}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">{needed.every((p) => chartOf(p.id)) && lib ? 'No sign, nakshatra or placement repeats across these charts.' : 'Reading the charts…'}</p>
              )}
              <p className="muted small">Jupiter, Saturn, Rahu and Ketu change sign slowly, so they are only counted when the births are at least three years apart.</p>
            </section>
          )}
        </>
      )}

      <footer className="foot muted">
        <p>Sidereal zodiac · readings from the same comparison and matching rules as the Compare and Compatibility pages.</p>
        <p>A family reading is a traditional practice for reflection and conversation, not a prediction of how people will get on.</p>
        <p>Charts and links stay in this browser and travel in the explorer’s backup file. Free software under <a href="https://github.com/destinjones/vedic-astrology/blob/main/LICENSE">AGPL-3.0</a>.</p>
        <TrustFooter />
      </footer>
    </div>
  );

  function card(r: Relative) {
    const p = byId.get(r.profileId)!;
    const reading = readings.get(r.profileId);
    return (
      <PersonCard
        profile={p}
        chart={chartOf(p.id)}
        error={errorOf(charts[p.id])}
        relationLabel={`${RELATION_LABEL[r.relation]}${r.link.note ? ` · ${r.link.note}` : ''}`}
        tone={reading ? (reading.balance > 1 ? 'good' : reading.balance < -1 ? 'bad' : 'mid') : undefined}
        marked={!!reading?.bhava.length}
        selected={selected === p.id}
        onSelect={() => setSelected(selected === p.id ? null : p.id)}
      />
    );
  }

  function mapRow(row: (typeof ROWS)[number]) {
    const rs = relatives.filter((r) => row.relations.includes(r.relation));
    if (!rs.length) return null;
    return (
      <div className="fam-row" key={row.title}>
        <h2 className="fam-row-title">{row.title}</h2>
        <ul>{rs.map((r) => <li key={r.link.id}>{card(r)}</li>)}</ul>
      </div>
    );
  }
}

const errorOf = (c: Chart | { error: string } | undefined) => (c && 'error' in c ? c.error : undefined);

function PersonCard({ profile, chart, error, relationLabel, isFocus, tone, marked, selected, onSelect }: {
  profile: Profile; chart: Chart | null; error?: string; relationLabel: string; isFocus?: boolean;
  tone?: 'good' | 'mid' | 'bad'; marked?: boolean; selected?: boolean; onSelect?: () => void;
}) {
  const moon = chart?.planets.find((p) => p.id === 'moon');
  const body = (
    <>
      <span className="fam-rel">{relationLabel}{marked && <span className="fam-mark" title="Classical bhava link"> ✦</span>}</span>
      <b className="fam-name">{profile.label}</b>
      {chart && moon ? (
        <span className="fam-facts">
          <span>{signInfo(chart.ascendant.sign).name} rising</span>
          <span>Moon {signInfo(moon.sign).name} · {NAKSHATRAS[moon.nakshatra - 1]?.name}</span>
          {currentDasha(chart.dasha) && <span className="muted">{currentDasha(chart.dasha)} dasha</span>}
        </span>
      ) : <span className="muted small">{error ? 'Chart could not be read' : 'Reading chart…'}</span>}
    </>
  );
  const cls = `fam-person ${isFocus ? 'is-focus' : ''} ${selected ? 'is-selected' : ''} ${tone ? `tone-${tone}` : ''}`;
  return onSelect
    ? <button type="button" className={cls} aria-pressed={selected} onClick={onSelect}>{body}</button>
    : <div className={cls}>{body}</div>;
}

function AddRelative({ profiles, focusName, onLink, onNew }: {
  profiles: Profile[]; focusName: string;
  onLink: (id: string, r: Relation, note: string) => void;
  onNew: (input: BirthInput, r: Relation, note: string) => void;
}) {
  const [pick, setPick] = useState('');
  const [relation, setRelation] = useState<Relation>('spouse');
  const [note, setNote] = useState('');
  const [newChart, setNewChart] = useState(false);
  const chosen = profiles.some((p) => p.id === pick) ? pick : profiles[0]?.id ?? '';
  return (
    <section className="card fam-add">
      <div className="card-head"><h2>Link a relative to {focusName}</h2></div>
      <div className="fam-add-row">
        <label>
          <span className="muted small">Relation to {focusName}</span>
          <select value={relation} onChange={(e) => setRelation(e.target.value as Relation)}>
            {RELATIONS.map((r) => <option key={r} value={r}>{RELATION_LABEL[r]}</option>)}
          </select>
        </label>
        <label>
          <span className="muted small">Note (optional)</span>
          <input value={note} maxLength={80} placeholder="e.g. elder daughter" onChange={(e) => setNote(e.target.value)} />
        </label>
        {!newChart && profiles.length > 0 && (
          <>
            <label>
              <span className="muted small">Saved chart</span>
              <select value={chosen} onChange={(e) => setPick(e.target.value)}>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.label} · {p.input.date}</option>)}
              </select>
            </label>
            <button className="btn-primary" disabled={!chosen} onClick={() => { onLink(chosen, relation, note); setNote(''); setPick(''); }}>Link</button>
          </>
        )}
        <button className="btn-ghost" aria-expanded={newChart} onClick={() => setNewChart((v) => !v)}>
          {newChart ? 'Pick a saved chart instead' : 'Add a new chart'}
        </button>
      </div>
      {newChart && (
        <div className="fam-new">
          <BirthForm initial={BLANK} busy={false} submitLabel={`Save and link as ${RELATION_LABEL[relation].toLowerCase()}`}
            onSubmit={(i) => { onNew(i, relation, note); setNote(''); setNewChart(false); }} />
        </div>
      )}
    </section>
  );
}

function RelativeDetail({ focus, rel, profile, reading, onRelation, onUnlink, onRefocus }: {
  focus: Profile; rel: Relative; profile: Profile; reading: PairReading | null;
  onRelation: (r: Relation) => void; onUnlink: () => void; onRefocus: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const pair = [{ ...focus.input, name: focus.input.name || focus.label }, { ...profile.input, name: profile.input.name || profile.label }];
  const openMatch = () => {
    try { localStorage.setItem('vedic.match', JSON.stringify({ a: pair[0], b: pair[1] })); } catch { /* the page still opens */ }
    location.href = `${BASE}match/`;
  };
  return (
    <section className="card fam-detail" aria-live="polite">
      <div className="card-head">
        <h2>{profile.label} <span className="muted">· {RELATION_LABEL[rel.relation].toLowerCase()} of {focus.label}</span></h2>
        <div className="fam-actions">
          <label className="fam-inline">
            <span className="sr-only">Relation</span>
            <select value={rel.relation} onChange={(e) => onRelation(e.target.value as Relation)}>
              {RELATIONS.map((r) => <option key={r} value={r}>{RELATION_LABEL[r]}</option>)}
            </select>
          </label>
          <button className="btn-ghost" onClick={onRefocus}>Centre on {profile.label}</button>
          <a className="btn-ghost" href={`${BASE}compare/${compareHash(pair)}`}>Compare side by side</a>
          {rel.relation === 'spouse' && <button className="btn-ghost" onClick={openMatch}>Full matching</button>}
          {confirm
            ? <><button className="btn-ghost danger" onClick={onUnlink}>Remove link</button><button className="btn-ghost" onClick={() => setConfirm(false)}>Keep</button></>
            : <button className="btn-ghost" onClick={() => setConfirm(true)} title="The saved chart itself is kept">Unlink</button>}
        </div>
      </div>

      {!reading ? <p className="muted">Reading both charts…</p> : (
        <div className="fam-detail-grid">
          {reading.match && (
            <div className="fam-block">
              <h3>Ashtakoota match</h3>
              <p className="fam-score"><b>{fmt(reading.match.total)}</b> / {reading.match.max} · {reading.match.bandLabel}
                {reading.match.adjustedTotal !== reading.match.total && <span className="muted"> ({fmt(reading.match.adjustedTotal)} with cancelled doshas restored)</span>}</p>
              <p>{reading.match.summary}</p>
              <p className="muted">{reading.match.manglik}</p>
            </div>
          )}
          <div className="fam-block">
            <h3>Classical link</h3>
            {reading.bhava.length
              ? <ul>{reading.bhava.map((b) => <li key={b.point + b.from + b.house}>{b.text}</li>)}</ul>
              : <p className="muted">{rel.relation === 'other'
                ? 'No house stands for this relation, so there is no bhava link to check.'
                : `${profile.label}’s Lagna and Moon sign do not fall in the house that stands for this bond, counted from ${focus.label}’s Lagna or Moon. That is common and says nothing bad on its own.`}</p>}
          </div>
          <Rel title="Moon to Moon" r={reading.moon} />
          <Rel title="Lagna to Lagna" r={reading.lagna} />
          {reading.highlights.length > 0 && (
            <div className="fam-block"><h3>At a glance</h3><ul>{reading.highlights.map((h) => <li key={h}>{h}</li>)}</ul></div>
          )}
          {reading.contacts.length > 0 && (
            <div className="fam-block">
              <h3>Closest contacts</h3>
              <ul>{reading.contacts.map((c) => (
                <li key={c.a + c.b + c.kind}><span className={`chip chip-${TONE[c.tone]}`}>{c.kind}</span> <b>{c.title}</b><p>{c.text}</p></li>
              ))}</ul>
            </div>
          )}
          {(reading.supportive.length > 0 || reading.needsCare.length > 0) && (
            <div className="fam-block">
              <h3>{profile.label}’s planets in {focus.label}’s houses</h3>
              <ul>
                {[...reading.supportive, ...reading.needsCare].map((o) => (
                  <li key={o.planet}><span className={`chip chip-${TONE[o.tone]}`}>{o.tone === 'benefic' ? 'supportive' : o.tone === 'challenging' ? 'needs care' : 'mixed'}</span> <b>{o.title}</b><p>{o.summary}</p></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <p className="muted small">Read from {focus.label}’s side. {inverseRelation(rel.relation) !== rel.relation ? `Centre on ${profile.label} to read it the other way round, as their ${RELATION_LABEL[inverseRelation(rel.relation)].toLowerCase()}.` : `Centre on ${profile.label} to read it from their side.`}</p>
    </section>
  );
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function Rel({ title, r }: { title: string; r: PairReading['moon'] }) {
  return (
    <div className="fam-block">
      <h3>{title} <span className={`chip chip-${TONE[r.tone]}`}>{r.pair}</span></h3>
      <p><b>{r.title}</b></p>
      <p>{r.text}</p>
    </div>
  );
}
