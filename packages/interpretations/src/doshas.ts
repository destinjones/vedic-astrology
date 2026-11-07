/**
 * Dosha definitions (original text) and detection rules, including cancellations.
 */
import { aspectsPlanet, houseFromPlanet, houseOf, isStrong, sameSign } from './chart-utils';
import type { ChartInput, DoshaDefinition, DoshaResult, HouseNumber, PlanetId, Reading } from './types';
import { SEVEN_PLANETS } from './types';
import { localizer, type LocaleOptions, type Localizer } from './i18n/context';

const r = (id: string, title: string, summary: string, detail: string[], strengths: string[], challenges: string[], remedies: string[], score: number): Reading => ({
  id: `dosha:${id}`, title, summary, detail, strengths, challenges, keywords: ['dosha'], tone: 'challenging', score, remedies,
});

export const DOSHA_DEFINITIONS: Record<string, DoshaDefinition> = {
  manglik: {
    id: 'manglik', name: 'Manglik Dosha', aka: ['Kuja Dosha', 'Mangal Dosha', 'Bhauma Dosha'],
    rule: 'Mars in the 1st, 2nd, 4th, 7th, 8th or 12th house from the ascendant (also checked from the Moon and Venus).',
    reading: r('manglik', 'Manglik Dosha', 'Mars’ heat falls on the houses of partnership and home.', [
      'Manglik dosha is the best-known marriage indicator in Vedic astrology. Mars in these houses brings intensity, independence and a strong will into partnership, which can show up as arguments, impatience or a need for space.',
      'It is extremely common (roughly half of all charts by some counts) and is cancelled in many ways. Traditionally two Manglik partners balance each other. In practice it means channelling Mars energy consciously: shared physical activity, clear agreements and patience.',
    ], ['passion', 'protectiveness', 'drive'], ['conflict in partnership', 'impatience', 'dominance'], ['Physical exercise and martial arts to channel Mars', 'Hanuman Chalisa or Mars mantra on Tuesdays', 'Choosing a partner whose chart has a similar Mars emphasis'], -1),
  },
  'kaal-sarp': {
    id: 'kaal-sarp', name: 'Kaal Sarp Dosha', aka: ['Kala Sarpa Yoga'],
    rule: 'All seven planets fall within the arc from Rahu to Ketu (or Ketu to Rahu) on one side of the nodal axis.',
    reading: r('kaal-sarp', 'Kaal Sarp Dosha', 'All planets are held between the serpent’s head and tail.', [
      'When every planet sits on one side of the Rahu–Ketu axis, life is said to be gripped by the serpent of time. People with this pattern often experience long stretches of struggle followed by sudden breakthroughs, and an intense, fated quality to major events.',
      'Classical texts do not all recognise this dosha, and many famous, successful people have it. It is best read as a strong nodal emphasis: obsessive focus, karmic intensity and a life that changes dramatically after the mid-30s or 40s.',
    ], ['intense focus', 'resilience', 'late breakthroughs'], ['delays', 'anxiety', 'fated struggles'], ['Rahu and Ketu mantras', 'Worship of Lord Shiva or Naga deities', 'Steady spiritual practice'], -1),
  },
  pitra: {
    id: 'pitra', name: 'Pitra Dosha', aka: ['Pitri Dosha'],
    rule: 'The Sun conjunct Rahu, Ketu or Saturn, or Rahu/Saturn in the 9th house, or the 9th lord afflicted by the nodes.',
    reading: r('pitra', 'Pitra Dosha', 'Unfinished business with the ancestral line.', [
      'Pitra dosha points to karmic debts of the ancestors or difficulties linked to the father’s line. It can show as obstacles in fortune, delays with children or a sense of carrying family burdens.',
      'Honouring the ancestors, caring for elders and acts of charity are the traditional responses.',
    ], ['strong ancestral connection'], ['obstacles to fortune', 'family burdens', 'issues with father'], ['Tarpan or shraddha rituals for ancestors', 'Feeding crows, cows or the needy', 'Charity on new moon days'], -1),
  },
  grahan: {
    id: 'grahan', name: 'Grahan Dosha', aka: ['Eclipse Dosha'],
    rule: 'The Sun or Moon in the same sign as Rahu or Ketu.',
    reading: r('grahan', 'Grahan Dosha', 'A luminary eclipsed by a node.', [
      'When Rahu or Ketu joins the Sun or Moon, the light of the self or of the mind is partly eclipsed. With the Sun it affects confidence and authority; with the Moon it affects emotional peace and clarity.',
      'This combination also gives intensity, intuition and an ability to work with the hidden.',
    ], ['intuition', 'intensity'], ['confusion', 'anxiety', 'identity struggles'], ['Mantras for the Sun or Moon', 'Meditation and regular sleep', 'Charity during eclipses'], -2),
  },
  'guru-chandala': {
    id: 'guru-chandala', name: 'Guru Chandala Dosha',
    rule: 'Jupiter in the same sign as Rahu.',
    reading: r('guru-chandala', 'Guru Chandala Dosha', 'The teacher shares a seat with the outsider.', [
      'This dosha challenges Jupiter’s wisdom and ethics. It can lead to wrong guidance, conflicts with teachers or a temptation to bend rules. With a strong Jupiter it produces original thinkers and reformers instead.',
    ], ['originality'], ['misplaced trust', 'ethical confusion'], ['Jupiter mantra on Thursdays', 'Respect for teachers and elders', 'Study of scripture or philosophy'], -1),
  },
  shrapit: {
    id: 'shrapit', name: 'Shrapit Dosha',
    rule: 'Saturn in the same sign as Rahu.',
    reading: r('shrapit', 'Shrapit Dosha', 'A “cursed” combination of Saturn and Rahu.', [
      'Saturn and Rahu together amplify fear, delay and karmic burden. Effort may feel unrewarded for long stretches. The same combination can build extraordinary endurance and unconventional success once the lesson is learned.',
    ], ['endurance'], ['delays', 'fear', 'heavy karma'], ['Saturn and Rahu mantras', 'Service to the elderly and disadvantaged', 'Patience and discipline'], -2),
  },
  angarak: {
    id: 'angarak', name: 'Angarak Dosha',
    rule: 'Mars in the same sign as Rahu.',
    reading: r('angarak', 'Angarak Dosha', 'Fire meets smoke: explosive energy.', [
      'Mars and Rahu together give enormous drive but also anger, accidents and rash decisions. Physical discipline and clear goals are the best outlet.',
    ], ['drive', 'courage'], ['anger', 'accidents'], ['Mars mantra on Tuesdays', 'Regular physical exercise', 'Avoiding unnecessary risk'], -2),
  },
  kemadruma: {
    id: 'kemadruma', name: 'Kemadruma Dosha',
    rule: 'No planets (other than the Sun and nodes) in the 2nd or 12th from the Moon, and no cancellation by planets in kendras.',
    reading: r('kemadruma', 'Kemadruma Dosha', 'The Moon stands alone.', [
      'Kemadruma leaves the mind without support, bringing periods of loneliness or financial struggle. It is cancelled by planets in kendras from the Moon or the ascendant.',
    ], ['self-reliance'], ['loneliness', 'financial ups and downs'], ['Moon mantra on Mondays', 'Wearing white or silver', 'Building supportive relationships'], -2),
  },
  gandanta: {
    id: 'gandanta', name: 'Gandanta',
    rule: 'The Moon or ascendant within the last pada of a water sign or the first pada of the following fire sign (Ashlesha–Magha, Jyeshtha–Mula, Revati–Ashwini).',
    reading: r('gandanta', 'Gandanta', 'Born at a knot between water and fire.', [
      'Gandanta marks the junction between emotional water signs and fiery new beginnings. It is associated with a difficult birth or early life, intense transformation and spiritual potential. It asks for conscious healing of early wounds.',
    ], ['spiritual potential', 'transformation'], ['early difficulty', 'emotional knots'], ['Ganesha worship', 'Mantras for the nakshatra lord', 'Therapeutic and spiritual practice'], -1),
  },
};

