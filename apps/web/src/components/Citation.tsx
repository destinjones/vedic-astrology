import type { Citation as Cite, RuleSource } from '../lib/readings';
import { useI18n } from '../i18n';

/** "BPHS 37.7–10". Kept local so the main bundle does not pull in the reading library. */
export const citeLabel = (c: Cite) => `${c.text} ${c.chapter}${c.verse ? `.${c.verse.replace('-', '–')}` : ''}`;

/** Superscript link(s) to the classical source of a rule, placed after the sentence it supports. */
export function CiteMark({ source }: { source?: RuleSource | null }) {
  const { t } = useI18n();
  if (!source) return null;
  if (!source.citations.length) {
    return source.nonClassical ? <sup className="cite cite-none" title={source.nonClassical}>{t('cite.noClassical')}</sup> : null;
  }
  return (
    <sup className="cite">
      {source.citations.map((c, i) => (
        <span key={`${citeLabel(c)}${i}`}>
          {i > 0 && '; '}
          {c.url
            ? <a href={c.url} target="_blank" rel="noreferrer" title={c.note ?? citeLabel(c)}>{citeLabel(c)}</a>
            : <span title={c.note}>{citeLabel(c)}</span>}
        </span>
      ))}
    </sup>
  );
}

/** The full source note: what each cited passage says, and where the texts disagree. */
export function SourceNote({ source }: { source?: RuleSource | null }) {
  const { t } = useI18n();
  if (!source) return null;
  const notes = source.citations.filter((c) => c.note);
  if (!notes.length && !source.disagreement && !source.nonClassical) return null;
  return (
    <div className="source-note">
      <h4>{t('cite.sources')}</h4>
      {notes.length > 0 && <ul>{notes.map((c, i) => <li key={i}><b>{citeLabel(c)}</b>: {c.note}</li>)}</ul>}
      {source.nonClassical && <p>{source.nonClassical}</p>}
      {source.disagreement && <p><b>{t('cite.disagreement')}</b> {source.disagreement}</p>}
    </div>
  );
}
