import type { Chart, PlanetId, VargaChart } from '../types/chart';
import type { Selection } from '../types/ui';
import { HOUSES, NAKSHATRAS, PLANET_BY_ID, PLANETS, signInfo, VARGAS } from '../data/constants';
import { addSigns, aspectedHouses, dignityOf, dignityTone, formatDeg, housesRuledBy, ordinal } from '../lib/astro';
import { planetReading } from '../lib/insights';
import { grahaArt, nakshatraArt, rashiArt } from '../data/art';
import type { Knowledge } from '../lib/readings';
import { ReadingBlock } from './ReadingBlock';

interface Props {
  chart: Chart;
  varga: VargaChart;
  selection: Selection | null;
  onSelect: (s: Selection) => void;
  knowledge?: Knowledge | null;
}

const Chip = ({ children, tone }: { children: React.ReactNode; tone?: 'good' | 'mid' | 'bad' }) => (
  <span className={`chip${tone ? ` chip-${tone}` : ''}`}>{children}</span>
);

function PlanetLink({ id, onSelect }: { id: PlanetId; onSelect: Props['onSelect'] }) {
  const p = PLANET_BY_ID[id];
  return (
    <button className="link-chip" style={{ '--c': p.color } as React.CSSProperties} onClick={() => onSelect({ kind: 'planet', id })}>
      <span className="link-glyph">{p.glyph}</span>{p.name}
    </button>
  );
}

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="fact"><dt>{k}</dt><dd>{v}</dd></div>
  );
}

