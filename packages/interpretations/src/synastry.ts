/**
 * Synastry: reading one chart against another.
 *
 * Three layers, all whole-sign and sidereal like the rest of the package:
 *  1. House overlays: where each of one person's grahas falls in the other
 *     person's houses (counted from the other's Lagna).
 *  2. Cross contacts: conjunctions (same sign, with the degree gap) and
 *     graha drishti from one person's planets onto the other's.
 *  3. Moon-to-Moon and Lagna-to-Lagna sign distances.
 *
 * Text is original and written for reflection, in the same plain voice as
 * the rest of the knowledge base. For the classical Ashtakoota points score,
 * use the matching module; this module describes how two charts interact.
 */
import type { ChartInput, PlanetId, Tone } from './types';
import { PLANETS } from './types';
import { PLANET_PROFILES } from './data/planets';
import { HOUSES } from './data/houses';
import { getSign } from './data/signs';
import { signDistance, NATURAL_BENEFICS } from './chart-utils';
import { toneOf } from './interpret';

export interface SynastryPerson {
  /** Display name used in the composed text, e.g. "Asha". */
  name: string;
  chart: ChartInput;
}

export interface HouseOverlay {
  /** Whose planet it is. */
  planet: PlanetId;
  /** House of the host chart the planet lands in (1–12). */
  house: number;
  sign: number;
  title: string;
  summary: string;
  detail: string;
  tone: Tone;
  score: number;
}

export type ContactKind = 'conjunction' | 'aspect' | 'mutual aspect';

export interface CrossContact {
  /** Planet of the first person. */
  a: PlanetId;
  /** Planet of the second person. */
  b: PlanetId;
  kind: ContactKind;
  /** For an aspect: who casts it. A mutual aspect or conjunction is 'both'. */
  from: 'a' | 'b' | 'both';
  /** Degree gap for conjunctions, so the closest ones can be shown first. */
  orb?: number;
  title: string;
  text: string;
  tone: Tone;
  score: number;
  /** How much the contact matters, for sorting (higher first). */
  weight: number;
}

export interface SignRelation {
  /** Count from the first person's sign to the second's (1–12). */
  count: number;
  /** The pair as tradition names it, e.g. "2/12". */
  pair: string;
  title: string;
  text: string;
  tone: Tone;
}

export interface SynastryReport {
  a: string;
  b: string;
  /** b's planets in a's houses. */
  bInA: HouseOverlay[];
  /** a's planets in b's houses. */
  aInB: HouseOverlay[];
  contacts: CrossContact[];
  moon: SignRelation;
  lagna: SignRelation;
  /** Short, readable summary lines for the top of the report. */
  highlights: string[];
  /** Rough balance from -10 to +10. Not a compatibility verdict. */
  balance: number;
}

/* ---------- what each planet brings into someone else's life ---------- */

const PLANET_GIFT: Record<PlanetId, string> = {
  sun: 'brings visibility, confidence and a wish to lead or be respected',
  moon: 'brings feeling, care and an instinct to nurture and be nurtured',
  mars: 'brings energy, heat, push and sometimes friction',
  mercury: 'brings talk, ideas, humour and a need to exchange and understand',
  jupiter: 'brings encouragement, generosity, wisdom and a sense of meaning',
  venus: 'brings affection, pleasure, beauty and an easy wish to please',
  saturn: 'brings seriousness, staying power, duty and tests of patience',
  rahu: 'brings fascination, hunger and the pull of something unfamiliar',
  ketu: 'brings a sense of the already-known, detachment and quiet insight',
};

/** How the host experiences any planet arriving in this house. */
const HOUSE_FEEL: Record<number, string> = {
  1: 'This lands on the host\'s sense of self, so it is felt personally and right away: it shapes how they see themselves when the two are together.',
  2: 'This touches money, food, speech and family values: the pair notices it in shared resources, the way they talk and what they treat as worth keeping.',
  3: 'This stirs courage, plans and conversation: the pair tends to do things together, travel short distances, message often and push each other to try.',
  4: 'This reaches the host\'s home and heart: it is felt in domestic life, comfort and whether the host can relax around the other person.',
  5: 'This lights up romance, play, creativity and children: it is one of the warmest places for a partner\'s planet to fall.',
  6: 'This lands in the house of service, health and rivalry: the bond can be helpful and practical, but daily friction and criticism need watching.',
  7: 'This falls straight on the house of partnership: the host sees the other person as a partner figure, for better or worse, and the planet colours the whole relationship.',
  8: 'This touches the hidden, shared and transformative: the bond feels intense and private, with joint finances, trust and deep change all in play.',
  9: 'This reaches beliefs, teachers and fortune: the other person can feel like a guide or a lucky influence, and the pair may share faith, study or long journeys.',
  10: 'This lands on career and public life: the other person affects the host\'s work, standing and ambitions, and the pair may build something visible.',
  11: 'This touches gains, friends and hopes: the other person supports the host\'s goals and social circle, and the tie has an easy, friendly quality.',
  12: 'This falls in the house of retreat, sleep and letting go: the bond can be spiritual, private or quietly costly, and boundaries matter.',
};

