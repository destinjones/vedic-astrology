/**
 * Notes pinned to a house or a planet of the open chart. They live on the tab
 * (so they are backed up and restored with it) and can be drawn into an export.
 */
import type { Chart, PlanetId, VargaChart } from '../types/chart';

export type AnnotationTarget = { kind: 'house'; num: number } | { kind: 'planet'; id: PlanetId };

export interface Annotation {
  id: string;
  target: AnnotationTarget;
  /** Optional short heading, e.g. "Career". */
  title?: string;
  text: string;
  /** ISO date-time the note was written or last changed */
  at: string;
}

const PLANETS: PlanetId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];
export const MAX_ANNOTATIONS = 60;

export const newAnnotationId = () => `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** The house a note belongs in, in the chart being drawn (a planet's note follows it into each varga). */
export function annotationHouse(a: Annotation, chart: Chart, v: VargaChart): number | null {
  if (a.target.kind === 'house') return a.target.num;
  return v.planets[a.target.id]?.house ?? chart.planets.find((p) => p.id === (a.target as { id: PlanetId }).id)?.house ?? null;
}

/** Reads stored or imported notes, dropping anything that is not one. */
export function parseAnnotations(raw: unknown): Annotation[] {
  if (!Array.isArray(raw)) return [];
  const out: Annotation[] = [];
  for (const e of raw.slice(0, MAX_ANNOTATIONS)) {
    if (!e || typeof e !== 'object') continue;
    const r = e as Record<string, unknown>;
    const t = r.target as Record<string, unknown> | undefined;
    if (typeof r.text !== 'string' || !r.text.trim() || !t) continue;
    let target: AnnotationTarget | null = null;
    if (t.kind === 'house' && Number.isInteger(t.num) && (t.num as number) >= 1 && (t.num as number) <= 12) target = { kind: 'house', num: t.num as number };
    if (t.kind === 'planet' && PLANETS.includes(t.id as PlanetId)) target = { kind: 'planet', id: t.id as PlanetId };
    if (!target) continue;
    out.push({
      id: typeof r.id === 'string' && r.id ? r.id.slice(0, 64) : newAnnotationId(),
      target,
      title: typeof r.title === 'string' && r.title.trim() ? r.title.slice(0, 80) : undefined,
      text: r.text.slice(0, 2000),
      at: typeof r.at === 'string' && !Number.isNaN(Date.parse(r.at)) ? r.at : new Date().toISOString(),
    });
  }
  return out;
}
