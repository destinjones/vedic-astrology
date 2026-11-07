import type { ContentPack } from '../../i18n/pack';
import { aspectFlavor, combust, conjunctions, dignity, retrograde, specialAspects } from './conditions';
import { houses } from './houses';
import { nakshatras } from './nakshatras';
import { phrases } from './phrases';
import { planetLens, planets } from './planets';
import { signs } from './signs';

/** Hindi readings. Anything not listed here falls back to English. */
const hi: ContentPack = {
  phrases, planets, planetLens, signs, houses, nakshatras,
  dignity, retrograde, combust, conjunctions, aspectFlavor, specialAspects,
};
export default hi;
