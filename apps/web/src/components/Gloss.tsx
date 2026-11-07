import { Fragment, useId, useRef, useState, type ReactNode } from 'react';
import { findTerms, GLOSSARY_BY_ID } from '../data/glossary';
import { useI18n } from '../i18n';

/**
 * A Sanskrit term with its meaning on hover, on keyboard focus or on tap.
 * The definition is the button's accessible description, so a screen reader reads it on focus.
 */
export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const g = GLOSSARY_BY_ID[id];
  const { terms } = useI18n();
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [focused, setFocused] = useState(false);
  const tipId = useId();
  const ref = useRef<HTMLButtonElement>(null);
  if (!g) return <>{children}</>;
  const open = hover || pinned || focused;
  const alt = terms === 'devanagari' ? `${g.deva} · ${g.iast}` : `${g.iast} · ${g.deva}`;
  return (
    <span className="gloss" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        ref={ref}
        type="button"
        className="gloss-term"
        aria-describedby={tipId}
        aria-expanded={pinned}
        onClick={() => setPinned((p) => !p)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setPinned(false); }}
        onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setPinned(false); setHover(false); setFocused(false); } }}
      >
        {children ?? g.term}
      </button>
      {/* always in the DOM (hidden when closed) so aria-describedby resolves */}
      <span role="tooltip" id={tipId} className="gloss-tip" hidden={!open}>
        <b>{g.term}</b>
        <span className="gloss-alt" lang="sa">{alt}{g.literal ? ` · “${g.literal}”` : ''}</span>
        {g.def}
      </span>
    </span>
  );
}

/**
 * Running text with its glossary terms marked. English readings only: in other languages the
 * terms are already in the reader's own words. Pass `seen` to mark each term once across paragraphs.
 */
export function Glossed({ text, seen }: { text: string; seen?: Set<string> }) {
  const { locale } = useI18n();
  if (locale !== 'en') return <>{text}</>;
  return (
    <>
      {findTerms(text, seen).map((p, i) => (typeof p === 'string' ? <Fragment key={i}>{p}</Fragment> : <Term key={i} id={p.id}>{p.text}</Term>))}
    </>
  );
}
