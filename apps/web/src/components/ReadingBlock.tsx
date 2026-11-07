import type { Reading } from '../lib/readings';
import { useI18n } from '../i18n';
import { CiteMark, SourceNote } from './Citation';
import { Glossed } from './Gloss';

/** One expandable reading from the interpretation library. */
export function ReadingBlock({ reading, open }: { reading: Reading; open?: boolean }) {
  const { t } = useI18n();
  // each term is explained once per reading, at its first appearance
  const seen = new Set<string>();
  return (
    <details className={`reading-block tone-${reading.tone}`} open={open}>
      <summary><span className="tone-dot" aria-hidden />{reading.title}</summary>
      <div className="reading-body">
        <p className="lead"><Glossed text={reading.summary} seen={seen} /><CiteMark source={reading.source} /></p>
        {reading.detail.map((t) => <p key={t}><Glossed text={t} seen={seen} /></p>)}
        {reading.strengths.length > 0 && <><h4 className="good">{t('detail.strengths')}</h4><ul>{reading.strengths.map((s) => <li key={s}>{s}</li>)}</ul></>}
        {reading.challenges.length > 0 && <><h4 className="bad">{t('detail.challenges')}</h4><ul>{reading.challenges.map((s) => <li key={s}>{s}</li>)}</ul></>}
        {reading.remedies && reading.remedies.length > 0 && <p className="remedies"><b>{t('detail.remedies')}</b> {reading.remedies.join(' ')}</p>}
        <SourceNote source={reading.source} />
      </div>
    </details>
  );
}
