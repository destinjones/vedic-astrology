import { useEffect, useId, useRef, useState } from 'react';
import { DEFAULT_DISPLAY, setDisplay, TEXT_SCALES, useDisplay, type ContrastPref, type DisplayPrefs, type FontPref, type MotionPref, type TermsPref } from '../lib/display';

interface Choice<T> { value: T; label: string }

function Seg<T extends string | number>({ legend, value, choices, onChange, hint }: { legend: string; value: T; choices: Choice<T>[]; onChange: (v: T) => void; hint?: string }) {
  const hintId = useId();
  return (
    <fieldset aria-describedby={hint ? hintId : undefined}>
      <legend>{legend}</legend>
      <div className="seg" role="radiogroup" aria-label={legend}>
        {choices.map((c) => (
          <button key={String(c.value)} type="button" role="radio" aria-checked={value === c.value} className={value === c.value ? 'is-active' : ''} onClick={() => onChange(c.value)}>
            {c.label}
          </button>
        ))}
      </div>
      {hint && <p className="hint" id={hintId}>{hint}</p>}
    </fieldset>
  );
}

const MOTION: Choice<MotionPref>[] = [{ value: 'system', label: 'As my device' }, { value: 'reduce', label: 'Reduce' }, { value: 'full', label: 'Full' }];
const CONTRAST: Choice<ContrastPref>[] = [{ value: 'system', label: 'As my device' }, { value: 'high', label: 'High' }, { value: 'normal', label: 'Normal' }];
const SCALE: Choice<number>[] = TEXT_SCALES.map((s) => ({ value: s, label: `${Math.round(s * 100)}%` }));
const FONT: Choice<FontPref>[] = [{ value: 'default', label: 'Default' }, { value: 'hyperlegible', label: 'Hyperlegible' }, { value: 'dyslexic', label: 'OpenDyslexic' }];
const TERMS: Choice<TermsPref>[] = [{ value: 'local', label: 'My language' }, { value: 'iast', label: 'Sanskrit (IAST)' }, { value: 'devanagari', label: 'देवनागरी' }];

/** The "Aa" button in the top bar: motion, contrast, text size, reading font and Sanskrit terms. */
export function DisplaySettings({ showChartTable = true }: { showChartTable?: boolean }) {
  const p = useDisplay();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const set = (patch: Partial<DisplayPrefs>) => setDisplay(patch);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    // move focus into the panel so keyboard users land on the first setting
    requestAnimationFrame(() => wrap.current?.querySelector<HTMLElement>('.display-panel [role=radio][aria-checked=true]')?.focus());
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey, true); };
  }, [open]);

  const changed = JSON.stringify(p) !== JSON.stringify(DEFAULT_DISPLAY);
  return (
    <div className="display-menu" ref={wrap}>
      <button ref={button} type="button" className="btn-ghost" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)} title="Motion, contrast, text size, reading font and Sanskrit terms">
        <span aria-hidden>Aa</span> Display
      </button>
      {open && (
        <div className="display-panel" id={panelId} role="dialog" aria-label="Display settings">
          <h2>Display</h2>
          <Seg legend="Motion" value={p.motion} choices={MOTION} onChange={(motion) => set({ motion })} hint="Reduce stops the drifting stars, the 3D spin and every slide and fade." />
          <Seg legend="Contrast" value={p.contrast} choices={CONTRAST} onChange={(contrast) => set({ contrast })} />
          <Seg legend="Text size" value={p.textScale} choices={SCALE} onChange={(textScale) => set({ textScale })} />
          <Seg legend="Reading font" value={p.font} choices={FONT} onChange={(font) => set({ font })} hint="OpenDyslexic also widens letter and word spacing." />
          <Seg legend="Sanskrit terms" value={p.terms} choices={TERMS} onChange={(terms) => set({ terms })} hint="Planet, sign, nakshatra and varga names in charts and tables. Written readings keep their language." />
          {showChartTable && (
            <label className="row-check">
              <input type="checkbox" checked={p.chartTable} onChange={(e) => set({ chartTable: e.target.checked })} />
              Show the chart as a table
            </label>
          )}
          {changed && <button type="button" className="btn-ghost sm reset" onClick={() => setDisplay(DEFAULT_DISPLAY)}>Reset to defaults</button>}
        </div>
      )}
    </div>
  );
}
