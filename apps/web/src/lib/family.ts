/**
 * Family links between saved charts. A link joins two saved profiles (by their
 * id in lib/profiles.ts) with a relation, read from the first person's side:
 * { fromId: Asha, toId: Riya, relation: 'child' } means Riya is Asha's child.
 * Each pair is stored once; the other side's view is worked out with
 * inverseRelation(). Profiles themselves are never changed. Browser-only.
 */
export type Relation = 'spouse' | 'child' | 'father' | 'mother' | 'parent' | 'sibling' | 'other';

export const RELATIONS: Relation[] = ['spouse', 'child', 'father', 'mother', 'parent', 'sibling', 'other'];

export const RELATION_LABEL: Record<Relation, string> = {
  spouse: 'Spouse', child: 'Child', father: 'Father', mother: 'Mother', parent: 'Parent', sibling: 'Sibling', other: 'Other relative',
};

export interface FamilyLink {
  id: string;
  fromId: string;
  toId: string;
  relation: Relation;
  /** Optional words of the astrologer's own, e.g. "elder daughter". */
  note?: string;
  updatedAt: string;
}

/** One relative as seen from a chosen person. */
export interface Relative {
  link: FamilyLink;
  profileId: string;
  /** The relative's relation to the person in focus. */
  relation: Relation;
}

export const FAMILY_KEY = 'vedic.family.v1';
const MAX_LINKS = 500;

/** How the other person sees the link. A child's parent is just "parent": the app does not know the gender. */
export function inverseRelation(r: Relation): Relation {
  switch (r) {
    case 'child': return 'parent';
    case 'father': case 'mother': case 'parent': return 'child';
    default: return r;
  }
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Clean links from any JSON; drops broken entries, self links and repeated pairs (the newer edit wins). */
export function parseLinks(data: unknown): FamilyLink[] {
  const list = Array.isArray(data) ? data : data && typeof data === 'object' && Array.isArray((data as { links?: unknown }).links) ? (data as { links: unknown[] }).links : [];
  const byPair = new Map<string, FamilyLink>();
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const fromId = typeof r.fromId === 'string' ? r.fromId.slice(0, 64) : '';
    const toId = typeof r.toId === 'string' ? r.toId.slice(0, 64) : '';
    const relation = RELATIONS.find((x) => x === r.relation);
    if (!fromId || !toId || fromId === toId || !relation) continue;
    const link: FamilyLink = {
      id: typeof r.id === 'string' && r.id ? r.id.slice(0, 64) : newId(),
      fromId, toId, relation,
      ...(typeof r.note === 'string' && r.note.trim() ? { note: r.note.trim().slice(0, 80) } : {}),
      updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : new Date(0).toISOString(),
    };
    const key = pairKey(fromId, toId);
    const had = byPair.get(key);
    if (!had || link.updatedAt > had.updatedAt) byPair.set(key, link);
  }
  return [...byPair.values()].slice(0, MAX_LINKS);
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function loadLinks(): FamilyLink[] {
  try { return parseLinks(JSON.parse(localStorage.getItem(FAMILY_KEY) ?? '[]')); } catch { return []; }
}

/** Writes the list; returns false when the browser refuses (private mode, storage full). */
export function storeLinks(list: FamilyLink[]): boolean {
  try { localStorage.setItem(FAMILY_KEY, JSON.stringify(list)); return true; } catch { return false; }
}

/**
 * Links two people, read as "`toId` is `fromId`'s `relation`". A pair that is
 * already linked (either way round) is replaced rather than duplicated.
 */
export function linkPeople(list: FamilyLink[], fromId: string, toId: string, relation: Relation, note?: string, now = new Date().toISOString()): FamilyLink[] {
  if (fromId === toId) return list;
  const key = pairKey(fromId, toId);
  const old = list.find((l) => pairKey(l.fromId, l.toId) === key);
  const link: FamilyLink = { id: old?.id ?? newId(), fromId, toId, relation, ...(note?.trim() ? { note: note.trim().slice(0, 80) } : {}), updatedAt: now };
  return [link, ...list.filter((l) => l !== old)];
}

export function unlink(list: FamilyLink[], linkId: string): FamilyLink[] {
  return list.filter((l) => l.id !== linkId);
}

/** Drops links to charts that are no longer saved. */
export function pruneLinks(list: FamilyLink[], profileIds: Iterable<string>): FamilyLink[] {
  const ids = new Set(profileIds);
  return list.filter((l) => ids.has(l.fromId) && ids.has(l.toId));
}

/** Everyone linked directly to a person, each with their relation to that person. */
export function relativesOf(list: FamilyLink[], profileId: string): Relative[] {
  const out: Relative[] = [];
  for (const link of list) {
    if (link.fromId === profileId) out.push({ link, profileId: link.toId, relation: link.relation });
    else if (link.toId === profileId) out.push({ link, profileId: link.fromId, relation: inverseRelation(link.relation) });
  }
  const order = (r: Relation) => RELATIONS.indexOf(r);
  return out.sort((a, b) => order(a.relation) - order(b.relation));
}

/** Profile ids that belong to at least one family link, for a badge in the saved charts list. */
export function linkedIds(list: FamilyLink[]): Set<string> {
  return new Set(list.flatMap((l) => [l.fromId, l.toId]));
}

/** Merges links from a backup or another device: new pairs are added, and a pair edited on both sides keeps the newer edit. */
export function mergeLinks(here: FamilyLink[], there: unknown): { list: FamilyLink[]; added: number } {
  const incoming = parseLinks(there);
  const known = new Set(here.map((l) => pairKey(l.fromId, l.toId)));
  const merged = parseLinks([...here, ...incoming]);
  const added = incoming.filter((l) => !known.has(pairKey(l.fromId, l.toId))).length;
  return { list: merged, added };
}
