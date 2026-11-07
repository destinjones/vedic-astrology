/**
 * Float precision policy for angles.
 *
 *  1. Degrees are stored and computed at full float precision. Rounding happens
 *     only at the edges: display, serialisation, hashing and golden files.
 *  2. The edge precision is DEGREE_DECIMALS = 4 decimals (0.0001° ≈ 0.36″),
 *     well inside the accuracy of the ephemeris and of any birth time.
 *  3. Never compare two degrees with `===`. Two computations of the same point
 *     can differ in the last bits. Use `sameDegree(a, b)`, which also treats
 *     359.99995° and 0.00004° as the same point.
 *  4. Sign, nakshatra and varga boundaries are decided on the unrounded value,
 *     so a planet at 29.99999° stays in its sign even though it prints as 30.0000.
 *
 * `npm test` enforces rule 3 with a source scan (test/precision.test.ts).
 */

/** Decimals kept when a degree leaves the engine for display, URLs or fixtures. */
export const DEGREE_DECIMALS = 4;

/** Default tolerance for `sameDegree`: one unit in the last kept decimal. */
export const DEGREE_EPSILON = 10 ** -DEGREE_DECIMALS;

/** Round to the policy precision. Returns -0 as 0 so JSON output is stable. */
export function roundDegree(deg: number, decimals: number = DEGREE_DECIMALS): number {
  const f = 10 ** decimals;
  const r = Math.round(deg * f) / f;
  return r === 0 ? 0 : r;
}

/** Normalise to [0, 360), with a value that rounds to 360 folded to 0. */
export function normDegree(deg: number): number {
  const r = ((deg % 360) + 360) % 360;
  return r >= 360 ? 0 : r;
}

/** Shortest signed difference b − a on the circle, in (−180, 180]. */
export function degreeDelta(a: number, b: number): number {
  let d = normDegree(b - a);
  if (d > 180) d -= 360;
  return d;
}

/** True when two angles are within `eps` degrees of each other on the circle. */
export function sameDegree(a: number, b: number, eps: number = DEGREE_EPSILON): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(degreeDelta(a, b)) <= eps;
}

/** The difference in arcminutes, signed, for "compare against another program". */
export const arcminutesBetween = (a: number, b: number): number => degreeDelta(a, b) * 60;
