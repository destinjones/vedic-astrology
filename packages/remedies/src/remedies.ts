import { addSigns, dashaAt, vargaSign, type Chart, type GrahaId } from '@vedic/engine';
import { aspectsPlanet, dignityOf, fromEngineChart, houseOf, housesRuledBy, signDistance, type ChartInput } from '@vedic/interpretations';
import { jaimini, jaiminiLord } from '@vedic/jaimini';
import { ISHTA_DEITY, REMEDY_SETS } from './data';
import type {
  AfflictionFactor,
  FunctionalNature,
  GemAdvice,
  GrahaRemedy,
  IshtaDevata,
  RemedyKind,
  RemedyOptions,
  RemedyReport,
  Severity,
} from './types';

export const GRAHAS: GrahaId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];
const MALEFICS: GrahaId[] = ['sun', 'mars', 'saturn', 'rahu', 'ketu'];
const NODES: GrahaId[] = ['rahu', 'ketu'];
const SIGN_NAMES = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const name = (g: GrahaId) => REMEDY_SETS[g].name;
const ord = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
const listText = (n: string[]) => (n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`);

export const severityOf = (score: number, threshold = 2): Severity =>
  score < threshold ? 'none' : score < 4 ? 'mild' : score < 6 ? 'moderate' : 'strong';

/**
 * The classical afflictions a practitioner checks before prescribing, scored.
 * Houses are whole sign from the lagna, as for yogas.
 */
export function afflictionFactors(chart: Chart, g: GrahaId, input: ChartInput = fromEngineChart(chart)): AfflictionFactor[] {
  const f: AfflictionFactor[] = [];
  const p = input.planets[g];
  const sign = SIGN_NAMES[p.sign - 1];
  const others = GRAHAS.filter((o) => o !== g);
  const dignity = dignityOf(input, g);
  const house = houseOf(input, g);

  if (dignity === 'debilitated') f.push({ id: 'debilitated', weight: 3, reason: `${name(g)} is debilitated in ${sign}. Check the yogas for a neecha bhanga, which can cancel it.` });
  else if (dignity === 'great_enemy') f.push({ id: 'enemy_sign', weight: 2, reason: `${name(g)} sits in ${sign}, the sign of a bitter enemy.` });
  else if (dignity === 'enemy') f.push({ id: 'enemy_sign', weight: 1, reason: `${name(g)} sits in ${sign}, an enemy's sign.` });

  if (p.combust) f.push({ id: 'combust', weight: 2, reason: `${name(g)} is combust, too close to the Sun to act freely.` });

  if ([6, 8, 12].includes(house)) f.push({ id: 'dusthana', weight: 1, reason: `${name(g)} is in the ${ord(house)} house, one of the three difficult houses.` });

  // The Sun's closeness is judged as combustion; a node with a luminary is judged as an eclipse below.
  const luminary = g === 'sun' || g === 'moon';
  const withMalefics = others.filter((o) => MALEFICS.includes(o) && o !== 'sun' && input.planets[o].sign === p.sign && !(NODES.includes(o) && (luminary || NODES.includes(g))));
  if (withMalefics.length) f.push({ id: 'malefic_conjunction', weight: Math.min(2, withMalefics.length), reason: `${name(g)} shares its sign with ${listText(withMalefics.map(name))}.` });

  const aspecting = (['mars', 'saturn'] as GrahaId[]).filter((o) => o !== g && input.planets[o].sign !== p.sign && aspectsPlanet(input, o, g));
  if (aspecting.length) f.push({ id: 'malefic_aspect', weight: aspecting.length, reason: `${listText(aspecting.map(name))} ${aspecting.length > 1 ? 'aspect' : 'aspects'} ${name(g)}.` });

  const at = (d: number) => others.filter((o) => MALEFICS.includes(o) && signDistance(p.sign, input.planets[o].sign) === d && !(NODES.includes(g) && NODES.includes(o)));
  const before = at(12), after = at(2);
  if (before.length && after.length) f.push({ id: 'papakartari', weight: 1, reason: `${name(g)} is hemmed in (papakartari): ${listText(before.map(name))} in the sign behind and ${listText(after.map(name))} in the sign ahead.` });

  if (luminary) {
    const node = NODES.find((n) => input.planets[n].sign === p.sign);
    if (node) f.push({ id: 'eclipsed_luminary', weight: 2, reason: `The ${name(g)} is joined by ${name(node)}, the classical grahan (eclipse) combination.` });
  }
  if (g === 'moon') {
    const elong = (((p.longitude - input.planets.sun.longitude) % 360) + 360) % 360;
    if (elong > 288 || elong < 72) f.push({ id: 'weak_moon', weight: 1, reason: `The Moon is within 72° of the Sun (${Math.round(elong > 180 ? 360 - elong : elong)}°), so it is dark and gives less light to the mind.` });
  }

  const sb = (chart.strength?.shadbala.planets as Partial<Record<GrahaId, { strong: boolean; ratio: number; war?: { with: GrahaId; won: boolean } }>> | undefined)?.[g];
  if (sb?.war && !sb.war.won) f.push({ id: 'lost_war', weight: 2, reason: `${name(g)} loses a planetary war (graha yuddha) with ${name(sb.war.with)}.` });
  if (sb && !sb.strong) f.push({ id: 'low_shadbala', weight: 1, reason: `${name(g)}'s Shadbala is ${Math.round(sb.ratio * 100)}% of the classical minimum.` });

  // Mitigations
  if (dignity === 'exalted' || dignity === 'moolatrikona' || dignity === 'own') {
    const word = dignity === 'own' ? 'in its own sign' : dignity === 'exalted' ? 'exalted' : 'in its moolatrikona';
    f.push({ id: 'strong_dignity', weight: -2, reason: `${name(g)} is ${word}, which steadies it.` });
  }
  if (g !== 'jupiter' && (input.planets.jupiter.sign === p.sign || aspectsPlanet(input, 'jupiter', g))) {
    f.push({ id: 'jupiter_support', weight: -1, reason: `Jupiter ${input.planets.jupiter.sign === p.sign ? 'joins' : 'aspects'} ${name(g)} and softens the harm.` });
  }
  return f;
}

