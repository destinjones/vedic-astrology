/**
 * The ayanamsa at the API boundary.
 *
 * `AyanamsaId` is a string union, which TypeScript checks at compile time but a
 * URL, a saved profile or a JSON file cannot. Anything that arrives as text goes
 * through `parseAyanamsa` (throws) or `toAyanamsa` (falls back) before it reaches
 * the engine, so a typo is an error and not a chart quietly cast in Lahiri.
 *
 * `Ayanamsa.Lahiri` etc. give callers named constants instead of bare strings.
 * The values are the same strings, so existing code that passes 'lahiri' still
 * type-checks.
 */
import type { AyanamsaId } from './types';

export const Ayanamsa = Object.freeze({
  Lahiri: 'lahiri',
  Raman: 'raman',
  Krishnamurti: 'krishnamurti',
  FaganBradley: 'fagan_bradley',
  Yukteshwar: 'yukteshwar',
  JnBhasin: 'jn_bhasin',
  TrueChitra: 'true_chitra',
  TrueRevati: 'true_revati',
  TruePushya: 'true_pushya',
  TrueMula: 'true_mula',
  Suryasiddhanta: 'suryasiddhanta',
  Aryabhata: 'aryabhata',
  Ushashashi: 'ushashashi',
  GalacticCenterMula: 'galactic_center_mula',
} as const satisfies Record<string, AyanamsaId>);

export type AyanamsaName = keyof typeof Ayanamsa;

/** Every supported ayanamsa id, in a fixed order. */
export const AYANAMSA_IDS: readonly AyanamsaId[] = Object.freeze(Object.values(Ayanamsa));

/** The project default (Chitrapaksha / Lahiri). */
export const DEFAULT_AYANAMSA: AyanamsaId = Ayanamsa.Lahiri;

const ID_SET: ReadonlySet<string> = new Set(AYANAMSA_IDS);

export const isAyanamsaId = (v: unknown): v is AyanamsaId => typeof v === 'string' && ID_SET.has(v);

export class UnknownAyanamsaError extends Error {
  readonly value: unknown;
  constructor(value: unknown) {
    super(`Unknown ayanamsa ${JSON.stringify(value)}. Expected one of: ${AYANAMSA_IDS.join(', ')}`);
    this.name = 'UnknownAyanamsaError';
    this.value = value;
  }
}

/** Strict: returns the id or throws UnknownAyanamsaError. Accepts any case. */
export function parseAyanamsa(v: unknown): AyanamsaId {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : v;
  if (isAyanamsaId(s)) return s;
  throw new UnknownAyanamsaError(v);
}

/** Lenient: returns the id, or `fallback` for anything missing or unknown. */
export function toAyanamsa(v: unknown, fallback: AyanamsaId = DEFAULT_AYANAMSA): AyanamsaId {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : v;
  return isAyanamsaId(s) ? s : fallback;
}
