import type { Chart, PlanetId, VargaChart } from '../types/chart';
import type { Selection } from '../types/ui';
import { HOUSES, NAKSHATRAS, PLANET_BY_ID, PLANETS, signInfo, VARGAS } from '../data/constants';
import { addSigns, aspectedHouses, DIGNITY_KEY, dignityOf, dignityTone, formatDeg, housesRuledBy } from '../lib/astro';
import { useI18n } from '../i18n';
import type { VargaId } from '../types/chart';
import { LOCALE_BY_CODE } from '@vedic/i18n';
import { ayanamsaName } from '../i18n/names';
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

/** The UI's sign table uses capitalised English words for element and modality. */
const useSignWords = () => {
  const { v } = useI18n();
  return {
    elementName: (e: string) => v.element[e.toLowerCase() as keyof typeof v.element] ?? e,
    modalityName: (m: string) => v.modality[m.toLowerCase() as keyof typeof v.modality] ?? m,
  };
};
const firstItem = (list: string) => list.split(/[,،、]/)[0].trim();

function PlanetLink({ id, onSelect }: { id: PlanetId; onSelect: Props['onSelect'] }) {
  const p = PLANET_BY_ID[id];
  const { v } = useI18n();
  return (
    <button className="link-chip" style={{ '--c': p.color } as React.CSSProperties} onClick={() => onSelect({ kind: 'planet', id })}>
      <span className="link-glyph">{p.glyph}</span>{v.planets[id].name}
    </button>
  );
}

function Fact({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="fact"><dt>{k}</dt><dd>{v}</dd></div>
  );
}

