/**
 * "Today for you": one screen with the day's tithi, the Moon's star, Tara
 * bala from your birth star, whether it is Chandrashtama, and one line for
 * the Moon. Uses the same rules as the muhurta finder in @vedic/engine.
 */
import type { Chart, Engine } from '@vedic/engine';
import { TITHI_NAMES } from '@vedic/engine';
import { houseFrom, ordinal, nakshatraOf, NAKSHATRA_NAMES, norm360, signOf, SIGN_NAMES } from './util';

export const TARA_NAMES = ['Janma', 'Sampat', 'Vipat', 'Kshema', 'Pratyari', 'Sadhaka', 'Naidhana', 'Mitra', 'Parama Mitra'] as const;

export type TaraQuality = 'good' | 'mixed' | 'hard';

/** Tara (1–9) of `dayNakshatra` counted from the birth star, both 1–27. */
export function tarabala(birthNakshatra: number, dayNakshatra: number): { number: number; name: string; quality: TaraQuality; text: string } {
  const n = ((dayNakshatra - birthNakshatra + 27) % 27) % 9 + 1;
  const name = TARA_NAMES[n - 1];
  if ([2, 4, 6, 8, 9].includes(n)) return { number: n, name, quality: 'good', text: `${name} tara, the ${ordinal(n)} from your birth star: a supportive day.` };
  if (n === 1) return { number: n, name, quality: 'mixed', text: 'Janma tara: the Moon is back in your birth star. Sensitive and personal, good for rest and reflection.' };
  if (n === 7) return { number: n, name, quality: 'hard', text: 'Naidhana tara, the 7th from your birth star and the hardest of the nine. Keep it simple.' };
  return { number: n, name, quality: 'hard', text: `${name} tara, the ${ordinal(n)} from your birth star: things tend to snag. Allow extra time.` };
}

/** Tithi (1–30) from the Moon–Sun elongation, with its name and paksha. */
export function tithiOf(sunLon: number, moonLon: number): { number: number; name: string; paksha: 'shukla' | 'krishna'; fraction: number } {
  const e = norm360(moonLon - sunLon);
  const number = Math.floor(e / 12) + 1;
  const paksha = number <= 15 ? 'shukla' : 'krishna';
  const name = number === 15 ? 'Purnima' : number === 30 ? 'Amavasya' : TITHI_NAMES[(number - 1) % 15];
  return { number, name, paksha, fraction: (e % 12) / 12 };
}

/** One plain line for the Moon's house counted from the birth Moon. */
export const MOON_LINES: Record<number, string> = {
  1: 'The Moon is over your birth Moon: feelings run close to the surface. Look after yourself first.',
  2: 'The Moon moves through your 2nd from the Moon: money, food and family talk. Spend with care.',
  3: 'The Moon in your 3rd: courage and short trips go well. Send the message you have been drafting.',
  4: 'The Moon in your 4th: home and mother are on your mind. A quiet evening suits you.',
  5: 'The Moon in your 5th: play, children and ideas. Make something for the joy of it.',
  6: 'The Moon in your 6th: a good day to clear tasks and beat a rival at their own game.',
  7: 'The Moon in your 7th: partners and other people take the lead. Listen more than you speak.',
  8: 'The Moon in your 8th: Chandrashtama. Moods dip and plans wobble. Do not start anything big today.',
  9: 'The Moon in your 9th: luck, teachers and faith. Ask an elder for advice.',
  10: 'The Moon in your 10th: you are seen at work. Put your name on something.',
  11: 'The Moon in your 11th: gains and friends. Say yes to the invitation.',
  12: 'The Moon in your 12th: tiredness and spending. Sleep early and let things go.',
};

export interface TodayBrief {
  at: string;
  tithi: ReturnType<typeof tithiOf>;
  /** Transit Moon now. */
  moon: { longitude: number; sign: number; signName: string; nakshatra: number; nakshatraName: string; houseFromMoon: number; speed: number };
  tara: ReturnType<typeof tarabala>;
  chandrashtama: { active: boolean; /** when the Moon leaves the 8th, ISO, if active */ endsAt?: string; /** when it next begins, ISO, if not active */ nextAt?: string };
  /** One line for the Moon. */
  moonLine: string;
  /** Overall feel of the day from tara and chandrashtama. */
  overall: 'good' | 'mixed' | 'careful';
  headline: string;
}

/** Hours for the Moon to move `deg` degrees at its current speed (it moves ~13°/day). */
const hoursFor = (deg: number, speed: number) => (deg / Math.max(11, speed)) * 24;

export function todayBrief(engine: Engine, natal: Chart, at: Date = new Date()): TodayBrief {
  const opts = { ayanamsa: natal.meta.ayanamsa, nodeType: natal.meta.nodeType };
  const snap = engine.positionsAt(at, opts);
  const sun = snap.planets.sun.longitude;
  const m = snap.planets.moon;
  const natalMoon = natal.planets.moon;
  const moonSign = signOf(m.longitude);
  const houseFromMoon = houseFrom(natalMoon.sign, moonSign);
  const nak = nakshatraOf(m.longitude);
  const tara = tarabala(natalMoon.nakshatra, nak);
  const active = houseFromMoon === 8;
  const chandrashtama: TodayBrief['chandrashtama'] = { active };
  if (active) {
    const left = 30 - (norm360(m.longitude) % 30);
    chandrashtama.endsAt = new Date(at.getTime() + hoursFor(left, m.speed) * 3_600_000).toISOString();
  } else {
    const target = ((natalMoon.sign + 6) % 12) * 30; // start of the 8th sign from the birth Moon
    const ahead = norm360(target - m.longitude);
    chandrashtama.nextAt = new Date(at.getTime() + hoursFor(ahead, m.speed) * 3_600_000).toISOString();
  }
  const overall: TodayBrief['overall'] = active || tara.number === 7 ? 'careful' : tara.quality === 'good' ? 'good' : 'mixed';
  const tithi = tithiOf(sun, m.longitude);
  const headline = overall === 'good'
    ? 'A supportive day for you. Start things.'
    : overall === 'careful'
      ? 'A day to go gently. Finish things rather than start them.'
      : 'An ordinary day. Steady effort pays.';
  return {
    at: at.toISOString(),
    tithi,
    moon: { longitude: m.longitude, sign: moonSign, signName: SIGN_NAMES[moonSign - 1], nakshatra: nak, nakshatraName: NAKSHATRA_NAMES[nak - 1], houseFromMoon, speed: m.speed },
    tara,
    chandrashtama,
    moonLine: MOON_LINES[houseFromMoon],
    overall,
    headline,
  };
}
