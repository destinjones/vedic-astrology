import type { BhavaChalit } from '@vedic/engine';
import type { PlanetId } from '../types/chart';
import type { HouseMode } from '../lib/chalit';
import { PLANET_BY_ID } from '../data/constants';
import { ordinal } from '../lib/astro';

const LABEL: Record<HouseMode, string> = { rashi: 'Rashi', sripati: 'Chalit · Sripati', equal: 'Chalit · equal' };

/** Rashi / bhava chalit switch under the D1 chart, with the planets that change house. */
export function ChalitControl({ mode, onChange, chalit }: { mode: HouseMode; onChange: (m: HouseMode) => void; chalit: BhavaChalit | null }) {
  const shifted = chalit ? (Object.entries(chalit.planets) as [PlanetId, NonNullable<BhavaChalit['planets'][PlanetId]>][]).filter(([, p]) => p.shifted) : [];
  return (
    <div className="chalit">
      <div className="seg" role="radiogroup" aria-label="House chart">
        {(['rashi', 'sripati', 'equal'] as HouseMode[]).map((m) => (
          <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'is-active' : ''} onClick={() => onChange(m)}
            title={m === 'rashi' ? 'Whole-sign houses: each sign is one house' : m === 'sripati' ? 'Bhava chalit with Sripati cusps: the quadrants between lagna, MC, descendant and IC split in three' : 'Bhava chalit with equal houses centred on the lagna degree'}>
            {LABEL[m]}
          </button>
        ))}
      </div>
      {chalit && (
        <p className="chalit-note muted">
          {shifted.length === 0
            ? 'No planet changes house in the bhava chalit: every placement reads the same as in the rashi chart.'
            : <>
                {shifted.map(([id, p], i) => (
                  <span key={id}>
                    {i > 0 && (i === shifted.length - 1 ? ' and ' : ', ')}
                    <b style={{ color: PLANET_BY_ID[id].color }}>{PLANET_BY_ID[id].name}</b> moves from the {ordinal(p.rashiHouse)} to the {ordinal(p.bhava)} bhava
                  </span>
                ))}
                . House readings now follow the bhava; lordship and yogas stay with the signs.
              </>}
          {(() => {
            const near = (Object.entries(chalit.planets) as [PlanetId, NonNullable<BhavaChalit['planets'][PlanetId]>][]).filter(([, p]) => p.fromSandhi < 2);
            return near.length ? ` ${near.map(([id]) => PLANET_BY_ID[id].name).join(', ')} ${near.length > 1 ? 'sit' : 'sits'} within 2° of a sandhi (house junction) and ${near.length > 1 ? 'give' : 'gives'} mixed results of both houses.` : '';
          })()}
        </p>
      )}
    </div>
  );
}