/** Specific overlays that tradition and practice single out. */
const SPECIAL_OVERLAY: Partial<Record<PlanetId, Partial<Record<number, [string, number]>>>> = {
  sun: {
    1: ['The host is drawn to the other\'s confidence, though the Sun here can also overshadow them.', 0],
    7: ['The other person is seen as a strong, central partner figure; pride needs to be shared rather than contested.', 0],
    10: ['A strong career link: the other person can raise the host\'s profile.', 1],
  },
  moon: {
    1: ['Instant emotional familiarity: the host feels understood.', 1],
    4: ['One of the gentlest overlays: the other person feels like home.', 2],
    7: ['The host feels emotionally partnered; moods are shared closely.', 1],
    8: ['Deep emotional exposure: moving, but moods can feel overwhelming.', -1],
    12: ['A soft, private closeness that can drift into worry or secrecy.', 0],
  },
  mars: {
    1: ['Strong attraction and energy, with a quick temper on both sides.', 0],
    4: ['Heat at home: arguments about the household are a common theme.', -1],
    7: ['Passion and rivalry together. Traditionally a sign of heated partnership that needs channelled energy.', -1],
    8: ['Very intense physically and emotionally; tradition treats it with care.', -1],
    10: ['Pushes the host to act on their ambitions.', 1],
    11: ['Gets things done together; supportive drive toward shared goals.', 1],
  },
  mercury: {
    3: ['Easy, constant conversation.', 1],
    5: ['Playful wit and shared learning.', 1],
  },
  jupiter: {
    1: ['The host feels encouraged and protected.', 2],
    5: ['A classic blessing for romance and children.', 2],
    7: ['A protective, wise influence on partnership: one of the best overlays for marriage.', 2],
    9: ['The other person feels like a teacher or source of luck.', 2],
    8: ['Help through crises and shared resources.', 1],
  },
  venus: {
    1: ['The host feels admired and attractive around them.', 2],
    5: ['Romance and fun come easily.', 2],
    7: ['A natural marriage indicator: affection is aimed straight at the partnership.', 2],
    8: ['Strong physical attraction, with jealousy possible.', 0],
    12: ['Tender, private and devoted, sometimes secretive.', 1],
  },
  saturn: {
    1: ['The host may feel judged or weighed down, but also steadied.', -1],
    4: ['Duty around home and family can feel heavy.', -1],
    7: ['A serious, long-lasting tie built on commitment; warmth has to be worked at.', 0],
    8: ['Old fears and slow lessons come up; patience is needed.', -1],
    10: ['Discipline and structure for the host\'s career.', 1],
    11: ['Steady, loyal support for long-term goals.', 1],
  },
  rahu: {
    1: ['Magnetic and unsettling: the host is fascinated but may lose perspective.', -1],
    7: ['A strong, karmic pull toward partnership that can feel fated and confusing at once.', -1],
    10: ['Boosts ambition and worldly drive.', 1],
    11: ['Sudden gains and new networks.', 1],
  },
  ketu: {
    1: ['A sense of having met before, with some emotional distance.', 0],
    7: ['Feels familiar, yet the host may sense the other is never fully present.', -1],
    12: ['A spiritual bond that encourages letting go.', 1],
  },
};

const HOUSE_SCORE: Record<number, number> = { 1: 1, 2: 0, 3: 0, 4: 1, 5: 1, 6: -1, 7: 1, 8: -1, 9: 1, 10: 0, 11: 1, 12: -1 };

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const isBeneficPlanet = (p: PlanetId) => NATURAL_BENEFICS.includes(p);

