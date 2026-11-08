import { useMemo, useState } from 'react';
import type { Chart } from '../types/chart';
import { labelFor, topicKeys, type Found } from './placements';
import { newId, phrasesFor, savePhrase, usePhrases, withPhrase } from './store';
import './practice.css';

/**
 * Sits under a text box: the astrologer's saved phrases for what the box is
 * about, one click to add each, and a way to save what they wrote as a new phrase.
 */
export function PhraseTools({ chart, topics, found, value, onChange, compact }: {
  chart: Chart;
  /** What the text is about (graha:moon, house:7, yogas, all…). */
  topics: string[];
  found?: Found | null;
  value: string;
  onChange: (text: string) => void;
  compact?: boolean;
}) {
  const phrases = usePhrases();
  const keys = useMemo(() => [...new Set(topics.flatMap((t) => topicKeys(chart, t, found)))], [chart, topics, found]);
  const matches = useMemo(() => phrasesFor(phrases, keys), [phrases, keys]);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  if (!keys.length) return null;
  const used = (t: string) => value.includes(t.trim());
  const open = () => { setChosen(keys.slice(0, 1)); setTitle(''); setSaved(false); setSaving(true); };

  return (
    <div className={`phrase-tools${compact ? ' compact' : ''}`}>
      {matches.length > 0 && (
        <div className="phrase-chips" role="group" aria-label="Your saved phrases for this">
          <span className="muted">Your phrases:</span>
          {matches.slice(0, 8).map((p) => (
            <button key={p.id} type="button" className={`phrase-chip${used(p.text) ? ' used' : ''}`} disabled={used(p.text)}
              title={p.text.length > 280 ? `${p.text.slice(0, 280)}…` : p.text}
              onClick={() => onChange(withPhrase(value, p.text))}>
              {used(p.text) ? '✓ ' : '+ '}{p.title || p.keys.map(labelFor).join(', ')}
            </button>
          ))}
          {matches.length > 8 && <span className="muted">and {matches.length - 8} more in Readings and phrases</span>}
        </div>
      )}
      {value.trim() && !saving && (
        <button type="button" className="phrase-save-link" onClick={open}>{saved ? 'Saved to your phrases ✓' : 'Save as a phrase'}</button>
      )}
      {saving && (
        <div className="phrase-save">
          <input aria-label="Phrase name" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name (optional), e.g. Moon in Rohini, the gardener" />
          <div className="phrase-keys" role="group" aria-label="Suggest it again for">
            <span className="muted">Suggest it again for:</span>
            {keys.map((k) => (
              <label key={k} className="phrase-key">
                <input type="checkbox" checked={chosen.includes(k)} onChange={() => setChosen((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]))} />
                {labelFor(k)}
              </label>
            ))}
          </div>
          <span className="phrase-save-actions">
            <button type="button" className="btn-ghost sm" onClick={() => setSaving(false)}>Cancel</button>
            <button type="button" className="btn-primary sm" disabled={!chosen.length} onClick={() => {
              savePhrase({ id: newId('ph'), title: title.trim(), text: value.trim(), keys: chosen, updatedAt: '' });
              setSaving(false);
              setSaved(true);
            }}>Save phrase</button>
          </span>
        </div>
      )}
    </div>
  );
}
