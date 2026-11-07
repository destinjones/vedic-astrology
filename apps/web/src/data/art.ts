import type { PlanetId } from '../types/chart';
import manifest from '../../../../assets/3d/manifest.json';

/**
 * Blender-rendered artwork from assets/3d (served at /cosmos/ by vite.config.ts).
 * Conventions (manifest.conventions): 0° sidereal Aries at 3 o'clock,
 * longitude increasing counter-clockwise; three.js position is
 * (r·cos(lon), h, −r·sin(lon)).
 */
export const COSMOS_BASE = `${import.meta.env.BASE_URL}cosmos/`;
export const cosmos = (path: string) => COSMOS_BASE + path;

const GRAHA_SLUG: Record<PlanetId, string> = {
  sun: 'surya', moon: 'chandra', mars: 'mangala', mercury: 'budha', jupiter: 'guru',
  venus: 'shukra', saturn: 'shani', rahu: 'rahu', ketu: 'ketu',
};

const grahaBySlug = Object.fromEntries(manifest.grahas.map((g) => [g.id, g]));

export interface GrahaArt { image: string; model: string; glow: string }

export const grahaArt = (id: PlanetId): GrahaArt => {
  const g = grahaBySlug[GRAHA_SLUG[id]];
  return { image: cosmos(g.image.path), model: cosmos(g.model.path), glow: g.glow };
};

/** sign 1–12 → medallion image */
export const rashiArt = (sign: number) => cosmos(manifest.rashis[sign - 1].image.path);

/** nakshatra 1–27 → medallion image */
export const nakshatraArt = (num: number) => cosmos(manifest.nakshatras[num - 1].image.path);

export const ART = {
  wheelTop: cosmos(manifest.wheel.top.path),
  wheelHero: cosmos(manifest.wheel.hero.path),
  wheelModel: cosmos(manifest.wheel.model.path),
  heroDesktop: cosmos(manifest.backgrounds.heroDesktop.path),
  heroMobile: cosmos(manifest.backgrounds.heroMobile.path),
  cosmosDesktop: cosmos(manifest.backgrounds.cosmosDesktop.path),
  cosmosMobile: cosmos(manifest.backgrounds.cosmosMobile.path),
  skyEquirect: cosmos(manifest.backgrounds.skyEquirect.path),
  radii: manifest.conventions.wheelRadii,
};