function overlay(guest: SynastryPerson, host: SynastryPerson, planet: PlanetId): HouseOverlay {
  const pos = guest.chart.planets[planet];
  const house = signDistance(host.chart.ascendantSign, pos.sign);
  const prof = PLANET_PROFILES[planet];
  const houseInfo = HOUSES[house - 1];
  const special = SPECIAL_OVERLAY[planet]?.[house];
  // Benefics soften every house; malefics help upachayas (3, 6, 10, 11) and strain the rest.
  let score = HOUSE_SCORE[house];
  if (isBeneficPlanet(planet)) score += 1;
  else score += [3, 6, 10, 11].includes(house) ? 1 : [1, 4, 7, 8, 12].includes(house) ? -1 : 0;
  if (special) score = special[1];
  score = Math.max(-3, Math.min(3, score));
  const named = (t: string) => t.replace(/\bthe host\b/gi, host.name).replace(/\bthe other person\b/gi, guest.name).replace(/\bthe other\b/gi, guest.name);
  const summary = special ? named(special[0]) : `${guest.name}'s ${prof.name} ${PLANET_GIFT[planet]} to ${host.name}'s ${houseInfo.label}.`;
  return {
    planet,
    house,
    sign: pos.sign,
    title: `${guest.name}'s ${prof.name} in ${host.name}'s ${ordinal(house)} house`,
    summary,
    detail: `${guest.name}'s ${prof.name} sits in ${getSign(pos.sign).name}, which is ${host.name}'s ${ordinal(house)} house (${houseInfo.label}). ${prof.name} ${PLANET_GIFT[planet]}. ${named(HOUSE_FEEL[house])}`,
    tone: toneOf(score),
    score,
  };
}

/* ---------- cross contacts ---------- */

const PERSONAL: PlanetId[] = ['moon', 'venus', 'sun', 'mars'];
const pairKey = (x: PlanetId, y: PlanetId) => [x, y].sort().join('-');

/** Notes for the pairings that matter most between two people. Keyed by sorted pair. */
const PAIR_NOTE: Record<string, [string, number]> = {
  'moon-moon': ['Two moods meet. Shared rhythms make daily life easy; it also means both feel low at the same time.', 1],
  'moon-sun': ['A classic pairing of light and reflection: one gives direction, the other gives feeling. Often a strong sign of mutual understanding.', 2],
  'mars-venus': ['Attraction. Desire and affection meet, which sparks romance and chemistry.', 2],
  'moon-venus': ['Tenderness and affection come easily; this is one of the sweetest contacts.', 2],
  'mars-moon': ['Feelings get stirred quickly. Protective and passionate, but tempers rise around emotional topics.', 0],
  'moon-saturn': ['Loyal and lasting, yet the Moon person can feel restrained or criticised. Patience and reassurance help.', -1],
  'saturn-venus': ['Commitment with reserve. Love grows slowly and stays, but it can feel dutiful at times.', 0],
  'saturn-sun': ['Respect and responsibility, with a risk of one feeling controlled by the other.', -1],
  'jupiter-moon': ['Comforting and generous. The Moon person feels supported and the Jupiter person feels appreciated.', 2],
  'jupiter-venus': ['Warmth, generosity and shared enjoyment; a lucky and gentle contact.', 2],
  'jupiter-sun': ['Mutual respect and encouragement; good for growth and shared ideals.', 2],
  'mars-mars': ['Two engines side by side: a lot gets done, and fights are just as energetic.', 0],
  'mars-saturn': ['Stop and go. One pushes, the other brakes, which can frustrate both unless the roles are agreed.', -2],
  'mars-sun': ['Energising and competitive; plenty of spark, some ego clashes.', 0],
  'mercury-mercury': ['Minds meet. Conversation flows, or arguments do, depending on the signs.', 1],
  'mercury-moon': ['Talking about feelings comes naturally.', 1],
  'sun-sun': ['Similar core drives. Easy recognition, though both may want the lead.', 0],
  'venus-venus': ['Shared tastes in beauty, comfort and fun.', 1],
  'moon-rahu': ['Fascination with an edge: the Moon person can feel unsettled or swept up.', -1],
  'rahu-venus': ['Intense, unconventional attraction that can become obsessive.', -1],
  'ketu-moon': ['A strong sense of past familiarity with some emotional distance.', 0],
  'ketu-venus': ['Affection that feels fated yet hard to hold on to.', -1],
  'mars-rahu': ['Restless, risky energy together; exciting and volatile.', -1],
  'rahu-sun': ['Ambition is amplified, along with confusion about who leads.', -1],
  'jupiter-saturn': ['Practical wisdom: a good pairing for building something lasting together.', 1],
};

