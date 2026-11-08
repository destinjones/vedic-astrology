import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BirthInput, Chart, PlanetId, VargaId } from './types/chart';
import type { ChartStyle, Selection } from './types/ui';
import { computeChart } from './engine';
import { BirthForm } from './components/BirthForm';
import { ChartActions, SavedCharts } from './components/Profiles';
import { TabBar } from './components/TabBar';
import { Presenter } from './components/Presenter';
import { buildSteps, type Step } from './lib/walkthrough';
import { loadEvents } from './lib/lifeEvents';
import { blankTab, hasContent, labelFor, loadWorkspace, MAX_ARCHIVED, MAX_TABS, newTabId, storeWorkspace, type Tab, type Workspace } from './lib/tabs';
import type { ClientRow } from './lib/clients';
import type { ClientPatch } from './components/ClientManager';
import { backupFileName, downloadText, exportAll, restoreAll } from './lib/backup';
import { storeLinks } from './lib/family';
import { ClientHistory } from './components/ClientHistory';
import { practiceStore } from './lib/practice';
import { loadProfiles, parseShareHash, sameBirth, storeProfiles, upsertProfile, type Profile } from './lib/profiles';
import { NorthChart } from './components/NorthChart';
import { SouthChart } from './components/SouthChart';
import { DetailPanel } from './components/DetailPanel';
import { NakshatraWheel, type WheelMode } from './components/NakshatraWheel';
import { PlanetTable } from './components/PlanetTable';
import { DashaCard } from './components/DashaCard';
import { VargaSwitcher } from './components/VargaSwitcher';
import { signInfo } from './data/constants';
import { getVarga } from './lib/astro';
import { ART } from './data/art';
import { QuickSwitch } from './components/QuickSwitch';
import { chartCommands, jumpTo } from './lib/chartCommands';
import type { Command } from './lib/commands';
import { compareHash } from './compare/sources';

import { YogaDoshaCard } from './components/YogaDoshaCard';
import { CaseStudyCard } from './components/CaseStudyCard';
import { caseStudyFor } from './data/caseStudies';
import { ChalitControl } from './components/ChalitControl';
import { chalitHouses, withChalit, type HouseMode } from './lib/chalit';
import { PanchangaCard } from './components/PanchangaCard';
import { ConditionCard } from './components/ConditionCard';
import { StrengthSection } from './components/StrengthSection';
import { ReportActions } from './components/ReportActions';
import { FamousCharts } from './components/FamousCharts';
import { BatchView } from './components/BatchView';
import { FAMOUS_CHARTS, famousChartById, famousErrorReportUrl, RODDEN_MEANING } from './data/famousCharts';
import { loadKnowledge, type Knowledge } from './lib/readings';
import { useI18n } from './i18n';
import { ayanamsaName } from './i18n/names';
import { LOCALE_BY_CODE } from '@vedic/i18n';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import './components/data.css';
import { birthQuality, RODDEN_LABEL } from './lib/birthQuality';
import { ExportDialog, type ExportTab } from './components/ExportDialog';
import { AnnotationPanel, AnnotationPins } from './components/Annotations';
import { Narrator } from './components/Narrator';
import { speechSupported } from './lib/narration';
import type { Annotation } from './lib/annotations';
import { DisplaySettings } from './components/DisplaySettings';
import { ChartTable } from './components/ChartTable';
import { setDisplay, useDisplay } from './lib/display';
import { trackEvent, trackOnce } from './lib/analytics';
import { TrustFooter } from './trust/TrustFooter';
import { forgetLegacyVisitData, writeLastChart } from './lib/lastChart';

const SkyView = lazy(() => import('./components/SkyView'));
const TimingSection = lazy(() => import('./components/TimingSection'));
const EventChecker = lazy(() => import('./components/EventChecker'));
const JaiminiSection = lazy(() => import('./components/JaiminiSection'));
const RemediesSection = lazy(() => import('./components/RemediesSection'));
const ClientPractice = lazy(() => import('./components/ClientPractice').then((m) => ({ default: m.ClientPractice })));
const PracticeView = lazy(() => import('./components/PracticeView').then((m) => ({ default: m.PracticeView })));
const RectificationSection = lazy(() => import('./components/RectificationSection'));
const VarshaphalSection = lazy(() => import('./components/VarshaphalSection'));
const SkyEvents = lazy(() => import('./components/SkyEvents'));
const Personal = lazy(() => import('./personal/Personal'));
const ClientManager = lazy(() => import('./components/ClientManager'));
const ClassicalTiming = lazy(() => import('./components/ClassicalTiming').then((m) => ({ default: m.ClassicalTiming })));

/** Mounts children once the placeholder scrolls near the viewport. */
function WhenVisible({ children, minHeight }: { children: React.ReactNode; minHeight: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen || !ref.current) return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) setSeen(true); }, { rootMargin: '200px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);
  return <div ref={ref} style={{ minHeight }}>{seen ? children : null}</div>;
}

const DEFAULT_INPUT: BirthInput = {
  name: '',
  date: '1990-08-15',
  time: '06:30',
  place: 'New Delhi, India',
  latitude: 28.6139,
  longitude: 77.209,
  timezone: 'Asia/Kolkata',
  ayanamsa: 'lahiri',
};

// older versions kept the last person's details in localStorage; clear them once
if (typeof window !== 'undefined') forgetLegacyVisitData();

/**
 * What the form shows for a new chart: nothing filled in. The sample above is
 * only opened on request ("Or try a sample chart", /app/#sample), and the
 * previous person's details are never carried into the next new chart.
 */
const blankInput = (): BirthInput => {
  let timezone = 'UTC';
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { /* ignore */ }
  return { name: '', date: '', time: '', place: '', latitude: Number.NaN, longitude: Number.NaN, timezone, ayanamsa: 'lahiri' };
};

