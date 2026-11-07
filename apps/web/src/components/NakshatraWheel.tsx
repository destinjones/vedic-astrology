import type { Chart, PlanetId } from '../types/chart';
import type { Selection } from '../types/ui';
import { NAK_SPAN, NAKSHATRAS, PLANET_BY_ID, SIGNS } from '../data/constants';
import { ART, grahaArt } from '../data/art';
import { houseOf } from '../lib/astro';

export type WheelMode = 'art' | 'diagram';

interface Props {
  chart: Chart;
  selection: Selection | null;
  mode: WheelMode;
  onSelect: (s: Selection) => void;
  onHoverPlanet: (id: PlanetId | null) => void;
}

/** 0° sidereal Aries at 3 o'clock, longitude increasing counter-clockwise (project convention) */
const polar = (deg: number, r: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [200 + r * Math.cos(a), 200 - r * Math.sin(a)];
};

function arc(d0: number, d1: number, r0: number, r1: number) {
  const [x0, y0] = polar(d0, r1);
  const [x1, y1] = polar(d1, r1);
  const [x2, y2] = polar(d1, r0);
  const [x3, y3] = polar(d0, r0);
  const large = d1 - d0 > 180 ? 1 : 0;
  return `M${x0},${y0} A${r1},${r1} 0 ${large} 0 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 1 ${x3},${y3} Z`;
}

/** Rings in SVG units. Art mode follows the Blender plate's radii (rim = 10 units). */
function rings(mode: WheelMode) {
  if (mode === 'diagram') {
    return { rim: 190, signIn: 160, signOut: 190, nakIn: 118, nakOut: 160, planet: 95, laneStep: -20, lanes: 3 };
  }
  const k = 190 / ART.radii.rim;
  const r = ART.radii;
  return {
    rim: 190, signIn: r.rashiInner * k, signOut: r.rashiOuter * k, nakIn: r.nakshatraInner * k, nakOut: r.nakshatraOuter * k,
    planet: ((r.grahaTrackInner + r.grahaTrackOuter) / 2) * k, laneStep: -19, lanes: 2,
  };
}