const ASPECT_NAMES: Record<number, string> = { 3: '3rd-house', 4: '4th-house', 5: '5th-house', 7: '7th-house (opposition)', 8: '8th-house', 9: '9th-house', 10: '10th-house' };

function contactWeight(a: PlanetId, b: PlanetId, kind: ContactKind, orb?: number) {
  let w = (PERSONAL.includes(a) ? 2 : 1) + (PERSONAL.includes(b) ? 2 : 1);
  if (PAIR_NOTE[pairKey(a, b)]) w += 2;
  if (kind === 'conjunction') w += 2 + (orb !== undefined ? Math.max(0, (10 - orb) / 3) : 0);
  if (kind === 'mutual aspect') w += 1;
  return w;
}

function crossContacts(pa: SynastryPerson, pb: SynastryPerson): CrossContact[] {
  const out: CrossContact[] = [];
  for (const a of PLANETS) {
    for (const b of PLANETS) {
      // Rahu and Ketu are always opposite each other; skip the node-to-node duplicates.
      if ((a === 'rahu' || a === 'ketu') && (b === 'rahu' || b === 'ketu')) continue;
      const A = pa.chart.planets[a];
      const B = pb.chart.planets[b];
      const nameA = `${pa.name}'s ${PLANET_PROFILES[a].name}`;
      const nameB = `${pb.name}'s ${PLANET_PROFILES[b].name}`;
      const note = PAIR_NOTE[pairKey(a, b)];
      if (A.sign === B.sign) {
        const gap = Math.abs(A.longitude - B.longitude);
        const orb = Math.min(gap, 360 - gap);
        const nature = isBeneficPlanet(a) && isBeneficPlanet(b) ? 1 : !isBeneficPlanet(a) && !isBeneficPlanet(b) ? -1 : 0;
        const score = note ? note[1] : nature;
        out.push({
          a, b, kind: 'conjunction', from: 'both', orb,
          title: `${nameA} with ${nameB}`,
          text: `Both sit in ${getSign(A.sign).name}, ${orb.toFixed(0)}° apart${orb <= 5 ? ', a close contact that is hard to miss' : ''}. ${note ? note[0] : `${PLANET_PROFILES[a].name}'s ${PLANET_PROFILES[a].essence} meets ${PLANET_PROFILES[b].name}'s ${PLANET_PROFILES[b].essence}.`}`,
          tone: toneOf(score), score, weight: contactWeight(a, b, 'conjunction', orb),
        });
        continue;
      }
      const dAB = signDistance(A.sign, B.sign);
      const dBA = signDistance(B.sign, A.sign);
      const aSees = PLANET_PROFILES[a].aspects.includes(dAB);
      const bSees = PLANET_PROFILES[b].aspects.includes(dBA);
      if (!aSees && !bSees) continue;
      // Only keep aspects that touch at least one personal planet or have a named pairing; the rest is noise.
      if (!note && !PERSONAL.includes(a) && !PERSONAL.includes(b)) continue;
      const kind: ContactKind = aSees && bSees ? 'mutual aspect' : 'aspect';
      const from = aSees && bSees ? 'both' : aSees ? 'a' : 'b';
      const caster = from === 'b' ? b : a;
      const target = from === 'b' ? a : b;
      const base = note ? note[1] : isBeneficPlanet(caster) ? 1 : -1;
      const score = kind === 'mutual aspect' ? base : Math.round(base * 0.7);
      const how = kind === 'mutual aspect'
        ? `${nameA} and ${nameB} look at each other across the chart (${getSign(A.sign).name} and ${getSign(B.sign).name}).`
        : from === 'a'
          ? `${nameA} casts its ${ASPECT_NAMES[dAB] ?? `${ordinal(dAB)}-house`} aspect onto ${nameB}.`
          : `${nameB} casts its ${ASPECT_NAMES[dBA] ?? `${ordinal(dBA)}-house`} aspect onto ${nameA}.`;
      const flavour = note ? note[0] : `${PLANET_PROFILES[caster].name} colours the other person's ${PLANET_PROFILES[target].name}: ${PLANET_PROFILES[caster].essence} is pressed onto ${PLANET_PROFILES[target].essence}.`;
      out.push({
        a, b, kind, from,
        title: `${nameA} ${kind === 'mutual aspect' ? 'and' : from === 'a' ? 'aspects' : 'is aspected by'} ${nameB}`,
        text: `${how} ${flavour}`,
        tone: toneOf(score), score, weight: contactWeight(a, b, kind),
      });
    }
  }
  return out.sort((x, y) => y.weight - x.weight || (x.orb ?? 99) - (y.orb ?? 99));
}