export default function App() {
  const [input, setInput] = useState<BirthInput>(blankInput);
  const [chart, setChart] = useState<Chart | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(true);
  const [style, setStyle] = useState<ChartStyle>('north');
  const [vargaId, setVargaId] = useState<VargaId>('D1');
  const [selection, setSelection] = useState<Selection | null>(null);
  // a click on the chart, wheel, table or sky; the first planet click is a step in the visit counter's funnel
  const pick = (s: Selection | null) => {
    if (s?.kind === 'planet') trackOnce('first-planet-click');
    setSelection(s);
  };
  const [hoverPlanet, setHoverPlanet] = useState<PlanetId | null>(null);
  const [wheelMode, setWheelMode] = useState<WheelMode>('art');
  // rashi (whole sign) or a bhava chalit chart; readings follow whichever is shown
  const [houseMode, setHouseMode] = useState<HouseMode>(() => {
    try { const m = localStorage.getItem('vedic.houseMode'); if (m === 'sripati' || m === 'equal') return m; } catch { /* ignore */ }
    return 'rashi';
  });
  useEffect(() => { try { localStorage.setItem('vedic.houseMode', houseMode); } catch { /* ignore */ } }, [houseMode]);
  const [knowledge, setKnowledge] = useState<Knowledge | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>(loadProfiles);
  // bumped to remount the form with new initial values (editing a saved chart)
  const [formKey, setFormKey] = useState(0);
  // the saved chart whose details are open in the form, so fixing its time updates it in place
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ws, setWs] = useState<Workspace>(loadWorkspace);
  const [presenting, setPresenting] = useState(false);
  const [showFamous, setShowFamous] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [showClients, setShowClients] = useState(false);
  const [showPractice, setShowPractice] = useState(false);
  const [exportTab, setExportTab] = useState<ExportTab | null>(null);
  const [annotating, setAnnotating] = useState(false);
  const [focusNote, setFocusNote] = useState<string | null>(null);
  const [narrating, setNarrating] = useState(false);
  // worked-out charts per tab, so switching tabs is instant
  const charts = useRef(new Map<string, Chart>());
  const wsRef = useRef(ws);
  wsRef.current = ws;
  const activeTab = ws.tabs.find((t) => t.id === ws.activeId) ?? ws.tabs[0];
  // a chart from the famous charts library shows where its birth data comes from
  const famous = chart ? FAMOUS_CHARTS.find((f) => sameBirth(f.input, chart.input)) ?? null : null;
  const { t, rich, v, locale } = useI18n();
  const display = useDisplay();

  useEffect(() => { storeWorkspace(ws); }, [ws]);
  const patchTab = (id: string, patch: Partial<Tab>) =>
    setWs((w) => ({ ...w, tabs: w.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  /** Changes a client's tab whether it is open or closed (the practice view works across both). */
  const patchAnyTab = (id: string, patch: Partial<Tab>) =>
    setWs((w) => ({
      ...w,
      tabs: w.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      archived: w.archived.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  // notes pinned to this tab's chart
  const notes = activeTab.annotations ?? [];
  const setNotes = (list: Annotation[]) => patchTab(activeTab.id, { annotations: list.length ? list : undefined });

  // the chart style and varga are remembered per tab
  useEffect(() => {
    if (activeTab.style !== style || activeTab.varga !== vargaId) patchTab(activeTab.id, { style, varga: vargaId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, vargaId]);

  const saveProfiles = (list: Profile[]) => { setProfiles(list); return storeProfiles(list); };

  // keep several open tabs in step
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === 'vedic.profiles.v1') setProfiles(loadProfiles());
      // another window changed the tabs: take its tabs, notes and history, but stay on this window's tab
      if (e.key === 'vedic.tabs.v1') {
        const other = loadWorkspace();
        const keepActive = other.tabs.some((t) => t.id === wsRef.current.activeId);
        wsRef.current = { ...other, activeId: keepActive ? wsRef.current.activeId : other.activeId };
        setWs(wsRef.current);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const run = async (i: BirthInput, tabId: string = wsRef.current.activeId) => {
    setBusy(true);
    try {
      const c = await computeChart(i);
      charts.current.set(tabId, c);
      setWs((w) => ({ ...w, tabs: w.tabs.map((t) => (t.id === tabId ? { ...t, input: i, label: t.named ? t.label : labelFor(i), events: t.events.length ? t.events : loadEvents(i) } : t)) }));
      // the person moved to another tab while this one was working
      if (tabId !== wsRef.current.activeId) return;
      // a share link in the address bar stays only while its own chart is open
      const linked = parseShareHash(location.hash);
      if (linked && !sameBirth(linked, i)) history.replaceState(null, '', location.pathname + location.search);
      if (editingId) {
        const now = new Date().toISOString();
        saveProfiles(profiles.map((p) => (p.id === editingId ? { ...p, input: { ...i, name: i.name || p.label }, updatedAt: now } : p)));
        setEditingId(null);
      }
      setInput(i);
      setChart(c);
      setEditing(false);
      setSelection({ kind: 'asc' });
      setShowFamous(false);
      // a famous chart never replaces the visitor's own saved details
      if (!FAMOUS_CHARTS.some((f) => sameBirth(f.input, i))) {
        writeLastChart(i);
      }
    } finally {
      setBusy(false);
    }
  };

  // Readings are a separate chunk, so the first chart appears before the text arrives.
  useEffect(() => {
    setKnowledge(null);
    if (!chart?.engineContext) return;
    let live = true;
    const bhava = houseMode === 'rashi' ? undefined : chalitHouses(chart.engineContext.chart.bhavaChalit[houseMode]);
    loadKnowledge(chart.engineContext.chart, locale, bhava).then((k) => { if (live) setKnowledge(k); }).catch((e) => console.error('Readings unavailable', e));
    return () => { live = false; };
  }, [chart, locale, houseMode]);

  // /app/#sample opens the sample chart straight away (the landing page links here),
  // and a share link (/app/#d=…&t=…) opens the chart it carries.
  useEffect(() => {
    const open = () => {
      // /app/#famous opens the famous charts library, /app/#famous=<id> opens one chart
      const fm = /^#famous(?:=([\w-]+))?$/.exec(location.hash);
      const famousLinked = fm?.[1] ? famousChartById(fm[1])?.input : undefined;
      if (fm && !famousLinked) { setShowFamous(true); history.replaceState(null, '', location.pathname + location.search); }
      const linked = famousLinked ?? (location.hash === '#sample' ? DEFAULT_INPUT : parseShareHash(location.hash));
      if (linked) {
        openInTab(linked);
        // the tab remembers it now; a reload should show the tabs as they were left
        history.replaceState(null, '', location.pathname + location.search);
      }
      return !!linked;
    };
    // a link wins; otherwise reopen the chart in the tab that was open last time
    if (!open() && activeTab.input) void run(activeTab.input, activeTab.id);
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Shows a tab, working out its chart if this visit has not done so yet. */
  const switchTab = (id: string) => {
    const tab = wsRef.current.tabs.find((t) => t.id === id);
    if (!tab) return;
    wsRef.current = { ...wsRef.current, activeId: id };
    setWs((w) => ({ ...w, activeId: id }));
    setEditingId(null);
    setInput(tab.input ?? blankInput());
    setFormKey((k) => k + 1);
    setStyle(tab.style ?? 'north');
    setVargaId(tab.varga ?? 'D1');
    setSelection({ kind: 'asc' });
    const cached = charts.current.get(id);
    setChart(cached ?? null);
    setEditing(!cached && !tab.input);
    if (!cached && tab.input) void run(tab.input, id);
    window.scrollTo({ top: 0 });
  };
  const newTab = (then?: (id: string) => void) => {
    const w = wsRef.current;
    if (w.tabs.length >= MAX_TABS) return null;
    const tab = blankTab(w.tabs.length + 1);
    // wsRef is read again before React re-renders, so update it now too
    wsRef.current = { ...w, tabs: [...w.tabs, tab] };
    setWs(wsRef.current);
    switchTab(tab.id);
    then?.(tab.id);
    return tab.id;
  };
  const closeTab = (id: string) => {
    const w = wsRef.current;
    const tab = w.tabs.find((t) => t.id === id);
    if (!tab) return;
    charts.current.delete(id);
    let rest = w.tabs.filter((t) => t.id !== id);
    if (!rest.length) rest = [blankTab(1)];
    const idx = w.tabs.findIndex((t) => t.id === id);
    const nextActive = id === w.activeId ? rest[Math.min(idx, rest.length - 1)].id : w.activeId;
    // closing keeps the chart, notes and history under Closed tabs
    const archived = hasContent(tab) ? [tab, ...w.archived].slice(0, MAX_ARCHIVED) : w.archived;
    wsRef.current = { tabs: rest, activeId: w.activeId, archived };
    setWs(wsRef.current);
    if (nextActive !== w.activeId) switchTab(nextActive);
  };
  const reopenTab = (tab: Tab) => {
    const w = wsRef.current;
    const archived = w.archived.filter((t) => t.id !== tab.id);
    // an empty tab in front makes way for the reopened one
    const active = w.tabs.find((t) => t.id === w.activeId);
    const base = active && !hasContent(active) ? w.tabs.filter((t) => t.id !== active.id) : w.tabs;
    if (base.length >= MAX_TABS) return;
    wsRef.current = { tabs: [...base, tab], activeId: w.activeId, archived };
    setWs(wsRef.current);
    switchTab(tab.id);
  };
  /** Opens a client from the client list: its tab, its closed tab, or its saved chart. */
  const openClient = (row: ClientRow) => {
    setShowClients(false);
    if (row.where === 'open') switchTab(row.key);
    else if (row.where === 'closed' && row.tab) reopenTab(row.tab);
    else if (row.input) openInTab(row.input);
  };
  /** Readings and follow-ups for a client. A saved chart with no tab gets a closed tab to keep them in. */
  const patchClient = (row: ClientRow, patch: ClientPatch) => {
    const w = wsRef.current;
    const apply = (t: Tab) => (t.id === row.key ? { ...t, ...patch } : t);
    if (row.where === 'saved') {
      if (!row.input) return;
      const tab: Tab = { id: newTabId(), label: row.label, input: row.input, notes: '', log: [], events: loadEvents(row.input), named: true, ...patch };
      wsRef.current = { ...w, archived: [tab, ...w.archived].slice(0, MAX_ARCHIVED) };
    } else {
      wsRef.current = { ...w, tabs: w.tabs.map(apply), archived: w.archived.map(apply) };
    }
    setWs(wsRef.current);
  };
  const forgetTab = (tab: Tab) => setWs((w) => ({ ...w, archived: w.archived.filter((t) => t.id !== tab.id) }));
  /** The family page, opened on this chart when it is saved. */
  const familyHref = () => {
    const saved = chart && profiles.find((p) => sameBirth(p.input, chart.input));
    return `${import.meta.env.BASE_URL}family/${saved ? `#p=${encodeURIComponent(saved.id)}` : ''}`;
  };
  const backup = () => downloadText(exportAll(wsRef.current, profiles, { practice: practiceStore.get() }), backupFileName());
  const restore = (text: string, sync = false) => {
    try {
      const r = restoreAll(wsRef.current, profiles, text, { mergeExisting: sync, practice: practiceStore.get() });
      if (r.practice) practiceStore.set(r.practice);
      wsRef.current = r.ws;
      setWs(r.ws);
      saveProfiles(r.profiles);
      storeLinks(r.family);
      if (sync) return `Merged ${r.tabsAdded} new tab${r.tabsAdded === 1 ? '' : 's'} and ${r.chartsAdded} new saved chart${r.chartsAdded === 1 ? '' : 's'}, and joined notes and history on the rest.`;
      if (!r.tabsAdded && !r.chartsAdded && !r.linksAdded) return 'Everything in that backup is already here.';
      return `Restored ${r.tabsAdded} tab${r.tabsAdded === 1 ? '' : 's'} and ${r.chartsAdded} saved chart${r.chartsAdded === 1 ? '' : 's'}.`;
    } catch {
      return 'That file is not a Jyotisha Explorer backup.';
    }
  };

  /** Opens a chart: its tab if one is open, this tab if empty, otherwise a new tab. */
  function openInTab(i: BirthInput) {
    const w = wsRef.current;
    const open = w.tabs.find((t) => t.input && sameBirth(t.input, i));
    if (open) {
      if (open.id !== w.activeId) switchTab(open.id);
      else if (!charts.current.get(open.id)) void run(i, open.id);
      return;
    }
    const active = w.tabs.find((t) => t.id === w.activeId);
    if (active && !active.input) return void run(i, active.id);
    if (!newTab((id) => void run(i, id))) void run(i, w.activeId);
  }

  /* ---------- present mode: full screen and a guided walkthrough ---------- */
  const enteredFullscreen = useRef(false);
  const vargaBeforePresent = useRef<VargaId>('D1');
  const startPresent = () => {
    vargaBeforePresent.current = vargaId;
    setEditing(false);
    setPresenting(true);
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().then(() => { enteredFullscreen.current = true; }).catch(() => {});
  };
  const stopPresent = useCallback(() => {
    setPresenting(false);
    setVargaId(vargaBeforePresent.current);
    document.querySelectorAll('.present-focus').forEach((n) => n.classList.remove('present-focus'));
    if (enteredFullscreen.current && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    enteredFullscreen.current = false;
  }, []);
  // leaving full screen with the browser's own Esc ends the presentation too
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement && enteredFullscreen.current) stopPresent(); };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [stopPresent]);
  const steps = useMemo(() => (chart ? buildSteps(chart, knowledge, !!chart.engineContext) : []), [chart, knowledge]);
  const showStep = useCallback((st: Step) => {
    if (st.select) setSelection(st.select);
    setVargaId(st.varga ?? 'D1');
    document.querySelectorAll('.present-focus').forEach((n) => n.classList.remove('present-focus'));
    const el = document.querySelector(st.target);
    if (el) {
      el.classList.add('present-focus');
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const showSaved = () => {
    setEditing(true);
    requestAnimationFrame(() => document.getElementById('saved-charts')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const editProfile = (p: Profile) => {
    setInput(p.input);
    setEditingId(p.id);
    setFormKey((k) => k + 1);
    setEditing(true);
    requestAnimationFrame(() => document.querySelector('.birth-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };
  const importMany = (items: { label: string; input: BirthInput }[]) => {
    let list = profiles;
    let added = 0;
    for (const it of items) {
      const before = list.length;
      list = upsertProfile(list, it.label, it.input);
      if (list.length > before) added++;
    }
    saveProfiles(list);
    return added;
  };
  const saveCurrent = (label: string) => {
    if (!chart) return false;
    const list = upsertProfile(profiles, label, chart.input);
    return saveProfiles(list);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelection(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const editBirth = () => {
    setEditing(true);
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.birth-form input')?.focus());
  };
  /** Brings a client to the front from the practice view, reopening a closed tab. */
  const openClient = (id: string) => {
    const closed = wsRef.current.archived.find((t) => t.id === id);
    if (closed) reopenTab(closed);
    switchTab(id);
    setShowPractice(false);
    requestAnimationFrame(() => document.getElementById('client-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const openPractice = () => {
    setShowPractice(true);
    requestAnimationFrame(() => document.getElementById('practice')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  // Keyboard and quick-switch commands: client tabs first, then the open chart.
  const tabIndex = ws.tabs.findIndex((x) => x.id === ws.activeId);
  const stepTab = (d: number) => { if (ws.tabs.length > 1) switchTab(ws.tabs[(tabIndex + d + ws.tabs.length) % ws.tabs.length].id); };
  const clientCommands: Command[] = [
    ...ws.tabs.map((x, i): Command => ({
      id: `tab.${x.id}`,
      group: 'Clients',
      title: `Switch to ${x.label}`,
      hint: x.input ? `${x.input.date} · ${x.input.place}` : 'empty tab',
      keywords: 'tab client person open',
      shortcut: i < 9 ? `Alt+${i + 1}` : undefined,
      active: x.id === ws.activeId,
      run: () => { if (x.id !== ws.activeId) switchTab(x.id); },
    })),
    { id: 'tab.next', group: 'Clients', title: 'Next tab', shortcut: 'Alt+]', keywords: 'client tab forward', run: () => stepTab(1) },
    { id: 'tab.prev', group: 'Clients', title: 'Previous tab', shortcut: 'Alt+[', keywords: 'client tab back', run: () => stepTab(-1) },
    { id: 'practice.open', group: 'Clients', title: 'Your practice: track record, invoices, packages', keywords: 'prediction hit miss score invoice receipt payment package price remedies check-in', run: openPractice },
    { id: 'tab.new', group: 'Clients', title: 'New tab', shortcut: 'Alt+n', keywords: 'client person add blank', run: () => { newTab(); requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.birth-form input')?.focus()); } },
    { id: 'tab.close', group: 'Clients', title: `Close ${activeTab.label}`, keywords: 'client tab close archive', hint: 'kept under closed tabs', run: () => closeTab(activeTab.id) },
    ...ws.archived.map((x): Command => ({
      id: `reopen.${x.id}`,
      group: 'Closed tabs',
      title: `Reopen ${x.label}`,
      hint: x.input ? `${x.input.date} · ${x.input.place}` : undefined,
      keywords: 'client tab closed archived restore',
      run: () => reopenTab(x),
    })),
    ...profiles.map((pr): Command => ({
      id: `saved.${pr.id}`,
      group: 'Saved charts',
      title: `Open ${pr.label}`,
      hint: `${pr.input.date} · ${pr.input.place}`,
      keywords: 'saved profile chart family friend',
      run: () => openInTab(pr.input),
    })),
    { id: 'famous', group: 'Tools', title: 'Famous charts library', keywords: 'celebrity public figures india america britain', run: () => { setShowFamous(true); window.scrollTo({ top: 0, behavior: 'smooth' }); } },
    { id: 'family', group: 'Tools', title: 'Family charts: link spouse, children and parents', keywords: 'family relatives spouse children parents siblings linked', run: () => { location.href = familyHref(); } },
    { id: 'compare', group: 'Tools', title: 'Compare charts side by side', keywords: 'side by side two charts compatibility', run: () => { location.href = `${import.meta.env.BASE_URL}compare/${chart ? compareHash([chart.input]) : ''}`; } },
    ...(chart ? [{ id: 'present', group: 'Tools', title: 'Present this chart', keywords: 'full screen walkthrough screen share recording', run: startPresent }] : []),
    ...(chart ? [
      { id: 'export.image', group: 'Tools', title: 'Export chart image (PNG or SVG)', keywords: 'download picture png svg print', run: () => setExportTab('image') },
      { id: 'export.card', group: 'Tools', title: 'Share card for WhatsApp or Telegram', keywords: 'share image whatsapp telegram social', run: () => setExportTab('card') },
      { id: 'export.embed', group: 'Tools', title: 'Embed this chart on a website', keywords: 'iframe blog widget', run: () => setExportTab('embed') },
      { id: 'export.stickers', group: 'Tools', title: 'Graha sticker pack', keywords: 'stickers whatsapp telegram planets', run: () => setExportTab('stickers') },
      { id: 'notes', group: 'Tools', title: 'Pin notes to the chart', keywords: 'annotate annotation note house planet', run: () => { setAnnotating(true); jumpTo('chart'); } },
      ...(speechSupported() ? [{ id: 'listen', group: 'Tools', title: 'Listen to this chart read aloud', keywords: 'audio narration speak voice read', run: () => setNarrating(true) }] : []),
    ] : []),
    { id: 'clients', group: 'Clients', title: 'Client list and upcoming alerts', keywords: 'clients follow up readings predictions dasha transit alerts reminders', run: () => { setShowClients(true); window.scrollTo({ top: 0, behavior: 'smooth' }); } },
    { id: 'backup', group: 'Tools', title: 'Back up all tabs and charts', keywords: 'export download file save', run: backup },
    { id: 'data', group: 'Tools', title: 'Import, export and encrypted sync', keywords: 'csv json aaf jhd jagannatha astro.com astrodatabank paste bulk sync devices passphrase', run: () => { setEditing(true); requestAnimationFrame(() => { const d = document.getElementById('data-tools') as HTMLDetailsElement | null; if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }); } },
    ...(profiles.length > 1 ? [{ id: 'batch', group: 'Tools', title: 'Batch view of all saved charts', keywords: 'clients table list overview', run: () => setShowBatch(true) }] : []),
  ];
  const commands: Command[] = [
    ...clientCommands,
    ...(chart
      ? chartCommands({ chart, vargaId, setVargaId, style, setStyle, selection, setSelection, wheelMode, setWheelMode, editBirth })
      : [{ id: 'sample', group: 'Chart', title: 'Open the sample chart', keywords: 'example demo', run: () => void run(DEFAULT_INPUT) },
         { id: 'birth.focus', group: 'Chart', title: 'Enter birth details', shortcut: 'e', keywords: 'form new chart', run: () => { jumpTo('intake'); editBirth(); } }]),
  ];

  const chalit = chart?.engineContext && houseMode !== 'rashi' ? chart.engineContext.chart.bhavaChalit[houseMode] : null;
  const varga = chart ? withChalit(getVarga(chart, vargaId), vargaId === 'D1' ? chalit : null) : null;
  // famous charts carry their own rating; any other chart is rated by the person
  const quality = chart && !famous ? birthQuality(chart.input) : null;
  const moon = chart?.planets.find((p) => p.id === 'moon');
  const sun = chart?.planets.find((p) => p.id === 'sun');

  return (
    <div className={`app ${presenting ? 'is-presenting' : ''}`}>
      <a className="skip-link" href={chart ? '#chart' : '#intake'}>{chart ? 'Skip to the chart' : 'Skip to the birth details'}</a>
      <div
        className={`backdrop ${chart ? 'backdrop-cosmos' : 'backdrop-hero'}`}
        aria-hidden
        style={{
          '--bg-desktop': `url("${chart ? ART.cosmosDesktop : ART.heroDesktop}")`,
          '--bg-mobile': `url("${chart ? ART.cosmosMobile : ART.heroMobile}")`,
        } as React.CSSProperties}
      />
      <div className="starfield" aria-hidden />
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <span className="brand-mark">✦</span>
          <div>
            <h1>{t('app.title')}</h1>
            <p>{t('app.tagline')}</p>
          </div>
        </a>
        <div className="topbar-actions">
          <QuickSwitch commands={commands} />
          <LanguageSwitcher />
          <DisplaySettings />
          <button className="btn-ghost" aria-expanded={showClients} onClick={() => setShowClients((x) => !x)} title="Your clients, their readings and follow-ups, and dasha and transit alerts coming up">Clients</button>
          <a className="btn-ghost" href={`${import.meta.env.BASE_URL}study/`}>Study</a>
          <button className="btn-ghost" aria-expanded={showFamous} onClick={() => setShowFamous((v) => !v)}>Famous charts</button>
          <button className="btn-ghost" aria-expanded={showPractice} onClick={() => (showPractice ? setShowPractice(false) : openPractice())} title="Prediction track record, invoices and packages">Practice</button>
          <a className="btn-ghost" href={`${import.meta.env.BASE_URL}compare/${chart ? compareHash([chart.input]) : ''}`}>Compare charts</a>
          <a className="btn-ghost" href={`${import.meta.env.BASE_URL}match/`}>Compatibility</a>
          <a className="btn-ghost" href={familyHref()}>Family charts</a>
          <a className="btn-ghost" href={`${import.meta.env.BASE_URL}tools/`}>KP · Prashna · Muhurta</a>
          {chart && (
            <>
              <button className="btn-ghost" onClick={startPresent} title="Full screen walkthrough for a client, a screen share or a recording">▶ Present</button>
              {speechSupported() && <button className="btn-ghost" aria-pressed={narrating} onClick={() => setNarrating((x) => !x)} title="Read the chart aloud, moving through it as it goes">🔊 Listen</button>}
              <ReportActions chart={chart} />
              <ChartActions input={chart.input} profiles={profiles} onSave={saveCurrent} onShowSaved={showSaved} famousId={famous?.id} onExport={() => setExportTab('card')} />
              {!editing && <button className="btn-ghost" onClick={() => setEditing(true)}>{t('app.editBirth')}</button>}
            </>
          )}
        </div>
      </header>

      <TabBar
        tabs={ws.tabs}
        activeId={ws.activeId}
        busy={busy}
        onSelect={switchTab}
        onNew={() => newTab()}
        onClose={closeTab}
        onRename={(id, label) => patchTab(id, { label, named: true })}
      />

      {chart?.meta.source === 'mock' && (
        <div className="preview-banner" role="status">
          {t('app.previewBanner')}
        </div>
      )}

      {!chart && busy && activeTab.input && (
        <div className="card tab-loading" role="status">Opening {activeTab.label}'s chart…</div>
      )}

      {showClients && !presenting && (
        <Suspense fallback={<div className="card tab-loading" role="status">Opening the client list…</div>}>
          <ClientManager
            ws={ws}
            profiles={profiles}
            busy={busy}
            onOpen={openClient}
            onPatch={patchClient}
            onNew={() => { setShowClients(false); newTab(); requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.birth-form input')?.focus()); }}
            onBackup={backup}
            onRestore={restore}
            onClose={() => setShowClients(false)}
          />
        </Suspense>
      )}

      {showBatch && (
        <BatchView profiles={profiles} busy={busy} onOpen={(p) => { setShowBatch(false); openInTab(p.input); }} onClose={() => setShowBatch(false)} />
      )}

      {showPractice && (
        <Suspense fallback={null}>
          <PracticeView tabs={ws.tabs} archived={ws.archived} onPatch={patchAnyTab} onOpen={openClient} onClose={() => setShowPractice(false)} />
        </Suspense>
      )}

      {showFamous && (
        <FamousCharts busy={busy} onOpen={(c) => openInTab(c.input)} onClose={() => setShowFamous(false)} />
      )}

      {(editing || !chart) && !showFamous && !(busy && !chart && activeTab.input) && (
        <section id="intake" className={`intake ${chart ? 'intake-compact' : ''}`}>
          {!chart && (
            <div className="intake-copy">
              <h2>{t('app.introTitle')}</h2>
              <p>{t('app.introBody')}</p>
            </div>
          )}
          <div className="card form-card">
            <SavedCharts
              profiles={profiles}
              current={chart?.input}
              busy={busy}
              onOpen={(p) => { setEditingId(null); openInTab(p.input); }}
              onEdit={editProfile}
              onDelete={(p) => { if (p.id === editingId) setEditingId(null); saveProfiles(profiles.filter((q) => q.id !== p.id)); }}
              closed={ws.archived}
              onReopen={reopenTab}
              onForget={forgetTab}
              onBackup={backup}
              onRestore={restore}
              onSyncMerge={(text) => restore(text, true)}
              backupText={() => exportAll(wsRef.current, profiles, { practice: practiceStore.get() })}
              onImport={importMany}
              onBatch={() => { setShowBatch(true); requestAnimationFrame(() => document.getElementById('batch')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }}
            />
            {editingId && (
              <p className="editing-note">
                Editing <b>{profiles.find((p) => p.id === editingId)?.label}</b>. Your changes update this saved chart.{' '}
                <button type="button" className="link-btn" onClick={() => setEditingId(null)}>Leave the saved chart as it is</button>
              </p>
            )}
            <BirthForm key={formKey} initial={input} busy={busy} onSubmit={(i) => { trackEvent('chart-submit'); void run(i); }} onSample={() => openInTab(DEFAULT_INPUT)} />
          </div>
        </section>
      )}

      {chart && varga && (
        <main className="explorer">
          <section className="summary-strip">
            <div className="summary-item">
              <small>{t('summary.lagna')}</small>
              <b>{signInfo(chart.ascendant.sign).glyph} {v.signs[chart.ascendant.sign - 1]}</b>
            </div>
            <div className="summary-item">
              <small>{t('summary.moonSign')}</small>
              <b>{signInfo(moon!.sign).glyph} {v.signs[moon!.sign - 1]}</b>
            </div>
            <div className="summary-item">
              <small>{t('summary.janmaNakshatra')}</small>
              <b>{v.nakshatras[moon!.nakshatra - 1]} {moon!.pada}</b>
            </div>
            <div className="summary-item">
              <small>{t('summary.sunSign')}</small>
              <b>{signInfo(sun!.sign).glyph} {v.signs[sun!.sign - 1]}</b>
            </div>
            <div className="summary-item">
              <small>{t('summary.retrograde')}</small>
              <b>{chart.planets.filter((p) => p.retrograde && p.id !== 'rahu' && p.id !== 'ketu').map((p) => v.planets[p.id].short).join(', ') || t('summary.none')}</b>
            </div>
            <div className="summary-item muted-item">
              <small>{chart.input.name || t('summary.birth')}</small>
              <b>{chart.input.date} · {chart.input.time} · {chart.input.place}</b>
            </div>
            {famous ? (
              <div className="summary-item">
                <small>Rodden rating</small>
                <b title={RODDEN_MEANING[famous.rodden]}>
                  {famous.rodden}{' '}
                  {famous.sourceUrl
                    ? <a className="muted" href={famous.sourceUrl} target="_blank" rel="noopener noreferrer">{famous.source}</a>
                    : <span className="muted">{famous.source}</span>}
                </b>
                <span className="summary-sub muted">
                  {famous.field}, as of {famous.asOf} ·{' '}
                  <a href={famousErrorReportUrl(famous)} target="_blank" rel="noopener noreferrer">Report an error</a>
                </span>
              </div>
            ) : chart.input.rodden && (
              <div className="summary-item">
                <small>Rodden rating</small>
                <b title={RODDEN_LABEL[chart.input.rodden]}>{chart.input.rodden}</b>
              </div>
            )}
            {chart.engineContext?.chart.meta.calendar === 'julian' && (
              <div className="summary-item">
                <small>Julian calendar date</small>
                <b title="The date was read in the Julian (Old Style) calendar">= {chart.engineContext.chart.meta.gregorianDate} Gregorian</b>
              </div>
            )}
          </section>
          {quality && (
            <div className={`quality-banner quality-${quality.level}`} role="note" id="time-quality">
              <b>{quality.title}.</b> {quality.detail}{' '}
              <button type="button" className="link-btn" onClick={() => setEditing(true)}>Rate this birth time</button>
            </div>
          )}

          {chart.engineContext && (
            <Suspense fallback={null}>
              <Personal part="today" chart={chart} report={knowledge?.report} />
            </Suspense>
          )}

          <div className="explorer-grid">
            <section className="card chart-card" id="chart">
              <div className="card-head">
                <h3>{t('chart.birthChart')}</h3>
                <div className="seg" role="radiogroup" aria-label={t('chart.style')}>
                  <button role="radio" aria-checked={style === 'north'} className={style === 'north' ? 'is-active' : ''} onClick={() => setStyle('north')}>{t('chart.north')}</button>
                  <button role="radio" aria-checked={style === 'south'} className={style === 'south' ? 'is-active' : ''} onClick={() => setStyle('south')}>{t('chart.south')}</button>
                </div>
                <div className="chart-tools">
                  <button className="btn-ghost sm" aria-pressed={annotating} onClick={() => setAnnotating((x) => !x)} title="Pin notes to houses and planets">✎ Notes{notes.length ? ` (${notes.length})` : ''}</button>
                  <button className="btn-ghost sm" onClick={() => setExportTab('image')} title="PNG or SVG of this chart, a share card, embed code or stickers">⤓ Export</button>
                </div>
              </div>
              <VargaSwitcher value={vargaId} onChange={setVargaId} />
              {chart.engineContext && vargaId === 'D1' && <ChalitControl mode={houseMode} onChange={setHouseMode} chalit={chalit} />}
              {display.chartTable ? (
                <ChartTable chart={chart} varga={varga} selection={selection} onSelect={pick} />
              ) : (
              <div className="chart-stage" onMouseLeave={() => setHoverPlanet(null)}>
                {style === 'north' ? (
                  <NorthChart chart={chart} varga={varga} selection={selection} hoverPlanet={hoverPlanet} onSelect={pick} onHoverPlanet={setHoverPlanet} />
                ) : (
                  <SouthChart chart={chart} varga={varga} selection={selection} hoverPlanet={hoverPlanet} onSelect={pick} onHoverPlanet={setHoverPlanet} />
                )}
                <AnnotationPins chart={chart} varga={varga} style={style} notes={notes} onPick={(a) => { setAnnotating(true); setFocusNote(a.id); }} />
              </div>
              )}
              {annotating && <AnnotationPanel notes={notes} selection={selection} onChange={setNotes} onClose={() => { setAnnotating(false); setFocusNote(null); }} focusId={focusNote} />}
              <p className="legend muted">{t('chart.legend')}</p>
              <p className="chart-keys">
                {!display.chartTable && <>Keyboard: <kbd>Tab</kbd> into the chart, arrows move between houses (<kbd>Page Down</kbd> goes in number order), <kbd>Enter</kbd> opens, <kbd>Tab</kbd> again reaches the planets. </>}
                <button type="button" className="link-btn" onClick={() => setDisplay({ chartTable: !display.chartTable })}>
                  {display.chartTable ? 'Show the chart drawing' : 'Show as a table'}
                </button>
              </p>
            </section>

            <aside className="card detail-card" id="details" aria-live="polite">
              {quality && (selection?.kind === 'house' || selection?.kind === 'asc' || vargaId !== 'D1') && (
                <p className="reading-note quality-note">{quality.title}: read house and lagna findings here as provisional.</p>
              )}
              {knowledge && knowledge.locale !== locale && <p className="reading-note">{t('app.readingsLanguageNote', { language: LOCALE_BY_CODE[locale].native })}</p>}
              <DetailPanel chart={chart} varga={varga} selection={selection} onSelect={pick} knowledge={knowledge} />
            </aside>
          </div>

          {caseStudyFor(famous?.id) && <CaseStudyCard study={caseStudyFor(famous?.id)!} report={knowledge?.report} />}

          {chart.engineContext && (
            <WhenVisible minHeight={560}>
              <Suspense fallback={null}>
                <Personal part="slider" chart={chart} style={style} onApplyTime={(date, time) => { void run({ ...chart.input, date, time }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
              </Suspense>
            </WhenVisible>
          )}

          {knowledge && <YogaDoshaCard report={knowledge.report} />}

          {knowledge && chart.engineContext && (
            <Suspense fallback={null}>
              <Personal part="story" chart={chart} report={knowledge.report} onSelect={setSelection} />
            </Suspense>
          )}

          {chart.engineContext && (
            <PanchangaCard key={chart.engineContext.chart.meta.utc} engine={chart.engineContext.engine} chart={chart.engineContext.chart} />
          )}

          {chart.engineContext && <ConditionCard key={`c${chart.engineContext.chart.meta.utc}`} chart={chart.engineContext.chart} />}

          {chart.engineContext?.chart.strength && <StrengthSection strength={chart.engineContext.chart.strength} />}

          {chart.engineContext && (
            <WhenVisible minHeight={480}>
              <Suspense fallback={null}>
                <Personal part="ayanamsa" chart={chart} />
              </Suspense>
            </WhenVisible>
          )}

          <section className="card sky-card" id="sky">
            <div className="card-head">
              <h3>{t('sections.sky')}</h3>
              <span className="muted">{t('sections.skySub')}</span>
            </div>
            <WhenVisible minHeight={520}>
              <Suspense fallback={<div className="sky-overlay static">{t('sections.skyLoading')}</div>}>
                <SkyView chart={chart} selection={selection} onSelect={pick} />
              </Suspense>
            </WhenVisible>
          </section>

          <div className="explorer-grid lower">
            <section className="card wheel-card" id="wheel">
              <div className="card-head">
                <h3>{t('sections.wheel')}</h3>
                <div className="seg" role="radiogroup" aria-label={t('sections.wheelStyle')}>
                  <button role="radio" aria-checked={wheelMode === 'art'} className={wheelMode === 'art' ? 'is-active' : ''} onClick={() => setWheelMode('art')}>{t('sections.artwork')}</button>
                  <button role="radio" aria-checked={wheelMode === 'diagram'} className={wheelMode === 'diagram' ? 'is-active' : ''} onClick={() => setWheelMode('diagram')}>{t('sections.diagram')}</button>
                </div>
              </div>
              <NakshatraWheel mode={wheelMode} chart={chart} selection={selection} onSelect={pick} onHoverPlanet={setHoverPlanet} />
            </section>
            <section className="card" id="planets">
              <div className="card-head"><h3>{t('sections.positions')}</h3></div>
              <PlanetTable chart={chart} selection={selection} onSelect={pick} />
            </section>
          </div>

          {chart.dasha && <DashaCard chart={chart} />}

          {chart.engineContext && (
            <section className="card" id="junctions">
              <div className="card-head"><h3>Dasha junctions and double transits</h3><span className="muted">sandhi, chidra and Jupiter with Saturn on each house</span></div>
              <WhenVisible minHeight={260}>
                <Suspense fallback={<div className="sky-overlay static">Finding the junctions…</div>}>
                  <ClassicalTiming key={chart.engineContext.chart.meta.utc} engine={chart.engineContext.engine} chart={chart.engineContext.chart} />
                </Suspense>
              </WhenVisible>
            </section>
          )}

          {chart.engineContext && (
            <section className="card" id="jaimini">
              <div className="card-head"><h3>Jaimini astrology</h3><span className="muted">chara karakas, arudha padas, sign aspects and chara dasha</span></div>
              <WhenVisible minHeight={600}>
                <Suspense fallback={<div className="sky-overlay static">Working out the Jaimini layer…</div>}>
                  <JaiminiSection key={chart.engineContext.chart.meta.utc} chart={chart.engineContext.chart} />
                </Suspense>
              </WhenVisible>
            </section>
          )}

          {chart.engineContext && (
            <section className="card" id="remedies">
              <div className="card-head"><h3>Remedies</h3><span className="muted">what the tradition prescribes for each afflicted graha, with sources</span></div>
              <WhenVisible minHeight={500}>
                <Suspense fallback={<div className="sky-overlay static">Working out the remedies…</div>}>
                  <RemediesSection key={chart.engineContext.chart.meta.utc} chart={chart.engineContext.chart} />
                </Suspense>
              </WhenVisible>
            </section>
          )}

          {chart.engineContext && (
            <section className="card timing-host" id="timing">
              <div className="card-head"><h3>{t('sections.timing')}</h3><span className="muted">{t('sections.timingSub')}</span></div>
              <WhenVisible minHeight={600}>
                <Suspense fallback={<div className="sky-overlay static">{t('sections.timingLoading')}</div>}>
                  <TimingSection key={chart.engineContext.chart.meta.utc} context={chart.engineContext} name={chart.input.name} input={chart.input} />
                </Suspense>
              </WhenVisible>
            </section>
          )}

          {chart.engineContext && (
            <section className="card events-card" id="events">
              <div className="card-head"><h3>Life event checker</h3><span className="muted">what was running when something happened</span></div>
              <WhenVisible minHeight={260}>
                <Suspense fallback={<div className="sky-overlay static">Loading…</div>}>
                  <EventChecker
                    key={chart.engineContext.chart.meta.utc}
                    context={chart.engineContext}
                    input={chart.input}
                    events={activeTab.events}
                    onChange={(events) => patchTab(activeTab.id, { events })}
                  />
                </Suspense>
              </WhenVisible>
            </section>
          )}
          {chart.engineContext && (
            <section className="card rect-host" id="rectify">
              <div className="card-head"><h3>Birth time finder</h3><span className="muted">not sure of your exact time? narrow it down from your life events</span></div>
              <WhenVisible minHeight={420}>
                <Suspense fallback={<div className="sky-overlay static">Loading the birth time finder…</div>}>
                  <RectificationSection
                    key={`${chart.input.date}|${chart.input.latitude}|${chart.input.longitude}`}
                    context={chart.engineContext}
                    savedEvents={activeTab.events}
                    onApply={(date, time) => { void run({ ...chart.input, date, time }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  />
                </Suspense>
              </WhenVisible>
            </section>
          )}

          {chart.engineContext && (
            <section className="card" id="varshaphal">
              <div className="card-head"><h3>Varshaphal, your year ahead</h3><span className="muted">the Tajika annual chart, cast for the second the Sun returns</span></div>
              <WhenVisible minHeight={600}>
                <Suspense fallback={<div className="sky-overlay static">Casting your annual chart…</div>}>
                  <VarshaphalSection key={chart.engineContext.chart.meta.utc} context={chart.engineContext} chart={chart} style={style} />
                </Suspense>
              </WhenVisible>
            </section>
          )}

          {chart.engineContext && (
            <>
            <section className="card" id="eclipses">
              <div className="card-head"><h3>Eclipses and Sankrantis</h3><span className="muted">where the shadows fall, on Earth and on this chart</span></div>
              <WhenVisible minHeight={420}>
                <Suspense fallback={<div className="sky-overlay static">Finding eclipses…</div>}>
                  <SkyEvents key={chart.engineContext.chart.meta.utc} context={chart.engineContext} input={chart.input} profiles={profiles} onOpen={(i) => { openInTab(i); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
                </Suspense>
              </WhenVisible>
            </section>

            <WhenVisible minHeight={520}>
              <Suspense fallback={null}>
                <Personal part="keepsakes" chart={chart} />
              </Suspense>
            </WhenVisible>
            </>
          )}

          <ClientHistory
            tab={activeTab}
            onNotes={(notes) => patchTab(activeTab.id, { notes })}
            onLog={(log) => patchTab(activeTab.id, { log })}
          />
          <Suspense fallback={null}>
            <ClientPractice
              tab={activeTab}
              chart={chart.engineContext?.chart}
              onRemedies={(remedies) => patchTab(activeTab.id, { remedies })}
              onInvoices={(invoices) => patchTab(activeTab.id, { invoices })}
              onOpenPractice={openPractice}
            />
          </Suspense>
        </main>
      )}

      {presenting && chart && <Presenter key={activeTab.id} steps={steps} onStep={showStep} onExit={stopPresent} />}
      {narrating && chart && !presenting && (
        <Narrator key={activeTab.id} steps={steps} knowledge={knowledge} onStep={showStep}
          onClose={() => { setNarrating(false); document.querySelectorAll('.present-focus').forEach((n) => n.classList.remove('present-focus')); }} />
      )}
      {exportTab && chart && varga && (
        <ExportDialog chart={chart} varga={varga} style={style} notes={notes} knowledge={knowledge} initialTab={exportTab} onClose={() => setExportTab(null)} />
      )}

      <footer className="foot muted">
        <p>{t('footer.system', { ayanamsa: ayanamsaName(t, input.ayanamsa) })}</p>
        <p>{t('footer.disclaimer')}</p>
        <p>{rich('footer.privacy', {
          openMeteo: <a href="https://open-meteo.com/en/docs/geocoding-api">Open-Meteo</a>,
          geonames: <a href="https://www.geonames.org/">GeoNames</a>,
          ccby: <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>,
          swisseph: <a href="https://www.astro.com/swisseph/">Swiss Ephemeris</a>,
          agpl: <a href="https://github.com/destinjones/vedic-astrology/blob/main/LICENSE">AGPL-3.0</a>,
          source: <a href="https://github.com/destinjones/vedic-astrology">{t('footer.getSource')}</a>,
        })}</p>
        <p>{rich('footer.mapTiles', { osm: <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> })}</p>
        <TrustFooter />
      </footer>
    </div>
  );
}