function PlanetDetail({ chart, varga, id, onSelect, knowledge }: { chart: Chart; varga: VargaChart; id: PlanetId; onSelect: Props['onSelect']; knowledge?: Knowledge | null }) {
  const p = chart.planets.find((x) => x.id === id)!;
  const info = PLANET_BY_ID[id];
  const vp = varga.planets[id];
  const sign = signInfo(vp.sign);
  const nak = NAKSHATRAS[p.nakshatra - 1];
  const dig = dignityOf(id, vp.sign);
  const reading = planetReading(chart, id);
  const report = knowledge?.report.planets[id];
  const rules = housesRuledBy(id, chart.ascendant.sign);
  const d9 = chart.vargas.D9?.planets[id];
  const vargottama = d9 && d9.sign === p.sign;

  return (
    <>
      <header className="detail-head" style={{ '--c': info.color } as React.CSSProperties}>
        <img className="detail-art" src={grahaArt(id).image} alt="" style={{ '--glow': grahaArt(id).glow } as React.CSSProperties} />
        <div>
          <h2>{info.name} <span className="muted">· {info.sanskrit}</span></h2>
          <p className="muted">{info.karaka}</p>
        </div>
      </header>
      <div className="chips">
        <Chip tone={dignityTone(dig)}>{dig}</Chip>
        {p.retrograde && id !== 'rahu' && id !== 'ketu' && <Chip tone="mid">Retrograde ℞</Chip>}
        {p.combust && <Chip tone="bad">Combust</Chip>}
        {vargottama && <Chip tone="good">Vargottama</Chip>}
        <Chip>{info.nature}</Chip>
      </div>
      <dl className="facts">
        <Fact k={`Sign (${varga.id})`} v={<>{sign.glyph} {sign.name} <span className="muted">({sign.sanskrit})</span></>} />
        <Fact k="House" v={<button className="text-link" onClick={() => onSelect({ kind: 'house', num: vp.house })}>{ordinal(vp.house)} · {HOUSES[vp.house - 1].name}</button>} />
        <Fact k="Longitude" v={`${formatDeg(p.degreeInSign)} ${signInfo(p.sign).short}`} />
        <Fact k="Nakshatra" v={<button className="text-link" onClick={() => onSelect({ kind: 'nakshatra', num: nak.num })}>{nak.name} · pada {p.pada}</button>} />
        <Fact k="Sign lord" v={<PlanetLink id={sign.lord} onSelect={onSelect} />} />
        <Fact k="Star lord" v={<PlanetLink id={nak.lord} onSelect={onSelect} />} />
        <Fact k="Rules houses" v={rules.length ? rules.map(ordinal).join(', ') : '—'} />
        <Fact k="Aspects" v={aspectedHouses(id, vp.house).map(ordinal).join(', ')} />
        <Fact k="Speed" v={`${p.speed.toFixed(3)}°/day`} />
      </dl>

      {report ? (
        <>
          {varga.id !== 'D1' && <p className="reading-note">Readings are for the birth chart (D1). The facts above show the {varga.id} placement.</p>}
          <ReadingBlock reading={report.sign} open />
          <ReadingBlock reading={report.house} open />
          <ReadingBlock reading={report.nakshatra} />
          {report.retrograde && <ReadingBlock reading={report.retrograde} />}
          {report.combust && <p className="reading-note">{report.combust}</p>}
          {report.lordships.map((r) => <ReadingBlock key={r.id} reading={r} />)}
          {report.conjunctions.map((r) => <ReadingBlock key={r.id} reading={r} />)}
          {report.aspects.map((r) => <ReadingBlock key={r.id} reading={r} />)}
        </>
      ) : (
      <section className={`reading tone-${reading.tone}`}>
        <div className="reading-score" aria-label={`score ${reading.score}`}>
          {[-3, -2, -1, 0, 1, 2, 3].map((n) => <span key={n} className={n === reading.score ? 'on' : ''} />)}
        </div>
        <h3>{reading.title}</h3>
        {varga.id !== 'D1' && <p className="reading-note">Reading is for the birth chart (D1). The facts above show the {varga.id} placement.</p>}
        <p className="lead">{reading.summary}</p>
        {reading.detail.map((t, i) => <p key={i}>{t}</p>)}
        {reading.strengths.length > 0 && (
          <><h4 className="good">Strengths</h4><ul>{reading.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></>
        )}
        {reading.challenges.length > 0 && (
          <><h4 className="bad">Challenges</h4><ul>{reading.challenges.map((s, i) => <li key={i}>{s}</li>)}</ul></>
        )}
      </section>
      )}

      <section>
        <h4>Across divisional charts</h4>
        <div className="varga-strip">
          {VARGAS.map((v) => {
            const vv = chart.vargas[v.id]?.planets[id];
            if (!vv) return null;
            const d = dignityOf(id, vv.sign);
            return (
              <div key={v.id} className={`varga-cell tone-${dignityTone(d)}`} title={`${v.name}: ${signInfo(vv.sign).name}, ${d}`}>
                <b>{v.id}</b><span>{signInfo(vv.sign).glyph}</span><small>H{vv.house}</small>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function HouseDetail({ varga, num, onSelect, knowledge }: { varga: VargaChart; num: number; onSelect: Props['onSelect']; knowledge?: Knowledge | null }) {
  const h = HOUSES[num - 1];
  const sign = signInfo(addSigns(varga.ascSign, num - 1));
  const occupants = PLANETS.filter((p) => varga.planets[p.id].house === num);
  const aspectedBy = PLANETS.filter((p) => aspectedHouses(p.id, varga.planets[p.id].house).includes(num));
  const lord = sign.lord;
  const lordHouse = varga.planets[lord].house;
  const vinfo = VARGAS.find((v) => v.id === varga.id)!;
  const benefic = occupants.filter((p) => p.nature === 'benefic').length + aspectedBy.filter((p) => p.nature === 'benefic').length;
  const malefic = occupants.filter((p) => p.nature === 'malefic').length + aspectedBy.filter((p) => p.nature === 'malefic').length;

  return (
    <>
      <header className="detail-head" style={{ '--c': 'var(--accent)' } as React.CSSProperties}>
        <div className="detail-medal">
          <img src={rashiArt(sign.num)} alt="" />
          <span className="medal-badge">{num}</span>
        </div>
        <div>
          <h2>{ordinal(num)} house <span className="muted">· {h.bhava} Bhava</span></h2>
          <p className="muted">{h.themes}</p>
        </div>
      </header>
      <div className="chips">
        {h.kind.map((k) => <Chip key={k}>{k}</Chip>)}
        <Chip>{varga.id} · {vinfo.name}</Chip>
      </div>
      <dl className="facts">
        <Fact k="Sign" v={<>{sign.glyph} {sign.name} <span className="muted">({sign.element}, {sign.modality})</span></>} />
        <Fact k="House lord" v={<><PlanetLink id={lord} onSelect={onSelect} /> <span className="muted">in the {ordinal(lordHouse)}</span></>} />
        <Fact k="Occupants" v={occupants.length ? <div className="link-row">{occupants.map((p) => <PlanetLink key={p.id} id={p.id} onSelect={onSelect} />)}</div> : 'Empty'} />
        <Fact k="Aspected by" v={aspectedBy.length ? <div className="link-row">{aspectedBy.map((p) => <PlanetLink key={p.id} id={p.id} onSelect={onSelect} />)}</div> : 'None'} />
      </dl>
      <section className={`reading tone-${benefic > malefic ? 'benefic' : malefic > benefic ? 'challenging' : 'mixed'}`}>
        <h3>Reading the {ordinal(num)} house</h3>
        <p className="lead">
          In {vinfo.name.toLowerCase()} ({vinfo.area.toLowerCase()}), the {ordinal(num)} house shows {h.themes.toLowerCase()}.
        </p>
        <p>
          {sign.name} on the cusp gives these matters a {sign.element.toLowerCase()}, {sign.modality.toLowerCase()} character.
          Its lord {PLANET_BY_ID[lord].name} sits in the {ordinal(lordHouse)} house ({HOUSES[lordHouse - 1].name.toLowerCase()}),
          so {h.name.toLowerCase()} is tied to {HOUSES[lordHouse - 1].themes.split(',')[0].toLowerCase()}.
        </p>
        <p>
          {benefic} benefic and {malefic} malefic influence{benefic + malefic === 1 ? '' : 's'} reach this house by occupation or aspect.
          {occupants.length === 0 ? ' An empty house is judged mainly through its lord.' : ''}
        </p>
      </section>
      {varga.id === 'D1' && knowledge && <ReadingBlock reading={knowledge.report.houseLords[num - 1]} open />}
    </>
  );
}

function NakshatraDetail({ chart, num, onSelect, knowledge }: { chart: Chart; num: number; onSelect: Props['onSelect']; knowledge?: Knowledge | null }) {
  const n = NAKSHATRAS[num - 1];
  const start = (num - 1) * (360 / 27);
  const s0 = signInfo(Math.floor(start / 30) + 1);
  const occupants = chart.planets.filter((p) => p.nakshatra === num);
  const isMoon = chart.planets.find((p) => p.id === 'moon')!.nakshatra === num;
  const isAsc = chart.ascendant.nakshatra === num;
  const profile = knowledge?.getNakshatra(num);
  return (
    <>
      <header className="detail-head" style={{ '--c': PLANET_BY_ID[n.lord].color } as React.CSSProperties}>
        <div className="detail-medal"><img src={nakshatraArt(num)} alt="" /></div>
        <div>
          <h2>{n.name}</h2>
          <p className="muted">{n.theme}</p>
        </div>
      </header>
      <div className="chips">
        <Chip>{n.gana} gana</Chip>
        {isMoon && <Chip tone="good">Janma nakshatra (Moon)</Chip>}
        {isAsc && <Chip tone="good">Lagna nakshatra</Chip>}
      </div>
      <dl className="facts">
        <Fact k="Span" v={`${formatDeg(start % 30)} ${s0.short} → ${formatDeg((start + 360 / 27) % 30 || 30)}`} />
        <Fact k="Ruler" v={<PlanetLink id={n.lord} onSelect={onSelect} />} />
        <Fact k="Deity" v={n.deity} />
        <Fact k="Symbol" v={n.symbol} />
        <Fact k="Planets here" v={occupants.length ? <div className="link-row">{occupants.map((p) => <span key={p.id}><PlanetLink id={p.id} onSelect={onSelect} /> <small className="muted">pada {p.pada}</small></span>)}</div> : 'None'} />
      </dl>
      <section className="reading tone-mixed">
        <h3>About {n.name}</h3>
        <p className="lead">{n.name} is ruled by {PLANET_BY_ID[n.lord].name} and presided over by {n.deity}, symbolised by {n.symbol.toLowerCase()}.</p>
        <p>Planets here take on the theme of {n.theme.toLowerCase()}, and their dasha results are coloured by {PLANET_BY_ID[n.lord].name}.</p>
        {profile && (
          <>
            <p>{profile.description}</p>
            <p><b>Shakti:</b> {profile.shakti}</p>
            <h4 className="good">Gifts</h4><ul>{profile.gifts.map((s) => <li key={s}>{s}</li>)}</ul>
            <h4 className="bad">Shadows</h4><ul>{profile.shadows.map((s) => <li key={s}>{s}</li>)}</ul>
            <h4>The four padas</h4><ol>{profile.padas.map((s) => <li key={s}>{s}</li>)}</ol>
          </>
        )}
      </section>
    </>
  );
}

function AscDetail({ chart, onSelect }: { chart: Chart; onSelect: Props['onSelect'] }) {
  const a = chart.ascendant;
  const sign = signInfo(a.sign);
  const nak = NAKSHATRAS[a.nakshatra - 1];
  return (
    <>
      <header className="detail-head" style={{ '--c': 'var(--accent)' } as React.CSSProperties}>
        <div className="detail-medal"><img src={rashiArt(sign.num)} alt="" /></div>
        <div>
          <h2>Ascendant <span className="muted">· Lagna</span></h2>
          <p className="muted">{sign.name} rising, the lens for the whole chart</p>
        </div>
      </header>
      <dl className="facts">
        <Fact k="Degree" v={`${formatDeg(a.degreeInSign)} ${sign.name}`} />
        <Fact k="Lagna lord" v={<PlanetLink id={sign.lord} onSelect={onSelect} />} />
        <Fact k="Nakshatra" v={<button className="text-link" onClick={() => onSelect({ kind: 'nakshatra', num: a.nakshatra })}>{nak.name} · pada {a.pada}</button>} />
        <Fact k="Element" v={`${sign.element}, ${sign.modality}`} />
        <Fact k="Ayanamsa" v={`${chart.input.ayanamsa} ${chart.meta.ayanamsaValue.toFixed(4)}°`} />
      </dl>
      <section className="reading tone-mixed">
        <h3>{sign.name} lagna</h3>
        <p className="lead">The ascendant sets body, temperament and the order of every house. {sign.name} rising gives a {sign.element.toLowerCase()}, {sign.modality.toLowerCase()} style.</p>
        <p>Its lord {PLANET_BY_ID[sign.lord].name} is the most important planet to examine. Click it above to see where it sits.</p>
      </section>
    </>
  );
}

export function DetailPanel({ chart, varga, selection, onSelect, knowledge }: Props) {
  if (!selection) {
    return (
      <div className="detail-empty">
        <div className="detail-empty-orb" />
        <h3>Tap anything to explore</h3>
        <p className="muted">Click a planet, a house, the ascendant or a nakshatra on the wheel to open its full profile here. Hover a planet to see which houses it aspects.</p>
      </div>
    );
  }
  switch (selection.kind) {
    case 'planet': return <PlanetDetail chart={chart} varga={varga} id={selection.id} onSelect={onSelect} knowledge={knowledge} />;
    case 'house': return <HouseDetail varga={varga} num={selection.num} onSelect={onSelect} knowledge={knowledge} />;
    case 'nakshatra': return <NakshatraDetail chart={chart} num={selection.num} onSelect={onSelect} knowledge={knowledge} />;
    case 'asc': return <AscDetail chart={chart} onSelect={onSelect} />;
  }
}