/** A dosha definition with its name, rule and reading in the given language (English where untranslated). */
export function localizedDosha(id: string, loc: Localizer = localizer('en')): DoshaDefinition {
  const d = DOSHA_DEFINITIONS[id];
  const t = loc.doshaText(id);
  if (!t) return d;
  const name = t.name ?? d.name;
  return {
    ...d,
    name,
    rule: t.rule ?? d.rule,
    reading: { ...d.reading, title: name, summary: t.summary ?? d.reading.summary, detail: t.detail ?? d.reading.detail, strengths: t.strengths ?? d.reading.strengths, challenges: t.challenges ?? d.reading.challenges, remedies: t.remedies ?? d.reading.remedies },
  };
}

// Detection runs synchronously, so the active language is held here for the duration of one call.
let L: Localizer = localizer('en');
const nameOf = (p: PlanetId) => L.planetName(p);
const withLocale = <T>(opts: LocaleOptions | undefined, fn: () => T): T => {
  const prev = L;
  L = localizer(opts?.locale);
  try { return fn(); } finally { L = prev; }
};

const res = (id: string, present: boolean, severity: DoshaResult['severity'], involved: PlanetId[], houses: HouseNumber[], reason: string, cancellations: string[] = [], name?: string): DoshaResult => {
  const d = localizedDosha(id, L);
  return { id, name: name ?? d.name, present, severity, involved, houses, reason, cancellations, reading: d.reading };
};

