import type { ContentPack } from '../../i18n/pack';
import { aspectFlavor, combust, conjunctions, dignity, retrograde, specialAspects } from './conditions';
import { doshas } from './doshas';
import { houseLords } from './houseLords';
import { houses } from './houses';
import { nakshatras } from './nakshatras';
import { phrases } from './phrases';
import { planetInHouse } from './planetInHouse';
import { planetInSign } from './planetInSign';
import { planetLens, planets } from './planets';
import { signs } from './signs';
import { yogas } from './yogas';

/** Hindi readings. Anything missing falls back to English piece by piece. */
const hi: ContentPack = {
  phrases, planets, planetLens, signs, houses, nakshatras,
  planetInSign, planetInHouse, houseLords,
  dignity, retrograde, combust, conjunctions, aspectFlavor, specialAspects,
  yogas, doshas,
};
export default hi;