function PlanetDetail({ chart, varga, id, onSelect, knowledge }: { chart: Chart; varga: VargaChart; id: PlanetId; onSelect: Props['onSelect']; knowledge?: Knowledge | null }) {
  const i18n = useI18n();
  const { t, v, tl } = i18n;
  const latin = LOCALE_BY_CODE[i18n.locale].script === 'latin';
  const ord = v.ordinal;
  const karaka = tl<Record<PlanetId, string>>('data.karaka');
  const p = chart.planets.find((x) => x.id === id)!;
  const info = PLANET_BY_ID[id];
  const vp = varga.planets[id];
  const sign = signInfo(vp.sign);
  const nak = NAKSHATRAS[p.nakshatra - 1];
  const dig = dignityOf(id, vp.sign);
  const reading = planetReading(chart, id, i18n);
  const report = knowledge?.report.planets[id];
  const rules = housesRuledBy(id, chart.ascendant.sign);
  const d9 = chart.vargas.D9?.planets[id];
  const vargottama = d9 && d9.sign === p.sign;

  return (
    <>
      <header className="detail-head" style={{ '--c': info.color } as React.CSSProperties}>
        <img className="detail-art" src={grahaArt(id).image} alt="" style={{ '--glow': grahaArt(id).glow } as React.CSSProperties} />
        <div>
          <h2>{v.planets[id].name}{latin && <span className="muted"> · {info.sanskrit}</span>}</h2>
          <p className="muted">{karaka[id]}</p>
        </div>
      </header>
      <div className="chips">
        <Chip tone={dignityTone(dig)}>{v.dignity[DIGNITY_KEY[dig]]}</Chip>
        {p.retrograde && id !== 'rahu' && id !== 'ketu' && <Chip tone="mid">{t('detail.retrograde')}</Chip>}
        {p.combust && <Chip tone="bad">{t('detail.combust')}</Chip>}
        {vargottama && <Chip tone="good">{t('detail.vargottama')}</Chip>}
        <Chip>{v.nature[info.nature]}</Chip>
      </div>
      <dl className="facts">
        <Fact k={t('detail.signIn', { varga: varga.id })} v={<>{sign.glyph} {v.signs[sign.num - 1]}{latin && v.signs[sign.num - 1] !== sign.sanskrit && <span className="muted"> ({sign.sanskrit})</span>}</>} />
        <Fact k={t('detail.house')} v={<button className="text-link" onClick={() => onSelect({ kind: 'house', num: vp.house })}>{ord(vp.house)} · {v.houses[vp.house - 1]}</button>} />
        <Fact k={t('detail.longitude')} v={`${formatDeg(p.degreeInSign)} ${v.signs[p.sign - 1]}`} />
        <Fact k={t('detail.nakshatra')} v={<button className="text-link" onClick={() => onSelect({ kind: 'nakshatra', num: nak.num })}>{v.nakshatras[nak.num - 1]} · {t('detail.padaN', { pada: p.pada })}</button>} />
        <Fact k={t('detail.signLord')} v={<PlanetLink id={sign.lord} onSelect={onSelect} />} />
        <Fact k={t('detail.starLord')} v={<PlanetLink id={nak.lord} onSelect={onSelect} />} />
        <Fact k={t('detail.rulesHouses')} v={rules.length ? rules.map(ord).join(', ') : '—'} />
        <Fact k={t('detail.aspects')} v={aspectedHouses(id, vp.house).map(ord).join(', ')} />
        <Fact k={t('detail.speed')} v={t('detail.perDay', { value: p.speed.toFixed(3) })} />
      </dl>

      {report ? (
        <>
          {varga.id !== 'D1' && <p className="reading-note">{t('detail.readingsForD1', { varga: varga.id })}</p>}
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
        <div className="reading-score" aria-label={t('detail.score', { score: reading.score })}>
          {[-3, -2, -1, 0, 1, 2, 3].map((n) => <span key={n} className={n === reading.score ? 'on' : ''} />)}
        </div>
        <h3>{reading.title}</h3>
        {varga.id !== 'D1' && <p className="reading-note">{t('detail.readingForD1', { varga: varga.id })}</p>}
        <p className="lead">{reading.summary}</p>
        {reading.detail.map((t, i) => <p key={i}>{t}</p>)}
        {reading.strengths.length > 0 && (
          <><h4 className="good">{t('detail.strengths')}</h4><ul>{reading.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></>
        )}
        {reading.challenges.length > 0 && (
          <><h4 className="bad">{t('detail.challenges')}</h4><ul>{reading.challenges.map((s, i) => <li key={i}>{s}</li>)}</ul></>
        )}
      </section>
      )}

      <section>
        <h4>{t('detail.acrossVargas')}</h4>
        <div className="varga-strip">
          {VARGAS.map((vg) => {
            const vv = chart.vargas[vg.id]?.planets[id];
            if (!vv) return null;
            const d = dignityOf(id, vv.sign);
            return (
              <div key={vg.id} className={`varga-cell tone-${dignityTone(d)}`} title={`${v.vargas[vg.id]}: ${v.signs[vv.sign - 1]}, ${v.dignity[DIGNITY_KEY[d]]}`}>
                <b>{vg.id}</b><span>{signInfo(vv.sign).glyph}</span><small>H{vv.house}</small>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function HouseDetail({ varga, num, onSelect, knowledge }: { varga: VargaChart; num: number; onSelect: Props['onSelect']; knowledge?: Knowledge | null }) {
  const { t, tp, v, tl } = useI18n();
  const { elementName, modalityName } = useSignWords();
  const ord = v.ordinal;
  const themes = tl<string[]>('data.houseThemes');
  const areas = tl<Record<VargaId, string>>('data.vargaArea');
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
          <h2>{t('detail.houseTitle', { ord: ord(num) })} <span className="muted">· {t('detail.bhava', { bhava: v.bhavas[num - 1] })}</span></h2>
          <p className="muted">{themes[num - 1]}</p>
        </div>
      </header>
      <div className="chips">
        {h.kind.map((k) => <Chip key={k}>{v.houseGroups[k.toLowerCase() as keyof typeof v.houseGroups] ?? k}</Chip>)}
        <Chip>{varga.id} · {v.vargas[vinfo.id]}</Chip>
      </div>
      <dl className="facts">
        <Fact k={t('detail.sign')} v={<>{sign.glyph} {v.signs[sign.num - 1]} <span className="muted">({elementName(sign.element)}, {modalityName(sign.modality)})</span></>} />
        <Fact k={t('detail.houseLord')} v={<><PlanetLink id={lord} onSelect={onSelect} /> <span className="muted">{t('detail.inThe', { ord: ord(lordHouse) })}</span></>} />
        <Fact k={t('detail.occupants')} v={occupants.length ? <div className="link-row">{occupants.map((p) => <PlanetLink key={p.id} id={p.id} onSelect={onSelect} />)}</div> : t('detail.empty')} />
        <Fact k={t('detail.aspectedBy')} v={aspectedBy.length ? <div className="link-row">{aspectedBy.map((p) => <PlanetLink key={p.id} id={p.id} onSelect={onSelect} />)}</div> : t('detail.none')} />
      </dl>
      <section className={`reading tone-${benefic > malefic ? 'benefic' : malefic > benefic ? 'challenging' : 'mixed'}`}>
        <h3>{t('detail.readingHouse', { ord: ord(num) })}</h3>
        <p className="lead">
          {t('detail.houseLead', { varga: v.vargas[vinfo.id], area: areas[vinfo.id].toLowerCase(), ord: ord(num), themes: themes[num - 1].toLowerCase() })}
        </p>
        <p>
          {t('detail.houseSign', {
            sign: v.signs[sign.num - 1], element: elementName(sign.element).toLowerCase(), modality: modalityName(sign.modality).toLowerCase(),
            lord: v.planets[lord].name, lordOrd: ord(lordHouse), lordHouse: v.houses[lordHouse - 1].toLowerCase(),
            house: v.houses[num - 1].toLowerCase(), lordTheme: firstItem(themes[lordHouse - 1]).toLowerCase(),
          })}
        </p>
        <p>
          {tp('detail.houseInfluences', benefic + malefic, { benefic, malefic })}
          {occupants.length === 0 ? ` ${t('detail.houseEmpty')}` : ''}
        </p>
      </section>
      {varga.id === 'D1' && knowledge && <ReadingBlock reading={knowledge.report.houseLords[num - 1]} open />}
    </>
  );
}

function NakshatraDetail({ chart, num, onSelect, knowledge }: { chart: Chart; num: number; onSelect: Props['onSelect']; knowledge?: Knowledge | null }) {
  const { t, v, tl } = useI18n();
  const deity = tl<string[]>('data.nakDeity')[num - 1];
  const symbol = tl<string[]>('data.nakSymbol')[num - 1];
  const theme = tl<string[]>('data.nakTheme')[num - 1];
  const name = v.nakshatras[num - 1];
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
          <h2>{name}</h2>
          <p className="muted">{theme}</p>
        </div>
      </header>
      <div className="chips">
        <Chip>{t('detail.gana', { gana: v.gana[n.gana.toLowerCase() as keyof typeof v.gana] })}</Chip>
        {isMoon && <Chip tone="good">{t('detail.janma')}</Chip>}
        {isAsc && <Chip tone="good">{t('detail.lagnaNak')}</Chip>}
      </div>
      <dl className="facts">
        <Fact k={t('detail.span')} v={`${formatDeg(start % 30)} ${v.signs[s0.num - 1]} → ${formatDeg((start + 360 / 27) % 30 || 30)}`} />
        <Fact k={t('detail.ruler')} v={<PlanetLink id={n.lord} onSelect={onSelect} />} />
        <Fact k={t('detail.deity')} v={deity} />
        <Fact k={t('detail.symbol')} v={symbol} />
        <Fact k={t('detail.planetsHere')} v={occupants.length ? <div className="link-row">{occupants.map((p) => <span key={p.id}><PlanetLink id={p.id} onSelect={onSelect} /> <small className="muted">{t('detail.padaN', { pada: p.pada })}</small></span>)}</div> : t('detail.none')} />
      </dl>
      <section className="reading tone-mixed">
        <h3>{t('detail.about', { name })}</h3>
        <p className="lead">{t('detail.nakLead', { name, lord: v.planets[n.lord].name, deity, symbol: symbol.toLowerCase() })}</p>
        <p>{t('detail.nakTheme', { theme: theme.toLowerCase(), lord: v.planets[n.lord].name })}</p>
        {profile && (
          <>
            <p>{profile.description}</p>
            <p><b>{t('detail.shakti')}</b> {profile.shakti}</p>
            <h4 className="good">{t('detail.gifts')}</h4><ul>{profile.gifts.map((s) => <li key={s}>{s}</li>)}</ul>
            <h4 className="bad">{t('detail.shadows')}</h4><ul>{profile.shadows.map((s) => <li key={s}>{s}</li>)}</ul>
            <h4>{t('detail.padas')}</h4><ol>{profile.padas.map((s) => <li key={s}>{s}</li>)}</ol>
          </>
        )}
      </section>
    </>
  );
}

function AscDetail({ chart, onSelect }: { chart: Chart; onSelect: Props['onSelect'] }) {
  const { t, v } = useI18n();
  const { elementName, modalityName } = useSignWords();
  const a = chart.ascendant;
  const sign = signInfo(a.sign);
  const signName = v.signs[a.sign - 1];
  const element = elementName(sign.element);
  const modality = modalityName(sign.modality);
  const nak = NAKSHATRAS[a.nakshatra - 1];
  return (
    <>
      <header className="detail-head" style={{ '--c': 'var(--accent)' } as React.CSSProperties}>
        <div className="detail-medal"><img src={rashiArt(sign.num)} alt="" /></div>
        <div>
          <h2>{t('detail.ascendant')} <span className="muted">· {t('detail.lagna')}</span></h2>
          <p className="muted">{t('detail.rising', { sign: signName })}</p>
        </div>
      </header>
      <dl className="facts">
        <Fact k={t('detail.degree')} v={`${formatDeg(a.degreeInSign)} ${signName}`} />
        <Fact k={t('detail.lagnaLord')} v={<PlanetLink id={sign.lord} onSelect={onSelect} />} />
        <Fact k={t('detail.nakshatra')} v={<button className="text-link" onClick={() => onSelect({ kind: 'nakshatra', num: a.nakshatra })}>{v.nakshatras[nak.num - 1]} · {t('detail.padaN', { pada: a.pada })}</button>} />
        <Fact k={t('detail.element')} v={`${element}, ${modality}`} />
        <Fact k={t('detail.ayanamsa')} v={`${ayanamsaName(t, chart.input.ayanamsa)} ${chart.meta.ayanamsaValue.toFixed(4)}°`} />
      </dl>
      <section className="reading tone-mixed">
        <h3>{t('detail.lagnaTitle', { sign: signName })}</h3>
        <p className="lead">{t('detail.ascLead', { sign: signName, element: element.toLowerCase(), modality: modality.toLowerCase() })}</p>
        <p>{t('detail.ascLord', { lord: v.planets[sign.lord].name })}</p>
      </section>
    </>
  );
}

export function DetailPanel({ chart, varga, selection, onSelect, knowledge }: Props) {
  const { t } = useI18n();
  if (!selection) {
    return (
      <div className="detail-empty">
        <div className="detail-empty-orb" />
        <h3>{t('detail.emptyTitle')}</h3>
        <p className="muted">{t('detail.emptyBody')}</p>
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
