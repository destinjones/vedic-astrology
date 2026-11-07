/**
 * The sixty shashtiamsas (D60 parts of 0°30') with the names and natures given
 * in BPHS ch. 6. In odd signs they run 1 → 60, in even signs 60 → 1. The D60
 * ascendant changes about every two minutes of clock time, which is why it is
 * the last word in fine rectification.
 */
const NAMES: [string, 'benefic' | 'malefic'][] = [
  ['Ghora', 'malefic'], ['Rakshasa', 'malefic'], ['Deva', 'benefic'], ['Kubera', 'benefic'], ['Yaksha', 'benefic'],
  ['Kinnara', 'benefic'], ['Bhrashta', 'malefic'], ['Kulaghna', 'malefic'], ['Garala', 'malefic'], ['Vahni', 'malefic'],
  ['Maya', 'malefic'], ['Purishaka', 'malefic'], ['Apampati', 'benefic'], ['Marutvan', 'benefic'], ['Kala', 'malefic'],
  ['Sarpa', 'malefic'], ['Amrita', 'benefic'], ['Indu', 'benefic'], ['Mridu', 'benefic'], ['Komala', 'benefic'],
  ['Heramba', 'benefic'], ['Brahma', 'benefic'], ['Vishnu', 'benefic'], ['Maheshvara', 'benefic'], ['Deva', 'benefic'],
  ['Ardra', 'benefic'], ['Kalinasha', 'benefic'], ['Kshitisha', 'benefic'], ['Kamalakara', 'benefic'], ['Gulika', 'malefic'],
  ['Mrityu', 'malefic'], ['Kala', 'malefic'], ['Davagni', 'malefic'], ['Ghora', 'malefic'], ['Yama', 'malefic'],
  ['Kantaka', 'malefic'], ['Sudha', 'benefic'], ['Amrita', 'benefic'], ['Purnachandra', 'benefic'], ['Vishadagdha', 'malefic'],
  ['Kulanasha', 'malefic'], ['Vamshakshaya', 'malefic'], ['Utpata', 'malefic'], ['Kala', 'malefic'], ['Saumya', 'benefic'],
  ['Komala', 'benefic'], ['Shitala', 'benefic'], ['Karaladamshtra', 'malefic'], ['Chandramukhi', 'benefic'], ['Pravina', 'benefic'],
  ['Kalapavaka', 'malefic'], ['Dandayudha', 'malefic'], ['Nirmala', 'benefic'], ['Saumya', 'benefic'], ['Krura', 'malefic'],
  ['Atishitala', 'benefic'], ['Amrita', 'benefic'], ['Payodhi', 'benefic'], ['Bhramana', 'malefic'], ['Chandrarekha', 'benefic'],
];

export interface Shashtiamsa {
  /** 1–60 in the order of BPHS (already reversed for even signs) */
  index: number;
  name: string;
  nature: 'benefic' | 'malefic';
}

export function shashtiamsaOf(longitude: number): Shashtiamsa {
  const l = ((longitude % 360) + 360) % 360;
  const sign = Math.floor(l / 30) + 1;
  const part = Math.min(59, Math.floor((l % 30) * 2));
  const index = sign % 2 === 1 ? part + 1 : 60 - part;
  const [name, nature] = NAMES[index - 1];
  return { index, name, nature };
}