/** Functional nature from lordship (BPHS): trikona lords good; 3rd, 6th, 8th, 11th lords not. */
export function functionalNature(input: ChartInput, g: GrahaId): { nature: FunctionalNature; rules: number[] } {
  if (NODES.includes(g)) return { nature: 'node', rules: [] };
  const rules = housesRuledBy(input, g);
  if (rules.some((h) => h === 1 || h === 5 || h === 9)) return { nature: 'benefic', rules };
  // BPHS: the Sun and Moon carry no blemish for owning the 8th.
  const bad = rules.filter((h) => h === 3 || h === 6 || h === 11 || (h === 8 && g !== 'sun' && g !== 'moon'));
  return { nature: bad.length ? 'malefic' : 'neutral', rules };
}

function gemAdvice(g: GrahaId, nature: FunctionalNature, rules: number[], afflicted: boolean): { advice: GemAdvice; reason: string } {
  const gem = REMEDY_SETS[g].gem.name.toLowerCase();
  const ruled = rules.length ? `the ${listText(rules.map(ord))}` : '';
  if (nature === 'node') return { advice: 'caution', reason: `A ${gem} strengthens ${name(g)}, which rules no house and acts through the signs it touches. Most practitioners only advise it after reading the whole chart, and some try it for a few days first.` };
  if (nature === 'malefic') return { advice: 'avoid', reason: `${name(g)} rules ${ruled} for your lagna. A gem makes a planet stronger, and that includes the troubles of those houses, so pacify it with mantra and charity instead.` };
  if (nature === 'benefic') return { advice: 'consider', reason: `${name(g)} rules ${ruled} for your lagna, so strengthening it is classically safe${afflicted ? ' and is the usual answer to its weakness' : ''}. Have a practitioner confirm before buying.` };
  return { advice: 'caution', reason: `${name(g)} rules ${ruled} for your lagna, which is neither clearly good nor bad. Prefer mantra and charity unless a practitioner advises the gem.` };
}

function priorityOf(afflicted: boolean, gem: GemAdvice): RemedyKind[] {
  if (!afflicted) return gem === 'consider' ? ['practice', 'mantra', 'gem'] : ['practice', 'mantra'];
  return gem === 'consider' ? ['mantra', 'gem', 'charity', 'practice', 'fast', 'yantra'] : ['mantra', 'charity', 'practice', 'fast', 'yantra'];
}

