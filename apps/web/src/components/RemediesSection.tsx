import { useMemo, useState } from 'react';
import type { Chart as EngineChart } from '@vedic/engine';
import { remedies, SOURCES, type Citation, type GrahaRemedy, type RemedyKind, type SourceId } from '@vedic/remedies';
import { PLANET_BY_ID, signInfo } from '../data/constants';
import './remedies.css';

const KIND_LABEL: Record<RemedyKind, string> = {
  mantra: 'Mantra', charity: 'Charity', fast: 'Fast', practice: 'Daily practice', yantra: 'Yantra', gem: 'Gemstone',
};
const SEVERITY_CLASS = { none: 'chip-good', mild: 'chip-mid', moderate: 'chip-bad', strong: 'chip-bad' } as const;
const NATURE_TEXT = { benefic: 'functional benefic', neutral: 'functionally neutral', malefic: 'functional malefic', node: 'node' } as const;
const GEM_TEXT = { consider: 'may suit', caution: 'only with advice', avoid: 'not advised' } as const;
const fmt = (n: number) => n.toLocaleString();
const CAVEAT = 'Optional and traditional. You don\'t need to buy anything, and no remedy replaces medical, legal or financial help.';

/** Sources are numbered in a fixed order, so a number means the same work everywhere on the page. */
const SOURCE_IDS = Object.keys(SOURCES) as SourceId[];
const num = (id: SourceId) => SOURCE_IDS.indexOf(id) + 1;

function Cite({ cite }: { cite: Citation | Citation[] }) {
  const list = Array.isArray(cite) ? cite : [cite];
  return (
    <sup className="rm-cite">
      {list.map((c, i) => (
        <a key={c.source + i} href={`#rm-src-${c.source}`} title={`${SOURCES[c.source].work}, ${c.locus ?? SOURCES[c.source].ref}`}>
          {num(c.source)}
        </a>
      ))}
    </sup>
  );
}

/** Traditional remedies for afflicted grahas, and the Ishta devata from the Karakamsa. */
export default function RemediesSection({ chart }: { chart: EngineChart }) {
  const r = useMemo(() => remedies(chart), [chart]);
  const [showAll, setShowAll] = useState(false);
  const d = r.ishtaDevata;
  const shown = showAll ? [...r.afflicted, ...r.grahas.filter((g) => !g.afflicted)] : r.afflicted;

  return (
    <div className="remedies">
      <div className="rm-notice" role="note">
        <b>Read this first.</b> {r.disclaimers[0]}
        <details>
          <summary>Fasting, gemstones and charity</summary>
          <ul>{r.disclaimers.slice(1).map((t) => <li key={t}>{t}</li>)}</ul>
        </details>
      </div>

      <section className="rm-ishta" aria-labelledby="rm-ishta-title">
        <div>
          <small className="muted">Ishta devata</small>
          <h4 id="rm-ishta-title">{d.deity}<Cite cite={d.cite.slice(0, 2)} /></h4>
          <p className="muted">
            from {PLANET_BY_ID[d.significator].name} {d.basis === 'occupant' ? 'in' : 'ruling'} {signInfo(d.twelfth).name}, the 12th from your Karakamsa in {signInfo(d.karakamsa).name}
          </p>
          <p className="rm-alt">Also read as {d.avatar}<Cite cite={d.cite[2]} />{d.alternatives.length > 0 && <>, or {d.alternatives.join(', ')}</>}.</p>
          {d.others.length > 0 && <p className="rm-alt">Also in the sign: {d.others.map((o) => `${PLANET_BY_ID[o.graha].name} (${o.deity})`).join(', ')}.</p>}
        </div>
        <div className="rm-ishta-why">{d.explanation.map((t) => <p key={t}>{t}</p>)}</div>
      </section>

      <div className="rm-head">
        <h4 className="yd-title">
          {r.afflicted.length ? `${r.afflicted.length} afflicted ${r.afflicted.length === 1 ? 'graha' : 'grahas'}, worst first` : 'No graha is clearly afflicted'}
        </h4>
        <label className="rm-toggle"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all nine</label>
      </div>
      {!r.afflicted.length && !showAll && (
        <p className="muted">None of the nine scores high enough on the classical afflictions to call for a remedy. The daily practices still apply; tick "Show all nine" to see them.</p>
      )}
      <div className="rm-list">
        {shown.map((g) => <GrahaCard key={g.graha} g={g} />)}
      </div>

      <details className="rm-method">
        <summary>How afflictions are scored</summary>
        <p>Each graha gets points for debilitation (3), a bitter enemy's sign (2) or an enemy's sign (1), combustion (2), a 6th, 8th or 12th house placement (1), malefics in its sign (1 each, up to 2), Saturn's or Mars's aspect (1 each), being hemmed between malefics (1), losing a planetary war (2), Shadbala below the classical minimum (1), and for the luminaries a node in the same sign (2) or, for the Moon, being within 72° of the Sun (1). Exaltation, own sign or moolatrikona take 2 away, and Jupiter's conjunction or aspect takes 1 away. A score of 2 or more counts as afflicted. Houses are whole sign from the lagna.</p>
        <p>Gems strengthen a planet, so they are only suggested for the lords of the 1st, 5th and 9th. For a planet that rules the 3rd, 6th, 8th or 11th, a gem would strengthen its troubles too, and mantra and charity are used instead<Cite cite={{ source: 'bphs_bhava_lords' }} />.</p>
      </details>

      <ol className="rm-sources" aria-label="Sources">
        {SOURCE_IDS.map((id) => {
          const s = SOURCES[id];
          return <li key={id} id={`rm-src-${id}`}><b>{s.work}</b>, {s.ref}.{s.note && <span className="muted"> {s.note}</span>}</li>;
        })}
      </ol>
    </div>
  );
}