export function detectManglik(chart: ChartInput, opts?: LocaleOptions): DoshaResult {
  return withLocale(opts, () => manglik(chart));
}

function manglik(chart: ChartInput): DoshaResult {
  const MH = [1, 2, 4, 7, 8, 12];
  const h = houseOf(chart, 'mars');
  const fromMoon = houseFromPlanet(chart, 'moon', 'mars');
  const fromVenus = houseFromPlanet(chart, 'venus', 'mars');
  const refs = [MH.includes(h) && 'ascendant', MH.includes(fromMoon) && 'moon', MH.includes(fromVenus) && 'venus'].filter(Boolean) as ('ascendant' | 'moon' | 'venus')[];
  if (!refs.length) return res('manglik', false, 'low', ['mars'], [h], L.ph.manglikNone);
  const sign = chart.planets.mars.sign;
  const c: string[] = [];
  if ([1, 8, 10].includes(sign)) c.push(L.ph.mcOwnSign);
  if (sameSign(chart, 'mars', 'jupiter') || aspectsPlanet(chart, 'jupiter', 'mars')) c.push(L.ph.mcJupiter);
  if (sameSign(chart, 'mars', 'moon')) c.push(L.ph.mcMoon);
  if (h === 2 && [3, 6].includes(sign)) c.push(L.ph.mc2nd);
  if (h === 4 && [1, 8].includes(sign)) c.push(L.ph.mc4th);
  if (h === 7 && [4, 10].includes(sign)) c.push(L.ph.mc7th);
  if (h === 8 && [9, 12].includes(sign)) c.push(L.ph.mc8th);
  if (h === 12 && [2, 7].includes(sign)) c.push(L.ph.mc12th);
  if ([5, 11].includes(sign)) c.push(L.ph.mcLeoAquarius);
  const fromLagna = refs.includes('ascendant');
  const severity: DoshaResult['severity'] = c.length ? 'cancelled' : fromLagna && refs.length >= 2 ? 'high' : fromLagna ? 'moderate' : 'low';
  return res('manglik', severity !== 'cancelled', severity, ['mars'], [h], L.ph.manglikIn(refs.map((r) => L.ph.manglikRef[r]).join(', ')), c);
}

export function detectKaalSarp(chart: ChartInput, opts?: LocaleOptions): DoshaResult {
  return withLocale(opts, () => kaalSarp(chart));
}

function kaalSarp(chart: ChartInput): DoshaResult {
  const rahu = chart.planets.rahu.longitude;
  const arc = (lon: number) => (((lon - rahu) % 360) + 360) % 360; // 0..360 measured from Rahu
  const ps = SEVEN_PLANETS.map((p) => arc(chart.planets[p].longitude));
  const allOneSide = ps.every((x) => x <= 180) || ps.every((x) => x >= 180);
  const hr = houseOf(chart, 'rahu');
  if (allOneSide) {
    const kind = ps.every((x) => x <= 180) ? L.ph.kaalSarpKind.forward : L.ph.kaalSarpKind.reverse;
    const type = L.ph.kaalSarpNames[hr - 1];
    return res('kaal-sarp', true, 'moderate', ['rahu', 'ketu'], [hr, houseOf(chart, 'ketu')], L.ph.kaalSarp({ kind, type, ord: L.locale === 'en' ? String(hr) : L.ord(hr) }), [], L.ph.kaalSarpName(type));
  }
  const outside = SEVEN_PLANETS.filter((_, i) => ps[i] > 180);
  const inside = SEVEN_PLANETS.filter((_, i) => ps[i] <= 180);
  const minority = outside.length <= inside.length ? outside : inside;
  if (minority.length === 1) {
    return res('kaal-sarp', true, 'low', ['rahu', 'ketu', ...minority], [hr], L.ph.kaalSarpPartial(nameOf(minority[0])), [L.ph.kaalSarpBreaks(nameOf(minority[0]))], L.ph.kaalSarpPartialName);
  }
  return res('kaal-sarp', false, 'low', ['rahu', 'ketu'], [hr], L.ph.kaalSarpNone);
}

