import type { PlanetId } from './chart';

export type Selection =
  | { kind: 'planet'; id: PlanetId }
  | { kind: 'house'; num: number }
  | { kind: 'nakshatra'; num: number }
  | { kind: 'asc' };

export type ChartStyle = 'north' | 'south';