export function NakshatraWheel({ chart, selection, mode, onSelect, onHoverPlanet }: Props) {
  const R = rings(mode);
  const art = mode === 'art';

  // spread planets that are close together onto different radii
  const sorted = [...chart.planets].sort((a, b) => a.longitude - b.longitude);
  const radius: Record<string, number> = {};
  let prev = -99, lane = 0;
  for (const p of sorted) {
    lane = p.longitude - prev < 10 ? Math.min(lane + 1, R.lanes) : 0;
    radius[p.id] = R.planet + lane * R.laneStep;
    prev = p.longitude;
  }

  const plate = (20.4 / 20) * R.rim * 2;

  return (
    <svg viewBox="0 0 400 400" className={`wheel-svg wheel-${mode}`} role="img" aria-label="Nakshatra wheel">
      <defs>
        <radialGradient id="wheelGlow">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {art ? (
        <image href={ART.wheelTop} x={200 - plate / 2} y={200 - plate / 2} width={plate} height={plate} preserveAspectRatio="xMidYMid meet" />
      ) : (
        <>
          <circle cx={200} cy={200} r={R.rim} className="wheel-ring" />
          <circle cx={200} cy={200} r={R.nakIn - 4} fill="url(#wheelGlow)" />
        </>
      )}

      {SIGNS.map((s, i) => {
        const [tx, ty] = polar(i * 30 + 15, (R.signIn + R.signOut) / 2);
        const house = houseOf(s.num, chart.ascendant.sign);
        const sel = selection?.kind === 'house' && selection.num === house;
        return (
          <g key={s.num} className="wheel-sign-g" onClick={() => onSelect({ kind: 'house', num: house })}>
            <path d={arc(i * 30, i * 30 + 30, R.signIn, R.signOut)}
              className={art ? `wheel-hit${sel ? ' is-selected' : ''}` : `wheel-sign el-${s.element.toLowerCase()}${sel ? ' is-selected' : ''}`} />
            {!art && <text x={tx} y={ty + 6} textAnchor="middle" className="wheel-glyph">{s.glyph}</text>}
            <title>{`${s.name} · house ${house}`}</title>
          </g>
        );
      })}

      {NAKSHATRAS.map((n, i) => {
        const d0 = i * NAK_SPAN;
        const [tx, ty] = polar(d0 + NAK_SPAN / 2, (R.signOut + R.nakIn) / 2);
        const sel = selection?.kind === 'nakshatra' && selection.num === n.num;
        const hasPlanet = chart.planets.some((p) => p.nakshatra === n.num) || chart.ascendant.nakshatra === n.num;
        return (
          <g key={n.num} className="wheel-nak-g" onClick={() => onSelect({ kind: 'nakshatra', num: n.num })}>
            <path d={arc(d0, d0 + NAK_SPAN, art ? R.nakIn : R.nakIn, art ? R.nakOut : R.signIn)}
              className={art ? `wheel-hit${sel ? ' is-selected' : ''}${hasPlanet ? ' is-occupied' : ''}` : `wheel-nak${sel ? ' is-selected' : ''}${hasPlanet ? ' is-occupied' : ''}`} />
            {!art && <text x={tx} y={ty + 4} textAnchor="middle" className="wheel-naknum">{n.num}</text>}
            <title>{n.name}</title>
          </g>
        );
      })}

      {(() => {
        const [x, y] = polar(chart.ascendant.longitude, R.rim + 2);
        const [x2, y2] = polar(chart.ascendant.longitude, R.planet + 14);
        const [lx, ly] = polar(chart.ascendant.longitude, R.rim - 8);
        return (
          <g className="wheel-asc" onClick={() => onSelect({ kind: 'asc' })}>
            <line x1={x} y1={y} x2={x2} y2={y2} />
            <circle cx={lx} cy={ly} r={11} />
            <text x={lx} y={ly} dy={3.5} textAnchor="middle">Asc</text>
            <title>Ascendant (Lagna)</title>
          </g>
        );
      })()}

      {chart.planets.map((p) => {
        const info = PLANET_BY_ID[p.id];
        const r = radius[p.id];
        const [x, y] = polar(p.longitude, r);
        const [lx, ly] = polar(p.longitude, art ? R.signIn : R.nakIn - 2);
        const sel = selection?.kind === 'planet' && selection.id === p.id;
        const size = sel ? 30 : 24;
        return (
          <g key={p.id} className="wheel-planet"
            onMouseEnter={() => onHoverPlanet(p.id)} onMouseLeave={() => onHoverPlanet(null)}
            onClick={() => onSelect({ kind: 'planet', id: p.id })}>
            <line x1={x} y1={y} x2={lx} y2={ly} stroke={info.color} strokeOpacity={art ? 0.8 : 0.5} strokeWidth={art ? 1.4 : 1} />
            {art ? (
              <>
                {sel && <circle cx={x} cy={y} r={size / 2 + 3} fill="none" stroke={info.color} strokeWidth={2} />}
                <image href={grahaArt(p.id).image} x={x - size / 2} y={y - size / 2} width={size} height={size} />
              </>
            ) : (
              <>
                <circle cx={x} cy={y} r={sel ? 12 : 10} fill="var(--surface)" stroke={info.color} strokeWidth={sel ? 2.5 : 1.5} />
                <text x={x} y={y + 4.5} textAnchor="middle" fill={info.color} className="wheel-planet-glyph">{info.glyph}</text>
              </>
            )}
            <title>{`${info.name}${p.retrograde && p.id !== 'rahu' && p.id !== 'ketu' ? ' (retrograde)' : ''}`}</title>
          </g>
        );
      })}

      {!art && (
        <>
          <circle cx={200} cy={200} r={30} className="wheel-core" />
          <text x={200} y={204} textAnchor="middle" className="wheel-core-text">ॐ</text>
        </>
      )}
    </svg>
  );
}