/* ---------- Moon and Lagna sign distances ---------- */

const RELATION: Record<number, [string, string, Tone]> = {
  1: ['Same sign', 'You share the same sign here, so instincts and reactions are alike. Easy recognition, with a risk of the same blind spots.', 'benefic'],
  2: ['2/12', 'Adjacent signs. Tradition treats 2/12 as a pairing where one supports and the other spends; it can strain money or feel slightly out of step.', 'challenging'],
  3: ['3/11', 'A sociable, friendly pairing: you encourage each other\'s plans and enjoy doing things together.', 'benefic'],
  4: ['4/10', 'One person brings comfort, the other brings direction. Mostly constructive, with occasional clashes over priorities at home and work.', 'mixed'],
  5: ['5/9', 'A trine: one of the most harmonious relationships. Shared values, affection and good fortune together.', 'benefic'],
  6: ['6/8', 'Tradition is wary of 6/8: different emotional languages and hidden friction. It asks for patience and good communication.', 'challenging'],
  7: ['7/7', 'Opposite signs: strong attraction and complementary strengths. Opposites can complete each other or pull apart.', 'mixed'],
};

function relation(fromSign: number, toSign: number, what: 'Moon' | 'Lagna'): SignRelation {
  const count = signDistance(fromSign, toSign);
  const key = count <= 7 ? count : 14 - count;
  const [pair, text, tone] = RELATION[key];
  return {
    count,
    pair,
    title: `${what} signs: ${getSign(fromSign).name} and ${getSign(toSign).name} (${pair})`,
    text: what === 'Moon' ? `${text} The Moon shows the emotional fit, so this is felt in everyday moods.` : `${text} The Lagna shows temperament and life direction, so this is felt in how you approach the world together.`,
    tone,
  };
}

/* ---------- report ---------- */

export function synastry(pa: SynastryPerson, pb: SynastryPerson): SynastryReport {
  const bInA = PLANETS.map((p) => overlay(pb, pa, p));
  const aInB = PLANETS.map((p) => overlay(pa, pb, p));
  const contacts = crossContacts(pa, pb);
  const moon = relation(pa.chart.planets.moon.sign, pb.chart.planets.moon.sign, 'Moon');
  const lagna = relation(pa.chart.ascendantSign, pb.chart.ascendantSign, 'Lagna');

  const highlights: string[] = [];
  highlights.push(`${moon.pair === 'Same sign' ? 'Same Moon sign' : `Moons ${moon.pair}`}: ${moon.tone === 'benefic' ? 'an easy emotional fit' : moon.tone === 'challenging' ? 'emotional rhythms differ and need care' : 'a mixed emotional fit with complementary strengths'}.`);
  const seventh = [...bInA.filter((o) => o.house === 7).map((o) => `${pb.name}'s ${PLANET_PROFILES[o.planet].name}`), ...aInB.filter((o) => o.house === 7).map((o) => `${pa.name}'s ${PLANET_PROFILES[o.planet].name}`)];
  if (seventh.length) highlights.push(`On the partnership house: ${seventh.join(', ')}.`);
  const tight = contacts.filter((c) => c.kind === 'conjunction' && (c.orb ?? 99) <= 5).slice(0, 3);
  for (const c of tight) highlights.push(`Close conjunction: ${c.title} (${c.orb!.toFixed(0)}°).`);
  const best = [...bInA, ...aInB].filter((o) => o.score >= 2).slice(0, 2);
  for (const o of best) highlights.push(`Supportive: ${o.title}.`);
  const hard = [...bInA, ...aInB].filter((o) => o.score <= -1).sort((x, y) => x.score - y.score).slice(0, 2);
  for (const o of hard) highlights.push(`Needs care: ${o.title}.`);

  const toneValue = (t: Tone) => (t === 'benefic' ? 1 : t === 'challenging' ? -1 : 0);
  const raw =
    [...bInA, ...aInB].reduce((s, o) => s + o.score, 0) / 6 +
    contacts.slice(0, 12).reduce((s, c) => s + c.score, 0) / 4 +
    toneValue(moon.tone) * 2 +
    toneValue(lagna.tone);
  const balance = Math.max(-10, Math.min(10, Math.round(raw)));

  return { a: pa.name, b: pb.name, bInA, aInB, contacts, moon, lagna, highlights, balance };
}