/** Ishta devata from the 12th sign from the Karakamsa, read in the navamsa. */
export function ishtaDevata(chart: Chart, opts: Pick<RemedyOptions, 'karakaScheme'> = {}): IshtaDevata {
  const j = jaimini(chart, { karakaScheme: opts.karakaScheme ?? 8 });
  const ak = j.karakas[0].planet;
  const twelfth = addSigns(j.karakamsa, 11);
  const occupants = GRAHAS.filter((g) => vargaSign(j.input.planets[g], 9) === twelfth);
  const sb = chart.strength?.shadbala.planets as Partial<Record<GrahaId, { ratio: number }>> | undefined;
  // With several occupants the stronger one leads; the nodes have no Shadbala and go last.
  const ranked = [...occupants].sort((a, b) => (sb?.[b]?.ratio ?? (NODES.includes(b) ? -1 : 0)) - (sb?.[a]?.ratio ?? (NODES.includes(a) ? -1 : 0)));
  const basis = ranked.length ? 'occupant' : 'lord';
  const significator = ranked[0] ?? jaiminiLord(j.input, twelfth).lord;
  const d = ISHTA_DEITY[significator];
  const kms = SIGN_NAMES[j.karakamsa - 1], tw = SIGN_NAMES[twelfth - 1];
  const explanation = [
    `Your Atmakaraka is ${name(ak)}, and it sits in ${kms} in the navamsa, so ${kms} is your Karakamsa. The 12th sign from it, ${tw}, is read for the deity the soul turns to.`,
    basis === 'occupant'
      ? occupants.length > 1
        ? `${listText(occupants.map(name))} occupy ${tw} in the navamsa. ${name(significator)} is the stronger, so it names the ishta devata; the others colour the practice.`
        : `${name(significator)} occupies ${tw} in the navamsa, so it names the ishta devata.`
      : `No graha occupies ${tw} in the navamsa, so its lord ${name(significator)} speaks for it. Some teachers use a graha aspecting the sign instead.`,
    `${name(significator)} points to ${d.deity}. BPHS also links ${name(significator)} to ${d.avatar}, the avatar of Vishnu many Vaishnavas worship in its place.`,
    `The Karakamsa moves with the Atmakaraka's navamsa, which changes every 3°20′. If your birth time is uncertain by more than a few minutes, treat this as a suggestion and let your own devotion lead.`,
  ];
  return {
    karakamsa: j.karakamsa,
    twelfth,
    occupants,
    significator,
    basis,
    deity: d.deity,
    avatar: d.avatar,
    alternatives: d.alternatives,
    others: ranked.slice(1).map((g) => ({ graha: g, deity: ISHTA_DEITY[g].deity })),
    atmakaraka: ak,
    explanation,
    cite: [{ source: 'bphs_karakamsa' }, { source: 'jaimini_sutras' }, { source: 'bphs_avatara' }],
  };
}

export const DISCLAIMERS = [
  'These are the remedies the tradition prescribes, shown for study and reflection. They are not medical, psychological, legal or financial advice, and no remedy guarantees an outcome.',
  'Do not fast if you are pregnant, diabetic, underweight or on medication without asking your doctor first. A lighter meal kept with intent is the traditional fallback.',
  'Gemstones are costly and the trade is full of treated and fake stones. Never buy under pressure or from someone who has just read your chart, and get a lab certificate for any natural stone.',
  'Give to charity within your means. The tradition values the attitude of the gift, not its size.',
  'Lineages differ on mantras, counts, days and gems. If you have a teacher, follow their version over this one.',
];

/** Remedies for every graha, flagged and ordered by affliction, plus the Ishta devata. */
export function remedies(chart: Chart, opts: RemedyOptions = {}): RemedyReport {
  const input = fromEngineChart(chart);
  const threshold = opts.threshold ?? 2;
  const running = chart.dasha ? dashaAt(chart.dasha, opts.at ?? Date.now()) : [];
  const grahas: GrahaRemedy[] = GRAHAS.map((g) => {
    const factors = afflictionFactors(chart, g, input);
    const score = Math.max(0, factors.reduce((s, x) => s + x.weight, 0));
    const afflicted = score >= threshold;
    const { nature, rules } = functionalNature(input, g);
    const gem = gemAdvice(g, nature, rules, afflicted);
    return {
      graha: g,
      score,
      severity: severityOf(score, threshold),
      afflicted,
      factors,
      functional: nature,
      rules,
      gem,
      runningDasha: running[0]?.lord === g ? 'mahadasha' : running[1]?.lord === g ? 'antardasha' : null,
      priority: priorityOf(afflicted, gem.advice),
      set: REMEDY_SETS[g],
    };
  });
  const rank = (r: GrahaRemedy) => r.score + (r.runningDasha === 'mahadasha' ? 0.6 : r.runningDasha === 'antardasha' ? 0.3 : 0);
  const afflicted = grahas.filter((r) => r.afflicted).sort((a, b) => rank(b) - rank(a));
  return { grahas, afflicted, ishtaDevata: ishtaDevata(chart, opts), disclaimers: DISCLAIMERS };
}