export function detectSimpleDoshas(chart: ChartInput, opts?: LocaleOptions): DoshaResult[] {
  return withLocale(opts, () => simpleDoshas(chart));
}

function simpleDoshas(chart: ChartInput): DoshaResult[] {
  const out: DoshaResult[] = [];
  // Pitra
  const pitraReasons: string[] = [];
  for (const m of ['rahu', 'ketu', 'saturn'] as PlanetId[]) if (sameSign(chart, 'sun', m)) pitraReasons.push(L.ph.pitraSunWith(nameOf(m)));
  for (const m of ['rahu', 'saturn'] as PlanetId[]) if (houseOf(chart, m) === 9) pitraReasons.push(L.ph.pitraIn9th(nameOf(m)));
  if (pitraReasons.length) out.push(res('pitra', true, pitraReasons.length > 1 ? 'high' : 'moderate', ['sun'], [9], L.ph.pitra(pitraReasons), isStrong(chart, 'sun') ? [L.ph.sunStrong] : []));
  // Grahan
  const gr: string[] = [];
  const grP: PlanetId[] = [];
  for (const l of ['sun', 'moon'] as PlanetId[]) for (const n of ['rahu', 'ketu'] as PlanetId[]) if (sameSign(chart, l, n)) { gr.push(L.ph.grahanWith(nameOf(l), nameOf(n))); grP.push(l, n); }
  if (gr.length) out.push(res('grahan', true, gr.length > 1 ? 'high' : 'moderate', [...new Set(grP)], [houseOf(chart, grP[0])], L.ph.grahan(gr)));
  if (sameSign(chart, 'jupiter', 'rahu')) out.push(res('guru-chandala', true, isStrong(chart, 'jupiter') ? 'low' : 'moderate', ['jupiter', 'rahu'], [houseOf(chart, 'jupiter')], L.ph.jupiterRahu, isStrong(chart, 'jupiter') ? [L.ph.jupiterStrong] : []));
  if (sameSign(chart, 'saturn', 'rahu')) out.push(res('shrapit', true, 'moderate', ['saturn', 'rahu'], [houseOf(chart, 'saturn')], L.ph.saturnRahu));
  if (sameSign(chart, 'mars', 'rahu')) out.push(res('angarak', true, 'moderate', ['mars', 'rahu'], [houseOf(chart, 'mars')], L.ph.marsRahu));
  // Kemadruma (dosha form)
  const others = SEVEN_PLANETS.filter((p) => p !== 'sun' && p !== 'moon') as PlanetId[];
  const flank = others.some((p) => [2, 12].includes(houseFromPlanet(chart, 'moon', p)));
  if (!flank) {
    const cancel: string[] = [];
    if (others.some((p) => [1, 4, 7, 10].includes(houseFromPlanet(chart, 'moon', p)))) cancel.push(L.ph.kemaKendraMoon);
    if (others.some((p) => [1, 4, 7, 10].includes(houseOf(chart, p)))) cancel.push(L.ph.kemaKendraLagna);
    out.push(res('kemadruma', cancel.length === 0, cancel.length ? 'cancelled' : 'high', ['moon'], [houseOf(chart, 'moon')], L.ph.kemadrumaDosha, cancel));
  }
  // Gandanta
  const span = 360 / 27;
  const gandantaOf = (lon: number) => {
    const l = ((lon % 360) + 360) % 360;
    for (const j of [120, 240, 360]) {
      const d = l - (j % 360);
      const dd = ((d + 540) % 360) - 180;
      if (Math.abs(dd) <= span / 4) return true;
    }
    return false;
  };
  const g: string[] = [];
  const moonG = gandantaOf(chart.planets.moon.longitude);
  if (moonG) g.push(L.ph.gandantaMoon);
  if (chart.ascendantLongitude !== undefined && gandantaOf(chart.ascendantLongitude)) g.push(L.ph.gandantaAsc);
  if (g.length) out.push(res('gandanta', true, g.length > 1 ? 'high' : 'moderate', moonG ? ['moon'] : [], [houseOf(chart, 'moon')], L.ph.gandanta(g)));
  return out;
}

/** Detect all supported doshas. Manglik and Kaal Sarp are always returned (present or not). */
export function detectDoshas(chart: ChartInput, opts?: LocaleOptions): DoshaResult[] {
  return [detectManglik(chart, opts), detectKaalSarp(chart, opts), ...detectSimpleDoshas(chart, opts)];
}
