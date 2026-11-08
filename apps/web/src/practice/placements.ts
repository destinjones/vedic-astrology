/**
 * Placement keys: the small vocabulary saved phrases are filed under, so the
 * app can find a phrase again whenever the same placement turns up in a chart.
 *
 *   p:<planet>:sign:<n>    Moon in Taurus             p:<planet>:nak:<n>    Moon in Rohini
 *   p:<planet>:house:<n>   Moon in the 4th house      asc:sign:<n>          Taurus rising
 *   asc:nak:<n>            Ascendant in Rohini        house:<h>:sign:<n>    7th house in Libra
 *   lord:<h>:house:<n>     Lord of the 7th in the 10th
 *   yoga:<id>              a yoga                     dosha:<id>            a dosha
 *
 * Topics are what a reading section or a Life Chart Book note is about, in the
 * book's own keys: graha:<id>, house:<n>, asc, yoga:<id>, dosha:<id>, plus
 * "yogas", "doshas" and "all". No PDF or reading dependencies, so it loads eagerly.
 */
import type { Chart, PlanetId } from '../types/chart';
import { NAKSHATRAS, PLANET_BY_ID, PLANETS, signInfo } from '../data/constants';

export const PLANET_IDS = PLANETS.map((p) => p.id) as PlanetId[];
export const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

export interface Placement { key: string; label: string }
/** Yogas and doshas found in the chart, when the readings are loaded. */
export interface Found { yogas: { id: string; name: string }[]; doshas: { id: string; name: string; present?: boolean }[] }

/** Names for yoga and dosha keys, filled in by whoever has the readings loaded. */
const names = new Map<string, string>();
export const nameKeys = (list: { key: string; name: string }[]) => list.forEach((x) => names.set(x.key, x.name));

const prettyId = (id: string) => id.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/** A person-readable label for any placement key, or the key itself if it is not one. */
export function labelFor(key: string): string {
  const k = key.split(':');
  const n = Number(k[3] ?? k[2]);
  if (k[0] === 'p' && PLANET_BY_ID[k[1] as PlanetId]) {
    const planet = PLANET_BY_ID[k[1] as PlanetId].name;
    if (k[2] === 'sign') return `${planet} in ${signInfo(n).name}`;
    if (k[2] === 'nak') return `${planet} in ${NAKSHATRAS[n - 1]?.name ?? '?'}`;
    if (k[2] === 'house') return `${planet} in the ${ordinal(n)} house`;
  }
  if (k[0] === 'asc' && k[1] === 'sign') return `${signInfo(Number(k[2])).name} rising`;
  if (k[0] === 'asc' && k[1] === 'nak') return `Ascendant in ${NAKSHATRAS[Number(k[2]) - 1]?.name ?? '?'}`;
  if (k[0] === 'house' && k[2] === 'sign') return `${ordinal(Number(k[1]))} house in ${signInfo(n).name}`;
  if (k[0] === 'lord' && k[2] === 'house') return `Lord of the ${ordinal(Number(k[1]))} in the ${ordinal(n)}`;
  if (k[0] === 'yoga' || k[0] === 'dosha') return names.get(key) ?? prettyId(k[1] ?? key);
  return key;
}

/** Whether a string is a placement key this app knows how to match. */
export function isPlacementKey(key: string): boolean {
  return /^(p:(sun|moon|mars|mercury|jupiter|venus|saturn|rahu|ketu):(sign:(1[0-2]|[1-9])|nak:(2[0-7]|1[0-9]|[1-9])|house:(1[0-2]|[1-9]))|asc:(sign:(1[0-2]|[1-9])|nak:(2[0-7]|1[0-9]|[1-9]))|house:(1[0-2]|[1-9]):sign:(1[0-2]|[1-9])|lord:(1[0-2]|[1-9]):house:(1[0-2]|[1-9])|(yoga|dosha):[\w-]+)$/.test(key);
}

const houseOfSign = (chart: Chart, sign: number) => ((sign - chart.ascendant.sign + 12) % 12) + 1;
const signOfHouse = (chart: Chart, house: number) => ((chart.ascendant.sign - 1 + house - 1) % 12) + 1;

