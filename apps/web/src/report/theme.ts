/** Page geometry and the report's palette: night-blue and gold, like the Blender art, on warm paper. */

export const PAGE = { w: 595.28, h: 841.89 } as const;
export const MARGIN = { left: 58, right: 58, top: 74, bottom: 70 } as const;
export const CONTENT_W = PAGE.w - MARGIN.left - MARGIN.right;

export const C = {
  paper: '#FBF7EF',
  paperDeep: '#F3EBDA',
  ink: '#1B2143',
  body: '#2E3352',
  muted: '#6B6F8A',
  faint: '#A7A39A',
  rule: '#E3D6BC',
  gold: '#B0832F',
  goldLight: '#D8B46A',
  goldPale: '#F1E4C4',
  night: '#0D1232',
  nightSoft: '#1A2150',
  starlight: '#E9E3D3',
  good: '#3E7A5A',
  goodPale: '#E3EFE6',
  bad: '#A8473A',
  badPale: '#F5E2DC',
  mixed: '#8A7448',
  mixedPale: '#F2EAD6',
} as const;

/** Font families registered in fonts.ts. */
export const F = {
  serif: 'CormorantMedium',
  serifBold: 'CormorantSemibold',
  serifItalic: 'CormorantItalic',
  sans: 'InterRegular',
  sansBold: 'InterSemibold',
} as const;
export type FontName = (typeof F)[keyof typeof F];

export const toneColor = (score: number) => (score >= 1 ? C.good : score <= -1 ? C.bad : C.mixed);
export const tonePale = (score: number) => (score >= 1 ? C.goodPale : score <= -1 ? C.badPale : C.mixedPale);

/** Roman numerals for chapter numbers. */
export function roman(n: number): string {
  const m: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of m) while (n >= v) { out += s; n -= v; }
  return out;
}
