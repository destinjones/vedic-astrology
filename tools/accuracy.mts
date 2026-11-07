/**
 * Measures how far each position source in this project is from the Swiss
 * Ephemeris with its full data files, and writes the public accuracy page.
 *
 *   npm run accuracy   →  apps/web/public/accuracy/index.html  (+ accuracy.json)
 *
 * Compared, as sidereal (Lahiri) geocentric longitudes:
 *  1. Swiss Ephemeris with its bundled files (the reference, used for 1800–2399)
 *  2. Swiss Ephemeris' built-in Moshier theory (used outside 1800–2399)
 *  3. The astronomy-engine fallback in @vedic/timing, with its own Lahiri formula
 *     (for programs that use the timing package without the WASM engine)
 *  4. The website's preview calculator (mean motions only), shown with a
 *     "preview" banner if the WASM engine cannot load in a browser
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine, ENGINE_VERSION } from '../packages/engine/src/index';
import { lahiriAyanamsa, siderealLongitude } from '../packages/timing/src/adapters/astronomyEphemeris';
import { mockChart } from '../apps/web/src/engine/mock';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '../apps/web/public/accuracy');

const PLANETS = [
  ['Sun', 0], ['Moon', 1], ['Mercury', 2], ['Venus', 3], ['Mars', 4], ['Jupiter', 5], ['Saturn', 6], ['Rahu (mean)', 10],
] as const;
const SWIEPH = 2, MOSEPH = 4, SIDEREAL = 65536;
const jdOf = (y: number) => 2451545 + (y - 2000) * 365.25;
const dateOfJd = (jd: number) => new Date((jd - 2440587.5) * 86400000);
const diff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180) * 3600; // arcseconds

interface Stat { median: number; p99: number; max: number; at: string }
const stats = (xs: { v: number; jd: number }[]): Stat => {
  const s = [...xs].sort((a, b) => a.v - b.v);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))].v;
  const worst = s[s.length - 1];
  return { median: q(0.5), p99: q(0.99), max: worst.v, at: dateOfJd(worst.jd).toISOString().slice(0, 10) };
};

(async () => {
  const engine = await createEngine();
  const swe = engine.swe as unknown as { set_sid_mode(a: number, b: number, c: number): void; calc_ut(jd: number, id: number, f: number): Float64Array; get_ayanamsa_ut(jd: number): number; version(): string };
  swe.set_sid_mode(1, 0, 0);

  // 1 vs 2: Moshier against the files, over the whole file range
  const mosh: Record<string, Stat> = {};
  for (const [name, id] of PLANETS) {
    const xs: { v: number; jd: number }[] = [];
    for (let jd = jdOf(1800) + 2; jd < jdOf(2399); jd += 29.3) {
      xs.push({ jd, v: diff(swe.calc_ut(jd, id, SWIEPH | SIDEREAL)[0], swe.calc_ut(jd, id, MOSEPH | SIDEREAL)[0]) });
    }
    mosh[name] = stats(xs);
  }

  // 1 vs 3: the astronomy-engine fallback, 1900–2100
  const TIMING_NAME: Record<string, Parameters<typeof siderealLongitude>[0]> = { Sun: 'Sun', Moon: 'Moon', Mercury: 'Mercury', Venus: 'Venus', Mars: 'Mars', Jupiter: 'Jupiter', Saturn: 'Saturn', 'Rahu (mean)': 'Rahu' };
  const fallback: Record<string, Stat> = {};
  const ayan: { v: number; jd: number }[] = [];
  for (const [name, id] of PLANETS) {
    const xs: { v: number; jd: number }[] = [];
    for (let jd = jdOf(1900); jd < jdOf(2100); jd += 9.7) {
      xs.push({ jd, v: diff(swe.calc_ut(jd, id, SWIEPH | SIDEREAL)[0], siderealLongitude(TIMING_NAME[name], dateOfJd(jd))) });
      if (name === 'Sun') ayan.push({ jd, v: diff(swe.get_ayanamsa_ut(jd), lahiriAyanamsa(dateOfJd(jd))) });
    }
    fallback[name] = stats(xs);
  }
  const ayanStat = stats(ayan);

  // 1 vs 4: the website's preview calculator, noon UTC every 9.7 days, 1900–2100
  const MOCK_ID: Record<string, string> = { Sun: 'sun', Moon: 'moon', Mercury: 'mercury', Venus: 'venus', Mars: 'mars', Jupiter: 'jupiter', Saturn: 'saturn', 'Rahu (mean)': 'rahu' };
  const prev: Record<string, { v: number; jd: number }[]> = Object.fromEntries(PLANETS.map(([n]) => [n, []]));
  for (let jd = Math.floor(jdOf(1900)) + 0.0; jd < jdOf(2100); jd += 9.7) {
    const d = dateOfJd(Math.floor(jd) + 0.5).toISOString();
    const m = await mockChart({ date: d.slice(0, 10), time: '12:00', place: 'Greenwich', latitude: 51.48, longitude: 0, timezone: 'UTC', ayanamsa: 'lahiri' });
    for (const [name, id] of PLANETS) {
      const p = m.planets.find((x) => x.id === MOCK_ID[name])!;
      const j = Math.floor(jd) + 0.5;
      prev[name].push({ jd: j, v: diff(swe.calc_ut(j, id, SWIEPH | SIDEREAL)[0], p.longitude) });
    }
  }
  const preview = Object.fromEntries(Object.entries(prev).map(([k, xs]) => [k, stats(xs)]));

  // the moment a planet changes sign or nakshatra moves by its error divided by its speed
  const result = {
    generated: new Date().toISOString().slice(0, 10),
    engineVersion: ENGINE_VERSION,
    swissEphemeris: swe.version(),
    moshierVsFiles: mosh,
    fallbackVsFiles: fallback,
    fallbackAyanamsa: ayanStat,
    previewVsFiles: preview,
  };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'accuracy.json'), JSON.stringify(result, null, 2) + '\n');
  writeFileSync(join(OUT, 'index.html'), page(result));
  console.log(JSON.stringify(result, null, 2));
  engine.close();
})();

const fmt = (a: number) => (a < 0.01 ? '< 0.01″' : a < 60 ? `${a.toFixed(a < 1 ? 2 : 1)}″` : a < 3600 ? `${(a / 60).toFixed(1)}′` : `${(a / 3600).toFixed(1)}°`);

function table(rows: Record<string, Stat>) {
  return `<table><thead><tr><th>Body</th><th>Median</th><th>99%</th><th>Worst</th><th>Worst on</th></tr></thead><tbody>${
    Object.entries(rows).map(([k, s]) => `<tr><td>${k}</td><td>${fmt(s.median)}</td><td>${fmt(s.p99)}</td><td>${fmt(s.max)}</td><td>${s.at}</td></tr>`).join('')
  }</tbody></table>`;
}

function page(r: { generated: string; engineVersion: string; swissEphemeris: string; moshierVsFiles: Record<string, Stat>; fallbackVsFiles: Record<string, Stat>; fallbackAyanamsa: Stat; previewVsFiles: Record<string, Stat> }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ephemeris accuracy · Jyotisha Explorer</title>
<meta name="description" content="How far each position source in Jyotisha Explorer is from the Swiss Ephemeris, measured, with the method and the script that produced it.">
<link rel="stylesheet" href="../docs.css">
</head>
<body>
<main class="doc">
<p class="crumb"><a href="../">Jyotisha Explorer</a> · <a href="../limitations/">Known limitations</a></p>
<h1>Ephemeris accuracy</h1>
<p class="lede">Every position on this site comes from the <a href="https://www.astro.com/swisseph/">Swiss Ephemeris</a> ${r.swissEphemeris},
compiled to WebAssembly and run in your browser. This page measures the other position sources the code can fall back to against it, so you
know exactly how much to trust a degree. Measured ${r.generated} by <a href="https://github.com/destinjones/vedic-astrology/blob/main/tools/accuracy.mts"><code>tools/accuracy.mts</code></a>
(engine ${r.engineVersion}); run <code>npm run accuracy</code> to measure it again. Raw numbers: <a href="accuracy.json">accuracy.json</a>.</p>

<h2>What the reference is</h2>
<p>For births from 1800 to 2399 the engine reads the Swiss Ephemeris data files, which reproduce NASA JPL's DE431 numerical integration to
about a milliarcsecond. That is the reference below. Times are converted to Terrestrial Time with the Swiss Ephemeris' own ΔT model, which
is the largest real uncertainty for old charts: ΔT was about 2 minutes around 1600 and is uncertain by minutes before 1000 CE, which moves
the Moon by up to a few arcminutes and the ascendant by up to about a degree.</p>
<p>One arcminute (1′) is one sixtieth of a degree, and one arcsecond (1″) a sixtieth of that. A sign is 30°, a nakshatra 13°20′, a navamsa 3°20′,
and a D60 shashtiamsa only 30′, so an error of 1″ never changes a sign or nakshatra except in the instant a planet crosses one.</p>

<h2>1. Outside 1800 to 2399: the Moshier theory</h2>
<p>Outside the file range the engine switches to the Moshier analytical theory built into the Swiss Ephemeris. Measured against the files
over 1800–2399, sampled every 29.3 days:</p>
${table(r.moshierVsFiles)}

<h2>2. The timing package's own fallback: astronomy-engine</h2>
<p>The timing package carries a small pure-JavaScript ephemeris (<a href="https://github.com/cosinekitty/astronomy">astronomy-engine</a> plus its own
mean Lahiri formula) for programs that use it without the WebAssembly engine. The website does not use it. Sidereal longitudes against the
files, 1900–2100, every 9.7 days:</p>
${table(r.fallbackVsFiles)}
<p>Its Lahiri formula agrees with the Swiss Ephemeris' to ${fmt(r.fallbackAyanamsa.max)} at worst. Most of the 10 to 20″ above is nutation:
astronomy-engine gives positions on the true ecliptic of date, while sidereal positions from the Swiss Ephemeris are on the mean ecliptic,
the convention sidereal astrology uses. The rest is the fallback's simpler lunar and planetary theory.</p>

<h2>3. If your browser cannot run the engine: the preview calculator</h2>
<p>If the WebAssembly engine fails to load, the explorer still draws a chart from mean motions only, and says so in a "preview" banner
at the top. It is there so the page is not blank, not for reading: Venus and Mars can be tens of degrees off, as measured here at noon UTC every
9.7 days over 1900–2100.</p>
${table(r.previewVsFiles)}

<h2>What this does not measure</h2>
<ul>
<li><b>Your birth data.</b> A birth time four minutes off moves the ascendant about a degree. This dwarfs every number here; see the Rodden rating on each chart.</li>
<li><b>The ayanamsa itself.</b> Lahiri, True Chitra, Raman and Krishnamurti are definitions, not measurements, and differ from each other by up to about 1.5°.
The engine reproduces each one as the Swiss Ephemeris defines it.</li>
<li><b>Other programs.</b> Paste a longitude from another program into the check page to see the difference for one chart.</li>
</ul>
<p class="foot">Jyotisha Explorer is free software under the AGPL. <a href="https://github.com/destinjones/vedic-astrology">Source</a>.</p>
</main>
</body>
</html>
`;
}