function GrahaCard({ g }: { g: GrahaRemedy }) {
  const p = PLANET_BY_ID[g.graha];
  const s = g.set;
  const malas = Math.ceil(s.mantra.count / 108);
  const sections: Record<RemedyKind, React.ReactNode> = {
    mantra: (
      <>
        <p><b className="rm-say">{s.mantra.bija}</b><Cite cite={s.mantra.cite[0]} /></p>
        <p className="muted">Simpler daily form: {s.mantra.name}. Vedic mantra: <i>{s.mantra.vedic.incipit}</i> ({SOURCES[s.mantra.vedic.cite.source].work.split(' (')[0]} {s.mantra.vedic.cite.locus})<Cite cite={s.mantra.vedic.cite} />. Hymn: <i>{s.stotra.incipit}</i><Cite cite={s.stotra.cite} /></p>
        <p>Full japa {fmt(s.mantra.count)}<Cite cite={[s.mantra.cite[1], s.mantra.cite[2]]} /> (about {fmt(malas)} malas of 108; at 11 malas a day, {Math.ceil(malas / 11)} days). Some teachers use {fmt(s.mantra.vimshottariCount)}, from {p.name}'s Vimshottari years. Start on {s.fast.day}, in the waxing fortnight.</p>
      </>
    ),
    charity: (
      <>
        <p>Give {s.charity.items.join(', ')} on {s.fast.day}, or help {s.charity.serve}.<Cite cite={s.charity.cite[1]} /></p>
        <p className="muted">In a formal shanti the closing gift is {s.charity.dakshina} and the homa wood is {s.charity.samidh}<Cite cite={s.charity.cite[0]} />.</p>
      </>
    ),
    fast: <p>{s.fast.day}. {s.fast.note}<Cite cite={s.fast.cite} /></p>,
    practice: <p>{s.practice}</p>,
    yantra: (
      <div className="rm-yantra">
        <table aria-label={`${p.name} yantra, every line adds to ${s.yantra.total}`}>
          <tbody>{s.yantra.grid.map((row, i) => <tr key={i}>{row.map((n) => <td key={n}>{n}</td>)}</tr>)}</tbody>
        </table>
        <p className="muted">Every row, column and diagonal adds to {s.yantra.total}<Cite cite={s.yantra.cite} />. Drawn or engraved on {s.gem.metal.split(' or ')[0]}, and kept where you pray.</p>
      </div>
    ),
    gem: (
      <>
        <p>{s.gem.name} ({s.gem.sanskrit}) in {s.gem.metal}, on the {s.gem.finger}, first worn on {s.fast.day}.<Cite cite={s.gem.cite} /> Lower-cost substitutes: {s.gem.substitutes.join(', ')}.</p>
        <p className="muted">{g.gem.reason}</p>
      </>
    ),
  };
  const rest = (Object.keys(sections) as RemedyKind[]).filter((k) => !g.priority.includes(k));
  return (
    <article className={`rm-graha sev-${g.severity}`} aria-label={`${p.name} remedies`}>
      <header>
        <span className="rm-glyph" style={{ color: p.color }} aria-hidden>{p.glyph}</span>
        <div>
          <h5>{p.name} <span className="muted">{s.sanskrit}</span></h5>
          <div className="rm-chips">
            <span className={`chip ${SEVERITY_CLASS[g.severity]}`}>{g.severity === 'none' ? 'not afflicted' : `${g.severity} affliction`}</span>
            <span className="chip">{NATURE_TEXT[g.functional]}{g.rules.length > 0 && `, rules ${g.rules.join(' & ')}`}</span>
            <span className={`chip ${g.gem.advice === 'avoid' ? 'chip-bad' : g.gem.advice === 'consider' ? 'chip-good' : 'chip-mid'}`}>gem {GEM_TEXT[g.gem.advice]}</span>
            {g.runningDasha && <span className="chip chip-mid">{g.runningDasha} running now</span>}
          </div>
        </div>
      </header>
      {g.factors.length > 0 && (
        <ul className="rm-why">
          {g.factors.map((f) => <li key={f.id} className={f.weight < 0 ? 'is-help' : ''}>{f.reason}</li>)}
        </ul>
      )}
      <dl className="rm-do">
        {g.priority.map((k, i) => (
          <div key={k}><dt><span className="rm-n">{i + 1}</span>{KIND_LABEL[k]}</dt><dd>{sections[k]}</dd></div>
        ))}
      </dl>
      {rest.length > 0 && (
        <details className="rm-more">
          <summary>{rest.map((k) => KIND_LABEL[k]).join(', ')}</summary>
          <dl className="rm-do">{rest.map((k) => <div key={k}><dt>{KIND_LABEL[k]}</dt><dd>{sections[k]}</dd></div>)}</dl>
        </details>
      )}
      <p className="rm-caveat">{CAVEAT}</p>
    </article>
  );
}
