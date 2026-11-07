/**
 * Builds the small world outline the eclipse map draws, from Natural Earth's
 * 1:110m land (public domain) as packaged by world-atlas (ISC).
 *
 *   node tools/build-land.mjs <path to an unpacked world-atlas@2 package>
 *
 * Output: one SVG path in an equirectangular 360 × 180 box (x = longitude + 180,
 * y = 90 − latitude), so the browser needs no map library.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const topo = JSON.parse(readFileSync(join(process.argv[2], 'land-110m.json'), 'utf8'));
const [sx, sy] = topo.transform.scale;
const [tx, ty] = topo.transform.translate;
const arcs = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
});
const arcPts = (i) => (i >= 0 ? arcs[i] : [...arcs[~i]].reverse());
const r1 = (v) => Math.round(v * 10) / 10;
let d = '';
for (const g of topo.objects.land.geometries) {
  const polys = g.type === 'Polygon' ? [g.arcs] : g.arcs;
  for (const poly of polys) for (const ring of poly) {
    const pts = ring.flatMap((i, k) => (k ? arcPts(i).slice(1) : arcPts(i)));
    // rings cut by the date line (Chukotka, Fiji, Antarctica): make the longitudes continuous,
    // then draw the ring again one world-width over so the part off the edge shows on the other side
    const un = [];
    for (const [lon, lat] of pts) {
      let l = lon;
      if (un.length) { const prev = un[un.length - 1][0]; while (l - prev > 180) l -= 360; while (prev - l > 180) l += 360; }
      un.push([l, lat]);
    }
    const ringD = (shift) => 'M' + un.map(([lon, lat]) => `${r1(lon + 180 + shift)} ${r1(90 - lat)}`).join('L') + 'Z';
    const lo = Math.min(...un.map((p) => p[0])), hi = Math.max(...un.map((p) => p[0]));
    d += ringD(0);
    if (hi > 180) d += ringD(-360);
    if (lo < -180) d += ringD(360);
  }
}
const out = join(dirname(fileURLToPath(import.meta.url)), '../packages/sky/src/data/land.json');
writeFileSync(out, JSON.stringify({ source: 'Natural Earth 1:110m land (public domain) via world-atlas 2.0.2 (ISC)', viewBox: '0 0 360 180', d }));
console.log(`${d.length} bytes → ${out}`);