/** Keys for one planet's placement in this chart. */
function grahaKeys(chart: Chart, id: PlanetId): string[] {
  const p = chart.planets.find((x) => x.id === id);
  return p ? [`p:${id}:sign:${p.sign}`, `p:${id}:nak:${p.nakshatra}`, `p:${id}:house:${p.house}`] : [];
}

/** Keys for one house: its sign, the planets in it, and where its lord sits. */
function houseKeys(chart: Chart, h: number): string[] {
  const sign = signOfHouse(chart, h);
  const lord = chart.planets.find((x) => x.id === signInfo(sign).lord);
  const keys = [`house:${h}:sign:${sign}`];
  if (lord) keys.push(`lord:${h}:house:${houseOfSign(chart, lord.sign)}`);
  for (const p of chart.planets) if (p.house === h) keys.push(`p:${p.id}:house:${h}`);
  return keys;
}

/** Every placement in the chart, in reading order. Yogas and doshas only when `found` is given. */
export function chartPlacements(chart: Chart, found?: Found | null): Placement[] {
  const keys: string[] = [`asc:sign:${chart.ascendant.sign}`, `asc:nak:${chart.ascendant.nakshatra}`];
  for (const id of PLANET_IDS) keys.push(...grahaKeys(chart, id));
  for (let h = 1; h <= 12; h++) keys.push(...houseKeys(chart, h).filter((k) => !k.startsWith('p:')));
  if (found) {
    nameKeys([...found.yogas.map((y) => ({ key: `yoga:${y.id}`, name: y.name })), ...found.doshas.map((d) => ({ key: `dosha:${d.id}`, name: d.name }))]);
    keys.push(...found.yogas.map((y) => `yoga:${y.id}`), ...found.doshas.filter((d) => d.present !== false).map((d) => `dosha:${d.id}`));
  }
  return [...new Set(keys)].map((key) => ({ key, label: labelFor(key) }));
}

/** The placement keys a topic covers in this chart. */
export function topicKeys(chart: Chart, topic: string, found?: Found | null): string[] {
  const [kind, id] = topic.split(':');
  if (topic === 'all') return chartPlacements(chart, found).map((p) => p.key);
  if (topic === 'asc' || topic === 'lagna') return [`asc:sign:${chart.ascendant.sign}`, `asc:nak:${chart.ascendant.nakshatra}`, ...houseKeys(chart, 1)];
  if (kind === 'graha' && PLANET_BY_ID[id as PlanetId]) return grahaKeys(chart, id as PlanetId);
  if (kind === 'house' && Number(id) >= 1 && Number(id) <= 12) return houseKeys(chart, Number(id));
  if (kind === 'yoga' || kind === 'dosha') return id ? [topic] : [];
  if (topic === 'yogas') return found?.yogas.map((y) => `yoga:${y.id}`) ?? [];
  if (topic === 'doshas') return found?.doshas.filter((d) => d.present !== false).map((d) => `dosha:${d.id}`) ?? [];
  return [];
}

/** A Life Chart Book note key, as a topic. Chapter notes on the rising sign and Moon map to those placements. */
export function bookTopic(noteKey: string): string | null {
  if (noteKey === 'chapter:lagna') return 'asc';
  if (noteKey === 'chapter:moon') return 'graha:moon';
  if (noteKey === 'chapter:yogas') return 'yogas';
  if (/^(graha|house|yoga|dosha):/.test(noteKey)) return noteKey;
  return null;
}

/** Topics a reading section can be about, for the template editor. */
export const TOPICS: { id: string; label: string }[] = [
  { id: 'asc', label: 'Rising sign' },
  ...PLANET_IDS.map((id) => ({ id: `graha:${id}`, label: PLANET_BY_ID[id].name })),
  ...Array.from({ length: 12 }, (_, i) => ({ id: `house:${i + 1}`, label: `${ordinal(i + 1)} house` })),
  { id: 'yogas', label: 'Yogas found' },
  { id: 'doshas', label: 'Doshas found' },
];
export const topicLabel = (id: string) => TOPICS.find((t) => t.id === id)?.label ?? labelFor(id);
