import { useEffect, useState } from 'react';

/**
 * A small map of the chosen birth place so people can check it is the right
 * town. Plain OpenStreetMap raster tiles, no map library and no API key.
 *
 * OSM tile usage policy (https://operations.osmfoundation.org/policies/tiles/):
 * visible attribution, the browser's normal Referer, no prefetching or bulk
 * downloads. We only load the handful of tiles in view, only after a place is
 * chosen, and only once the coordinates stop changing. To move to another
 * provider later, change TILE_URL and ATTRIBUTION.
 */
const TILE_URL = (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
const TILE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 16;
const DEFAULT_ZOOM = 10;

interface Props {
  latitude: number;
  longitude: number;
  label: string;
  formerly?: string;
}

/** Web Mercator position in tile units at zoom z */
function project(lat: number, lon: number, z: number) {
  const n = 2 ** z;
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat));
  const r = (clamped * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
  };
}

export function PlaceMap({ latitude, longitude, label, formerly }: Props) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  // wait for typing in the latitude / longitude boxes to settle before loading tiles
  const [at, setAt] = useState({ latitude, longitude });
  useEffect(() => {
    const t = setTimeout(() => setAt({ latitude, longitude }), 500);
    return () => clearTimeout(t);
  }, [latitude, longitude]);

  const n = 2 ** zoom;
  const p = project(at.latitude, at.longitude, zoom);
  const cx = Math.floor(p.x);
  const cy = Math.floor(p.y);
  const tiles: { key: string; src: string; left: number; top: number }[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    const ty = cy + dy;
    if (ty < 0 || ty >= n) continue;
    for (let dx = -2; dx <= 2; dx++) {
      const tx = cx + dx;
      const wrapped = ((tx % n) + n) % n;
      tiles.push({
        key: `${zoom}/${tx}/${ty}`,
        src: TILE_URL(zoom, wrapped, ty),
        left: (tx - p.x) * TILE,
        top: (ty - p.y) * TILE,
      });
    }
  }

  const osmLink = `https://www.openstreetmap.org/?mlat=${at.latitude.toFixed(5)}&mlon=${at.longitude.toFixed(5)}#map=${zoom}/${at.latitude.toFixed(4)}/${at.longitude.toFixed(4)}`;
  const ns = at.latitude >= 0 ? 'N' : 'S';
  const ew = at.longitude >= 0 ? 'E' : 'W';

  return (
    <figure className="place-map span-2">
      <div className="place-map-view" role="img" aria-label={`Map of ${label}`}>
        {tiles.map((t) => (
          <img
            key={t.key}
            src={t.src}
            alt=""
            draggable={false}
            loading="lazy"
            style={{ left: `calc(50% + ${t.left}px)`, top: `calc(50% + ${t.top}px)` }}
          />
        ))}
        <span className="place-map-pin" aria-hidden="true" />
        <div className="place-map-zoom">
          <button type="button" aria-label="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + 1))}>+</button>
          <button type="button" aria-label="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - 1))}>−</button>
        </div>
        <small className="place-map-credit">
          © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors
        </small>
      </div>
      <figcaption>
        <span>
          <b>{label}</b>
          {formerly && <small className="muted"> · formerly {formerly}</small>}
          <br />
          <small className="muted mono">
            {Math.abs(at.latitude).toFixed(4)}° {ns}, {Math.abs(at.longitude).toFixed(4)}° {ew}
          </small>
        </span>
        <a href={osmLink} target="_blank" rel="noreferrer" className="place-map-open">Open larger map ↗</a>
      </figcaption>
    </figure>
  );
}
