/**
 * Static "learn" pages, generated at build time from the readings the app already uses:
 * 27 nakshatras, 12 signs, 9 grahas, 12 houses, 108 planet-in-sign and 108 planet-in-house
 * placements, 44 yogas, 9 doshas and a glossary. Plain HTML and CSS, no JavaScript, so that
 * search engines and slow phones get the full text at once.
 *
 * vite.config.ts (learnPagesPlugin) loads this module in Node, writes the pages into
 * dist/learn/ on build and serves them from memory in dev.
 */
import {
  DOSHA_DEFINITIONS,
  HOUSES,
  NAKSHATRAS,
  PLANET_IN_HOUSE,
  PLANET_IN_SIGN,
  PLANET_PROFILES,
  PLANETS,
  SIGNS,
  YOGA_DEFINITIONS,
  type PlanetId,
  type PlanetProfile,
  type SignProfile,
  type YogaDefinition,
} from '@vedic/interpretations';
import manifest from '../../../../assets/3d/manifest.json';
import { MORE_TERMS, TERMS } from './terms';

/** Where the site is published. Canonical links and the sitemap always point here. */
export const SITE = 'https://destinjones.github.io/vedic-astrology/';

export interface LearnPage {
  /** Path inside the site, e.g. "learn/signs/aries/index.html". */
  file: string;
  html: string;
}

export interface LearnOptions {
  /** The site base, e.g. "/" in dev or "/vedic-astrology/" on GitHub Pages. */
  base: string;
  /** hrefs of the stylesheets; empty when `head` loads them (dev). */
  css: string[];
  /** Extra markup for <head> (the dev server injects Vite's client here). */
  head?: string;
  /** GoatCounter code, when the build has one. Adds a pageview beacon to every page. */
  counter?: string;
}

// ---------- helpers ----------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();
const listText = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
/** Search snippets are cut near 155 characters; stop at a word. */
const clip = (s: string, n = 155) => (s.length <= n ? s : `${s.slice(0, s.lastIndexOf(' ', n - 1))}…`);

const SIGN_BY_NUM = (n: number) => SIGNS[n - 1];
/** 13.333 → "13°20′ Aries" */
function fmtLon(lon: number): string {
  const total = Math.round(lon * 60);
  const sign = Math.floor(total / 1800) % 12;
  const inSign = total - Math.floor(total / 1800) * 1800;
  return `${Math.floor(inSign / 60)}°${String(inSign % 60).padStart(2, '0')}′ ${SIGNS[sign].name}`;
}

const PLANET_LIST = PLANETS as readonly PlanetId[];
const P = (id: PlanetId) => PLANET_PROFILES[id];
/** "Guru / Brihaspati" → "Guru", "Rahu (North Node)" → "Rahu" */
const SKT = (p: PlanetProfile) => p.sanskrit.split(/\s*[/(]/)[0].trim();
/** "Jupiter (Guru)", or "Rahu (North Node)" where the names are the same */
const label = (p: PlanetProfile) => (SKT(p) === p.name ? p.sanskrit : `${p.name} (${SKT(p)})`);

const YOGA_CATEGORY: Record<string, string> = {
  raja: 'Raja yogas: power and status', dhana: 'Dhana yogas: wealth', mahapurusha: 'Mahapurusha yogas: the five great persons',
  lunar: 'Lunar yogas', solar: 'Solar yogas', nabhasa: 'Nabhasa yogas: whole-chart patterns', parivartana: 'Parivartana yogas: exchanges',
  viparita: 'Viparita raja yogas: reversals', 'neecha-bhanga': 'Neecha bhanga: cancelled weakness', spiritual: 'Spiritual yogas',
  arishta: 'Arishta yogas: combinations that ask for care', other: 'Other yogas',
};

const NAK_ART = (n: number) => `cosmos/${manifest.nakshatras[n - 1].image.path}`;
const SIGN_ART = (n: number) => `cosmos/${manifest.rashis[n - 1].image.path}`;
const GRAHA_SLUG: Record<PlanetId, string> = {
  sun: 'surya', moon: 'chandra', mars: 'mangala', mercury: 'budha', jupiter: 'guru', venus: 'shukra', saturn: 'shani', rahu: 'rahu', ketu: 'ketu',
};
const GRAHA_ART = (id: PlanetId) => `cosmos/${manifest.grahas.find((g) => g.id === GRAHA_SLUG[id])!.image.path}`;

// ---------- URLs ----------

const U = {
  hub: 'learn/',
  naks: 'learn/nakshatras/',
  nak: (id: string) => `learn/nakshatras/${id}/`,
  signs: 'learn/signs/',
  sign: (id: string) => `learn/signs/${id}/`,
  planets: 'learn/planets/',
  planet: (id: PlanetId) => `learn/planets/${id}/`,
  inSign: (p: PlanetId, s: SignProfile) => `learn/planets/${p}/in-${s.id}/`,
  inHouse: (p: PlanetId, h: number) => `learn/planets/${p}/in-${ordinal(h)}-house/`,
  houses: 'learn/houses/',
  house: (n: number) => `learn/houses/${ordinal(n)}-house/`,
  yogas: 'learn/yogas/',
  yoga: (id: string) => `learn/yogas/${id}/`,
  doshas: 'learn/doshas/',
  dosha: (id: string) => `learn/doshas/${id}/`,
  glossary: 'learn/glossary/',
};

// ---------- the page shell ----------

interface Crumb { name: string; path: string }

interface PageSpec {
  path: string;
  title: string;
  description: string;
  h1: string;
  eyebrow?: string;
  crumbs: Crumb[];
  body: string;
  image?: string;
  /** Extra JSON-LD objects. */
  ld?: object[];
  /** Leave out the "see it in your chart" box (the hub pages have their own). */
  noTry?: boolean;
  tryText?: string;
}

function counterScript(code: string): string {
  // Same rules as src/lib/analytics.ts: path only (never the # fragment), nothing under Do Not Track or GPC.
  return `<script>(function(){var n=navigator;if(n.doNotTrack==='1'||n.globalPrivacyControl)return;var q='p='+encodeURIComponent(location.pathname)+'&t='+encodeURIComponent(document.title)+'&s='+screen.width;try{if(document.referrer){var r=new URL(document.referrer);if(r.host!==location.host)q+='&r='+encodeURIComponent(r.host)}}catch(e){}var u='https://${code}.goatcounter.com/count?'+q+'&rnd='+Math.random().toString(36).slice(2);if(!(n.sendBeacon&&n.sendBeacon(u)))new Image().src=u})()</script>`;
}

function shell(o: LearnOptions, s: PageSpec): string {
  const href = (p: string) => esc(o.base + p);
  const url = SITE + s.path;
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [{ name: 'Home', path: '' }, ...s.crumbs].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: SITE + c.path })),
    },
    { '@context': 'https://schema.org', '@type': 'Article', headline: s.h1, description: s.description, url, inLanguage: 'en', isPartOf: { '@type': 'WebSite', name: 'Jyotisha Explorer', url: SITE }, ...(s.image ? { image: SITE + s.image } : {}) },
    ...(s.ld ?? []),
  ];
  const tryBox = s.noTry ? '' : `
      <aside class="lt-try">
        <h2>See it in your own chart</h2>
        <p>${esc(s.tryText ?? 'Enter your birth date, time and place and the app finds where this sits in your chart, with a plain-English reading of what it means for you.')}</p>
        <a class="cta" href="${href('app/')}">Make my free chart</a>
        <p class="fine">Free, no sign-up. Your birth details stay on your device.</p>
      </aside>`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(s.title)}</title>
    <meta name="description" content="${esc(s.description)}" />
    <link rel="canonical" href="${esc(url)}" />
    <link rel="icon" type="image/svg+xml" href="${href('favicon.svg')}" />
    <meta name="theme-color" content="#0b0a1a" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Jyotisha Explorer" />
    <meta property="og:title" content="${esc(s.h1)}" />
    <meta property="og:description" content="${esc(s.description)}" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:image" content="${esc(SITE + (s.image ?? 'og.jpg'))}" />
    <meta name="twitter:card" content="summary" />
    ${o.css.map((c) => `<link rel="stylesheet" href="${esc(c)}" />\n    `).join('')}<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>${o.head ?? ''}${o.counter ? `\n    ${counterScript(o.counter)}` : ''}
  </head>
  <body class="learn">
    <header class="lt-nav">
      <a class="wordmark" href="${href('')}"><span aria-hidden="true">✦</span> Jyotisha Explorer</a>
      <nav aria-label="Site">
        <a href="${href(U.hub)}">Learn</a>
        <a href="${href(U.glossary)}">Glossary</a>
        <a href="${href('match/')}">Kundali matching</a>
        <a class="lt-navcta" href="${href('app/')}">Free birth chart</a>
      </nav>
    </header>
    <main class="lt-main">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="${href('')}">Home</a>${s.crumbs.map((c, i) => (i === s.crumbs.length - 1 ? ` <span aria-hidden="true">›</span> <span aria-current="page">${esc(c.name)}</span>` : ` <span aria-hidden="true">›</span> <a href="${href(c.path)}">${esc(c.name)}</a>`)).join('')}</nav>
      <article>
        ${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ''}
        <h1>${esc(s.h1)}</h1>
${s.body}
      </article>${tryBox}
    </main>
    <footer class="lt-foot">
      <nav aria-label="Learn">
        <a href="${href(U.naks)}">Nakshatras</a> · <a href="${href(U.signs)}">Signs</a> · <a href="${href(U.planets)}">Planets</a> ·
        <a href="${href(U.houses)}">Houses</a> · <a href="${href(U.yogas)}">Yogas</a> · <a href="${href(U.doshas)}">Doshas</a> · <a href="${href(U.glossary)}">Glossary</a>
      </nav>
      <p>Astrology is a traditional practice, not a science, and no chart can promise what will happen to you. These pages describe what the tradition says, for reflection. They are not medical, legal or financial advice.</p>
      <p><a href="${href('how-it-works/')}">How it works</a> · <a href="${href('privacy/')}">Privacy</a> · <a href="https://github.com/destinjones/vedic-astrology">Source</a></p>
    </footer>
  </body>
</html>
`;
}

// ---------- small building blocks ----------

function linkFor(o: LearnOptions) {
  return (path: string, text: string) => `<a href="${esc(o.base + path)}">${esc(text)}</a>`;
}

const facts = (rows: [string, string][]) =>
  `        <dl class="facts">\n${rows.map(([k, v]) => `          <div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('\n')}\n        </dl>`;

const paras = (xs: string[]) => xs.map((p) => `        <p>${esc(p)}</p>`).join('\n');
const bullets = (xs: string[]) => `<ul>${xs.map((x) => `<li>${esc(cap(x))}</li>`).join('')}</ul>`;
const twoCol = (a: [string, string[]], b: [string, string[]]) =>
  `        <div class="lt-two">\n          <section><h2>${esc(a[0])}</h2>${bullets(a[1])}</section>\n          <section><h2>${esc(b[0])}</h2>${bullets(b[1])}</section>\n        </div>`;

function art(o: LearnOptions, src: string, alt: string, cls = 'lt-art') {
  return `        <img class="${cls}" src="${esc(o.base + src)}" alt="${esc(alt)}" width="220" height="220" />`;
}

function cards(o: LearnOptions, items: { path: string; title: string; text: string; img?: string; alt?: string }[]) {
  return `        <ul class="lt-cards">\n${items
    .map((c) => `          <li><a href="${esc(o.base + c.path)}">${c.img ? `<img src="${esc(o.base + c.img)}" alt="${esc(c.alt ?? '')}" loading="lazy" width="72" height="72" />` : ''}<b>${esc(c.title)}</b><span>${esc(c.text)}</span></a></li>`)
    .join('\n')}\n        </ul>`;
}

function prevNext(o: LearnOptions, prev: Crumb, next: Crumb) {
  const a = linkFor(o);
  return `        <nav class="lt-pn" aria-label="More"><span>← ${a(prev.path, prev.name)}</span><span>${a(next.path, next.name)} →</span></nav>`;
}

function dignityIn(p: PlanetProfile, sign: number): string | null {
  if (p.exaltation?.sign === sign) return `exalted (strongest at ${p.exaltation.degree}°)`;
  if (p.debilitation?.sign === sign) return `debilitated (weakest at ${p.debilitation.degree}°)`;
  if (p.moolatrikona?.sign === sign) return `in its moolatrikona from ${p.moolatrikona.from}° to ${p.moolatrikona.to}°${p.ownSigns.includes(sign as never) ? ', and its own sign' : ''}`;
  if (p.ownSigns.includes(sign as never)) return 'in its own sign';
  return null;
}

// ---------- page builders ----------

function nakshatraPages(o: LearnOptions): LearnPage[] {
  const a = linkFor(o);
  const out: LearnPage[] = [];
  NAKSHATRAS.forEach((n, i) => {
    const end = n.start + 360 / 27;
    const prev = NAKSHATRAS[(i + 26) % 27];
    const next = NAKSHATRAS[(i + 1) % 27];
    const signs = [...new Set([Math.floor(n.start / 30) + 1, Math.floor((end - 1e-6) / 30) + 1])].map(SIGN_BY_NUM);
    const lord = P(n.lord);
    const body = [
      art(o, NAK_ART(n.number), `Medallion artwork for ${n.name} nakshatra, whose symbol is ${n.symbol}`),
      `        <p class="lede">${esc(n.description)}</p>`,
      facts([
        ['Span', `${fmtLon(n.start)} to ${fmtLon(end)}`],
        ['Sign', signs.map((s) => a(U.sign(s.id), `${s.name} (${s.sanskrit})`)).join(' and ')],
        ['Ruling planet', `${a(U.planet(n.lord), label(lord))}, which also starts the ${lord.dashaYears}-year Vimshottari dasha for anyone born with the Moon here`],
        ['Deity', esc(cap(n.deity))],
        ['Symbol', esc(cap(n.symbol))],
        ['Gana (temperament)', esc(cap(n.gana))],
        ['Shakti (power)', esc(cap(n.shakti))],
        ['Nature', esc(cap(n.nature))],
        ['Keywords', esc(n.keywords.join(', '))],
      ]),
      twoCol(['Gifts', n.gifts], ['Shadows', n.shadows]),
      `        <h2>The four padas of ${esc(n.name)}</h2>`,
      `        <p>Each nakshatra is split into four quarters (padas) of 3°20′. Each pada falls in a different navamsha sign, which shades how the star expresses itself.</p>`,
      `        <ol class="lt-padas">${n.padas.map((p, k) => `<li><b>Pada ${k + 1}</b> (${esc(fmtLon(n.start + (k * 10) / 3))}): ${esc(p)}</li>`).join('')}</ol>`,
      `        <h2>If your Moon is in ${esc(n.name)}</h2>`,
      `        <p>${esc(n.name)} is then your janma nakshatra, or birth star. Your life opens in the ${esc(lord.name)} mahadasha, and kundali matching reads your gana, yoni and nadi from this star. ${a('match/', 'Check a match')} or ${a(U.glossary + '#janma-nakshatra', 'read more about birth stars')}.</p>`,
      prevNext(o, { name: prev.name, path: U.nak(prev.id) }, { name: next.name, path: U.nak(next.id) }),
    ].join('\n');
    out.push(page(o, {
      path: U.nak(n.id),
      title: `${n.name} nakshatra: meaning, lord, deity and padas · Jyotisha Explorer`,
      description: clip(`${n.name} nakshatra (${fmtLon(n.start)}–${fmtLon(end)}) is ruled by ${lord.name}. ${firstSentence(n.description)} Deity, symbol, gana, gifts, shadows and all four padas.`),
      h1: `${n.name} nakshatra`,
      eyebrow: `Nakshatra ${n.number} of 27`,
      crumbs: [{ name: 'Learn', path: U.hub }, { name: 'Nakshatras', path: U.naks }, { name: n.name, path: U.nak(n.id) }],
      image: NAK_ART(n.number),
      body,
      tryText: `Find out whether your Moon, your ascendant or any planet sits in ${n.name}, and what that means for you.`,
    }));
  });
  out.push(page(o, {
    path: U.naks,
    title: 'The 27 nakshatras of Vedic astrology, explained · Jyotisha Explorer',
    description: 'All 27 nakshatras (lunar mansions) of Vedic astrology: their spans, ruling planets, deities, symbols, temperaments and padas, in plain English.',
    h1: 'The 27 nakshatras',
    eyebrow: 'Lunar mansions',
    crumbs: [{ name: 'Learn', path: U.hub }, { name: 'Nakshatras', path: U.naks }],
    body: [
      `        <p class="lede">The Moon takes about 27 days to circle the sky, and the tradition divides its path into 27 nakshatras of 13°20′ each. The nakshatra your Moon was in at birth, your birth star, is one of the most personal facts in a Vedic chart: it sets your dasha timeline and much of your compatibility.</p>`,
      cards(o, NAKSHATRAS.map((n) => ({ path: U.nak(n.id), title: `${n.number}. ${n.name}`, text: `${P(n.lord).name} · ${n.keywords.slice(0, 2).join(', ')}`, img: NAK_ART(n.number), alt: '' }))),
    ].join('\n'),
  }));
  return out;
}

function signPages(o: LearnOptions): LearnPage[] {
  const a = linkFor(o);
  const out: LearnPage[] = SIGNS.map((s, i) => {
    const lord = P(s.lord);
    const prev = SIGNS[(i + 11) % 12];
    const next = SIGNS[(i + 1) % 12];
    const from = (s.number - 1) * 30;
    const naks = NAKSHATRAS.filter((n) => n.start < from + 30 - 1e-6 && n.start + 360 / 27 > from + 1e-6);
    const dignities = PLANET_LIST.map((p) => [p, dignityIn(P(p), s.number)] as const).filter(([, d]) => d);
    const body = [
      art(o, SIGN_ART(s.number), `Medallion artwork for ${s.name} (${s.sanskrit})`),
      `        <p class="lede">${esc(s.description)}</p>`,
      facts([
        ['Sanskrit name', esc(s.sanskrit)],
        ['Element', esc(cap(s.element))],
        ['Quality', esc(cap(s.modality))],
        ['Ruling planet', a(U.planet(s.lord), label(lord))],
        ['Body', esc(cap(s.body))],
        ['Themes', esc(s.themes.join(', '))],
        ['Nakshatras', naks.map((n) => a(U.nak(n.id), n.name)).join(', ')],
      ]),
      `        <p>Planets in ${esc(s.name)} act ${esc(s.style)}.</p>`,
      dignities.length ? `        <h2>Planets that are strong or weak here</h2>\n        <ul>${dignities.map(([p, d]) => `<li>${a(U.inSign(p, s), P(p).name)} is ${esc(d!)}.</li>`).join('')}</ul>` : '',
      `        <h2>Each planet in ${esc(s.name)}</h2>`,
      `        <ul class="lt-list">${PLANET_LIST.map((p) => `<li>${a(U.inSign(p, s), `${P(p).name} in ${s.name}`)}: ${esc(PLANET_IN_SIGN[p][i][0].replace(/^[^:]*:\s*/, ''))}</li>`).join('')}</ul>`,
      `        <h2>${esc(s.name)} rising or ${esc(s.name)} Moon</h2>`,
      `        <p>With ${esc(s.name)} on the ascendant, ${esc(lord.name)} becomes the lord of your whole chart. With the Moon in ${esc(s.name)}, it is your janma rashi, the sign Saturn's Sade Sati is counted from. In Vedic astrology both usually matter more than the Sun sign, and because the sidereal zodiac sits about 24° behind the tropical one, many people find their Vedic sign is the one before their Western sign.</p>`,
      prevNext(o, { name: prev.name, path: U.sign(prev.id) }, { name: next.name, path: U.sign(next.id) }),
    ].filter(Boolean).join('\n');
    return page(o, {
      path: U.sign(s.id),
      title: `${s.name} (${s.sanskrit}) in Vedic astrology: traits, lord and nakshatras · Jyotisha Explorer`,
      description: clip(`${s.name} (${s.sanskrit}) is a ${s.modality} ${s.element} sign ruled by ${lord.name}. ${firstSentence(s.description)} Its nakshatras, strong planets and every planet in ${s.name}.`),
      h1: `${s.name} (${s.sanskrit}) in Vedic astrology`,
      eyebrow: `Sign ${s.number} of 12`,
      crumbs: [{ name: 'Learn', path: U.hub }, { name: 'Signs', path: U.signs }, { name: s.name, path: U.sign(s.id) }],
      image: SIGN_ART(s.number),
      body,
      tryText: `See whether ${s.name} is your ascendant or Moon sign, which house it rules for you and which planets sit there.`,
    });
  });
  out.push(page(o, {
    path: U.signs,
    title: 'The 12 signs (rashis) of Vedic astrology · Jyotisha Explorer',
    description: 'The twelve sidereal signs of Vedic astrology, from Mesha (Aries) to Meena (Pisces): their elements, lords, nakshatras and how each planet behaves in them.',
    h1: 'The 12 signs',
    eyebrow: 'Rashis',
    crumbs: [{ name: 'Learn', path: U.hub }, { name: 'Signs', path: U.signs }],
    body: [
      `        <p class="lede">Vedic astrology uses the sidereal zodiac, fixed to the stars. It sits about 24° behind the Western zodiac, so your Vedic Sun, Moon and rising sign are often one sign earlier than you expect.</p>`,
      cards(o, SIGNS.map((s) => ({ path: U.sign(s.id), title: `${s.name} · ${s.sanskrit}`, text: s.flavor, img: SIGN_ART(s.number), alt: '' }))),
    ].join('\n'),
  }));
  return out;
}

function planetPages(o: LearnOptions): LearnPage[] {
  const a = linkFor(o);
  const out: LearnPage[] = [];
  PLANET_LIST.forEach((id, i) => {
    const p = P(id);
    const prev = P(PLANET_LIST[(i + 8) % 9]);
    const next = P(PLANET_LIST[(i + 1) % 9]);
    const signName = (n: number) => a(U.sign(SIGN_BY_NUM(n).id), SIGN_BY_NUM(n).name);
    const names = (ids: PlanetId[]) => (ids.length ? ids.map((x) => a(U.planet(x), P(x).name)).join(', ') : 'none');
    const body = [
      art(o, GRAHA_ART(id), `Rendered artwork of ${label(p)} as a glowing sphere`),
      `        <p class="lede">${esc(cap(p.name))} stands for ${esc(p.essence)}. Well placed, it gives ${esc(p.highExpression)}. Under strain, it shows as ${esc(p.lowExpression)}.</p>`,
      facts([
        ['Sanskrit name', esc(p.sanskrit)],
        ['Signifies', esc(p.significations.join(', '))],
        ['Body', esc(p.body.join(', '))],
        ['Nature', esc(p.nature === 'variable' ? 'Benefic or malefic depending on its condition' : `Natural ${p.nature}`)],
        ...(p.ownSigns.length ? [['Rules', p.ownSigns.map(signName).join(' and ')] as [string, string]] : []),
        ...(p.exaltation ? [['Exalted in', `${signName(p.exaltation.sign)}, deepest at ${p.exaltation.degree}°`] as [string, string]] : []),
        ...(p.debilitation ? [['Debilitated in', `${signName(p.debilitation.sign)}, deepest at ${p.debilitation.degree}°`] as [string, string]] : []),
        ['Friends', names(p.friends)],
        ['Enemies', names(p.enemies)],
        ['Full aspects', esc(p.aspects.map((h) => `${ordinal(h)} house`).join(', ') + ' from itself')],
        ['Mahadasha', `${p.dashaYears} years in the Vimshottari cycle`],
        ['Day', esc(p.day)],
        ['Mantra', esc(p.mantra)],
      ]),
      `        <p class="fine">The tradition pairs ${esc(p.name)} with ${esc(p.gemstone)}. You do not need to buy anything to work with a planet; gemstones are a traditional option, not a requirement, and are best weighed with someone who has read your whole chart.</p>`,
      `        <h2>${esc(p.name)} in each sign</h2>`,
      `        <ul class="lt-list">${SIGNS.map((s, k) => `<li>${a(U.inSign(id, s), `${p.name} in ${s.name}`)}: ${esc(PLANET_IN_SIGN[id][k][0].replace(/^[^:]*:\s*/, ''))}</li>`).join('')}</ul>`,
      `        <h2>${esc(p.name)} in each house</h2>`,
      `        <ul class="lt-list">${HOUSES.map((h) => `<li>${a(U.inHouse(id, h.number), `${p.name} in the ${ordinal(h.number)} house`)}: ${esc(PLANET_IN_HOUSE[id][h.number - 1][0].replace(/^[^:]*:\s*/, ''))}</li>`).join('')}</ul>`,
      prevNext(o, { name: prev.name, path: U.planet(prev.id) }, { name: next.name, path: U.planet(next.id) }),
    ].join('\n');
    out.push(page(o, {
      path: U.planet(id),
      title: `${label(p)} in Vedic astrology: meaning, signs and houses · Jyotisha Explorer`,
      description: clip(`${p.name} (${SKT(p)}) signifies ${listText(p.significations.slice(0, 4))}. Its signs of strength and weakness, friends, aspects, ${p.dashaYears}-year dasha, and ${p.name} in every sign and house.`),
      h1: `${label(p)} in Vedic astrology`,
      eyebrow: 'Graha',
      crumbs: [{ name: 'Learn', path: U.hub }, { name: 'Planets', path: U.planets }, { name: p.name, path: U.planet(id) }],
      image: GRAHA_ART(id),
      body,
      tryText: `See where ${p.name} is in your chart, how strong it is, and when your ${p.name} periods fall.`,
    }));

    // planet in each sign
    SIGNS.forEach((s, k) => {
      const [summary, detail, strengths, challenges] = PLANET_IN_SIGN[id][k];
      const d = dignityIn(p, s.number);
      const ps = SIGNS[(k + 11) % 12];
      const ns = SIGNS[(k + 1) % 12];
      out.push(page(o, {
        path: U.inSign(id, s),
        title: `${p.name} in ${s.name} (${SKT(p)} in ${s.sanskrit}) in Vedic astrology · Jyotisha Explorer`,
        description: clip(`${summary} ${firstSentence(detail)}`),
        h1: `${p.name} in ${s.name}`,
        eyebrow: `${SKT(p)} in ${s.sanskrit}`,
        crumbs: [{ name: 'Learn', path: U.hub }, { name: 'Planets', path: U.planets }, { name: p.name, path: U.planet(id) }, { name: `In ${s.name}`, path: U.inSign(id, s) }],
        image: GRAHA_ART(id),
        body: [
          `        <p class="lede">${esc(summary)}</p>`,
          paras([detail]),
          facts([
            ['Planet', a(U.planet(id), `${p.name}: ${p.essence}`)],
            ['Sign', `${a(U.sign(s.id), s.name)}, ${esc(s.flavor)}, ruled by ${a(U.planet(s.lord), P(s.lord).name)}`],
            ...(d ? [['Dignity', esc(cap(d))] as [string, string]] : []),
          ]),
          twoCol(['Strengths', strengths], ['Watch for', challenges]),
          `        <p>The sign is only part of the story. The house ${esc(p.name)} falls in, its aspects and the dashas decide how and when this shows up.</p>`,
          prevNext(o, { name: `${p.name} in ${ps.name}`, path: U.inSign(id, ps) }, { name: `${p.name} in ${ns.name}`, path: U.inSign(id, ns) }),
        ].join('\n'),
        tryText: `See which sign ${p.name} is really in for you (the Vedic zodiac is about 24° behind the Western one) and read it alongside its house and aspects.`,
      }));
    });

    // planet in each house
    HOUSES.forEach((h) => {
      const [summary, detail, strengths, challenges] = PLANET_IN_HOUSE[id][h.number - 1];
      const ph = ((h.number + 10) % 12) + 1;
      const nh = (h.number % 12) + 1;
      out.push(page(o, {
        path: U.inHouse(id, h.number),
        title: `${p.name} in the ${ordinal(h.number)} house in Vedic astrology · Jyotisha Explorer`,
        description: clip(`${summary} ${firstSentence(detail)}`),
        h1: `${p.name} in the ${ordinal(h.number)} house`,
        eyebrow: `${SKT(p)} in ${h.sanskrit}`,
        crumbs: [{ name: 'Learn', path: U.hub }, { name: 'Planets', path: U.planets }, { name: p.name, path: U.planet(id) }, { name: `In the ${ordinal(h.number)} house`, path: U.inHouse(id, h.number) }],
        image: GRAHA_ART(id),
        body: [
          `        <p class="lede">${esc(summary)}</p>`,
          paras([detail]),
          facts([
            ['Planet', a(U.planet(id), `${p.name}: ${p.essence}`)],
            ['House', `${a(U.house(h.number), `${ordinal(h.number)} house (${h.sanskrit})`)}: ${esc(h.label)}`],
          ]),
          twoCol(['Strengths', strengths], ['Watch for', challenges]),
          `        <p>Houses here are counted whole-sign from the ascendant, the way most Vedic astrologers read them. The sign ${esc(p.name)} is in, and the planets aspecting it, change the picture.</p>`,
          prevNext(o, { name: `${p.name} in the ${ordinal(ph)}`, path: U.inHouse(id, ph) }, { name: `${p.name} in the ${ordinal(nh)}`, path: U.inHouse(id, nh) }),
        ].join('\n'),
        tryText: `Find out which house ${p.name} is in for you. It depends on your birth time, so the app works it out from the minute you were born.`,
      }));
    });
  });
  out.push(page(o, {
    path: U.planets,
    title: 'The nine grahas (planets) of Vedic astrology · Jyotisha Explorer',
    description: 'The nine grahas of Vedic astrology, Sun to Ketu: what each signifies, where it is strong or weak, its dasha length, and its meaning in all 12 signs and houses.',
    h1: 'The nine grahas',
    eyebrow: 'Planets',
    crumbs: [{ name: 'Learn', path: U.hub }, { name: 'Planets', path: U.planets }],
    body: [
      `        <p class="lede">Vedic astrology works with nine grahas: the Sun, the Moon, five visible planets and the two lunar nodes, Rahu and Ketu. Each one rules parts of life, and each takes its turn running a period of your life in the dasha system.</p>`,
      cards(o, PLANET_LIST.map((id) => ({ path: U.planet(id), title: label(P(id)), text: P(id).significations.slice(0, 3).join(', '), img: GRAHA_ART(id), alt: '' }))),
    ].join('\n'),
  }));
  return out;
}

function housePages(o: LearnOptions): LearnPage[] {
  const a = linkFor(o);
  const out: LearnPage[] = HOUSES.map((h) => {
    const ph = ((h.number + 10) % 12) + 1;
    const nh = (h.number % 12) + 1;
    return page(o, {
      path: U.house(h.number),
      title: `The ${ordinal(h.number)} house (${h.sanskrit}) in Vedic astrology · Jyotisha Explorer`,
      description: clip(`The ${ordinal(h.number)} house, ${h.sanskrit}, rules ${h.label}. ${firstSentence(h.description)} What each planet does here.`),
      h1: `The ${ordinal(h.number)} house: ${h.sanskrit}`,
      eyebrow: `House ${h.number} of 12`,
      crumbs: [{ name: 'Learn', path: U.hub }, { name: 'Houses', path: U.houses }, { name: `${ordinal(h.number)} house`, path: U.house(h.number) }],
      body: [
        `        <p class="lede">${esc(h.description)}</p>`,
        facts([
          ['Rules', esc(h.significations.join(', '))],
          ['Groups', esc(h.groups.join(', '))],
          ['Natural significators', h.karakas.map((k) => (k in PLANET_PROFILES ? a(U.planet(k as PlanetId), P(k as PlanetId).name) : esc(k))).join(', ')],
        ]),
        `        <h2>Each planet in the ${ordinal(h.number)} house</h2>`,
        `        <ul class="lt-list">${PLANET_LIST.map((p) => `<li>${a(U.inHouse(p, h.number), `${P(p).name} in the ${ordinal(h.number)}`)}: ${esc(PLANET_IN_HOUSE[p][h.number - 1][0].replace(/^[^:]*:\s*/, ''))}</li>`).join('')}</ul>`,
        prevNext(o, { name: `${ordinal(ph)} house`, path: U.house(ph) }, { name: `${ordinal(nh)} house`, path: U.house(nh) }),
      ].join('\n'),
      tryText: `See which sign falls in your ${ordinal(h.number)} house, who rules it and which planets sit there.`,
    });
  });
  out.push(page(o, {
    path: U.houses,
    title: 'The 12 houses (bhavas) of Vedic astrology · Jyotisha Explorer',
    description: 'The twelve houses of a Vedic birth chart, from the 1st (self) to the 12th (loss and liberation): what each rules and what every planet does there.',
    h1: 'The 12 houses',
    eyebrow: 'Bhavas',
    crumbs: [{ name: 'Learn', path: U.hub }, { name: 'Houses', path: U.houses }],
    body: [
      `        <p class="lede">The houses are the twelve areas of life: self, money, siblings, home, children, health, partnership, crisis, fortune, work, gains and release. Which sign falls in each depends on the exact minute you were born.</p>`,
      cards(o, HOUSES.map((h) => ({ path: U.house(h.number), title: `${ordinal(h.number)} house · ${h.sanskrit}`, text: h.label }))),
    ].join('\n'),
  }));
  return out;
}

function yogaPages(o: LearnOptions): LearnPage[] {
  const a = linkFor(o);
  const all = Object.values(YOGA_DEFINITIONS) as YogaDefinition[];
  const out: LearnPage[] = all.map((y) => {
    const r = y.reading;
    const same = all.filter((x) => x.category === y.category && x.id !== y.id);
    return page(o, {
      path: U.yoga(y.id),
      title: `${y.name} in Vedic astrology: rule, meaning and effects · Jyotisha Explorer`,
      description: clip(`${y.name}: ${r.summary} How it forms: ${y.rule}`),
      h1: y.name,
      eyebrow: YOGA_CATEGORY[y.category] ?? 'Yoga',
      crumbs: [{ name: 'Learn', path: U.hub }, { name: 'Yogas', path: U.yogas }, { name: y.name, path: U.yoga(y.id) }],
      body: [
        `        <p class="lede">${esc(r.summary)}</p>`,
        `        <h2>How it forms</h2>`,
        `        <p class="rule">${esc(y.rule)}</p>`,
        y.aka?.length ? `        <p class="fine">Also called ${esc(listText(y.aka))}.</p>` : '',
        `        <h2>What it means</h2>`,
        paras(r.detail),
        twoCol(['Strengths', r.strengths], ['Watch for', r.challenges]),
        `        <p>A yoga is only as strong as the planets that make it. A combination formed by weak, combust or debilitated planets gives a milder result, and many yogas only come to life during the dasha of a planet involved.</p>`,
        same.length ? `        <h2>Related yogas</h2>\n        <ul class="lt-inline">${same.map((x) => `<li>${a(U.yoga(x.id), x.name)}</li>`).join('')}</ul>` : '',
      ].filter(Boolean).join('\n'),
      tryText: `The app checks your chart for ${y.name} and ${all.length - 1} other yogas, and tells you exactly why each one forms or doesn't.`,
    });
  });
  const groups = Object.keys(YOGA_CATEGORY).map((c) => [c, all.filter((y) => y.category === c)] as const).filter(([, ys]) => ys.length);
  out.push(page(o, {
    path: U.yogas,
    title: `All ${all.length} yogas in Vedic astrology, with their rules · Jyotisha Explorer`,
    description: clip(`The ${all.length} yogas Jyotisha Explorer checks for: Raja, Dhana, the five Mahapurusha yogas, Gaja Kesari, Budha-Aditya, Viparita and more, each with its exact rule.`),
    h1: `${all.length} yogas, and how each one forms`,
    eyebrow: 'Yogas',
    crumbs: [{ name: 'Learn', path: U.hub }, { name: 'Yogas', path: U.yogas }],
    body: [
      `        <p class="lede">A yoga ("union") is a combination of planets that gives a result greater than its parts: status, wealth, learning, or a lesson. Here is every yoga the app looks for, grouped by kind.</p>`,
      ...groups.map(([c, ys]) => `        <h2>${esc(YOGA_CATEGORY[c])}</h2>\n${cards(o, ys.map((y) => ({ path: U.yoga(y.id), title: y.name, text: y.reading.summary })))}`),
    ].join('\n'),
  }));
  return out;
}

function doshaPages(o: LearnOptions): LearnPage[] {
  const a = linkFor(o);
  const all = Object.values(DOSHA_DEFINITIONS);
  const out: LearnPage[] = all.map((d) => {
    const r = d.reading;
    return page(o, {
      path: U.dosha(d.id),
      title: `${d.name}: meaning, rule and cancellations · Jyotisha Explorer`,
      description: clip(`${d.name}: ${r.summary} How it forms: ${d.rule}`),
      h1: d.name,
      eyebrow: 'Dosha',
      crumbs: [{ name: 'Learn', path: U.hub }, { name: 'Doshas', path: U.doshas }, { name: d.name, path: U.dosha(d.id) }],
      body: [
        `        <p class="lede">${esc(r.summary)}</p>`,
        `        <h2>How it forms</h2>`,
        `        <p class="rule">${esc(d.rule)}</p>`,
        d.aka?.length ? `        <p class="fine">Also called ${esc(listText(d.aka))}.</p>` : '',
        `        <h2>What it means</h2>`,
        paras(r.detail),
        twoCol(['What it can give', r.strengths], ['What it asks you to watch', r.challenges]),
        r.remedies?.length ? `        <h2>Traditional responses</h2>\n        ${bullets(r.remedies)}\n        <p class="fine">These are listed as the tradition gives them, for reference. None of them requires buying anything, and none replaces professional advice.</p>` : '',
        `        <p>A dosha is a reason for care, not a sentence. Most have classical cancellations, and the app checks them before it reports one. ${d.id === 'manglik' ? a('match/', 'Compare two charts for Manglik dosha') + '.' : ''}</p>`,
        `        <ul class="lt-inline">${all.filter((x) => x.id !== d.id).map((x) => `<li>${a(U.dosha(x.id), x.name)}</li>`).join('')}</ul>`,
      ].filter(Boolean).join('\n'),
      tryText: `The app checks your chart for ${d.name}, applies its cancellations, and tells you plainly whether it holds.`,
    });
  });
  out.push(page(o, {
    path: U.doshas,
    title: 'Doshas in Vedic astrology: Manglik, Kaal Sarp, Gandanta and more · Jyotisha Explorer',
    description: 'The nine doshas Jyotisha Explorer checks for, including Manglik, Kaal Sarp, Pitra and Gandanta: how each forms, what it means, and how it is cancelled.',
    h1: 'Doshas, and how they are cancelled',
    eyebrow: 'Doshas',
    crumbs: [{ name: 'Learn', path: U.hub }, { name: 'Doshas', path: U.doshas }],
    body: [
      `        <p class="lede">A dosha ("fault") is a combination that asks for care. They are far more common, and far more often cancelled, than a frightening reading suggests.</p>`,
      cards(o, all.map((d) => ({ path: U.dosha(d.id), title: d.name, text: d.reading.summary }))),
    ].join('\n'),
  }));
  return out;
}

interface GlossaryEntry { term: string; text: string; link?: string }

/** Every term on the glossary page: the written definitions plus one entry per graha, sign, nakshatra, house, yoga and dosha. */
export function glossaryEntries(): GlossaryEntry[] {
  const map = new Map<string, GlossaryEntry>();
  const add = (e: GlossaryEntry) => {
    const k = e.term.toLowerCase();
    const had = map.get(k);
    if (had) had.link ??= e.link;
    else map.set(k, e);
  };
  for (const [term, text] of [...TERMS, ...MORE_TERMS]) add({ term, text });
  const attach = (term: string, link: string) => { const e = map.get(term.toLowerCase()); if (e) { e.link ??= link; return true; } return false; };
  for (const id of PLANET_LIST) {
    const p = P(id);
    // Rahu and Ketu are the same word in both languages and already have a written entry.
    if (SKT(p) === p.name && attach(p.name, U.planet(id))) continue;
    add({ term: `${SKT(p)} (${p.name})`, text: `The graha of ${p.essence}.`, link: U.planet(id) });
  }
  for (const s of SIGNS) add({ term: `${s.sanskrit} (${s.name})`, text: `A ${s.modality} ${s.element} sign ruled by ${P(s.lord).name}. ${firstSentence(s.description)}`, link: U.sign(s.id) });
  for (const n of NAKSHATRAS) add({ term: n.name, text: `Nakshatra ${n.number}, ruled by ${P(n.lord).name}. ${firstSentence(n.description)}`, link: U.nak(n.id) });
  for (const h of HOUSES) add({ term: `${h.sanskrit} (${ordinal(h.number)} house)`, text: `The house of ${h.label}.`, link: U.house(h.number) });
  for (const y of Object.values(YOGA_DEFINITIONS) as YogaDefinition[]) add({ term: y.name, text: y.reading.summary, link: U.yoga(y.id) });
  for (const d of Object.values(DOSHA_DEFINITIONS)) add({ term: d.name, text: d.reading.summary, link: U.dosha(d.id) });
  // Words that already have a page of their own.
  attach('Nakshatra', U.naks); attach('Rashi', U.signs); attach('Bhava', U.houses); attach('Graha', U.planets); attach('Yoga', U.yogas); attach('Dosha', U.doshas);
  attach('Gandanta', U.dosha('gandanta'));
  return [...map.values()].sort((x, y) => x.term.localeCompare(y.term, 'en', { sensitivity: 'base' }));
}

function glossaryPage(o: LearnOptions): LearnPage {
  const a = linkFor(o);
  const entries = glossaryEntries();
  const letters = [...new Set(entries.map((e) => e.term[0].toUpperCase()))];
  const sections = letters.map((L) => {
    const es = entries.filter((e) => e.term[0].toUpperCase() === L);
    return `        <section aria-labelledby="g-${L}">\n          <h2 id="g-${L}">${L}</h2>\n          <dl class="gloss">${es
      .map((e) => `<div id="${slug(e.term)}"><dt>${e.link ? a(e.link, e.term) : esc(e.term)}</dt><dd>${esc(e.text)}</dd></div>`)
      .join('')}</dl>\n        </section>`;
  });
  return page(o, {
    path: U.glossary,
    title: `Vedic astrology glossary: ${entries.length} Sanskrit terms explained · Jyotisha Explorer`,
    description: clip(`${entries.length} Jyotish terms in plain English, from Abhijit to Yogini dasha: dashas, nakshatras, kootas, doshas, Sade Sati, Gandanta, Chandrashtama and more.`),
    h1: 'Vedic astrology glossary',
    eyebrow: `${entries.length} terms`,
    crumbs: [{ name: 'Learn', path: U.hub }, { name: 'Glossary', path: U.glossary }],
    ld: [{
      '@context': 'https://schema.org', '@type': 'DefinedTermSet', name: 'Vedic astrology glossary', url: SITE + U.glossary,
      hasDefinedTerm: entries.map((e) => ({ '@type': 'DefinedTerm', name: e.term, description: e.text, url: `${SITE}${U.glossary}#${slug(e.term)}` })),
    }],
    body: [
      `        <p class="lede">The Sanskrit words you will meet in a Vedic chart, each explained the way an astrologer uses it. Terms with their own page are linked.</p>`,
      `        <nav class="az" aria-label="Letters">${letters.map((L) => `<a href="#g-${L}">${L}</a>`).join('')}</nav>`,
      ...sections,
    ].join('\n'),
  });
}

function hubPage(o: LearnOptions): LearnPage {
  const a = linkFor(o);
  return page(o, {
    path: U.hub,
    title: 'Learn Vedic astrology: nakshatras, signs, planets, houses and yogas · Jyotisha Explorer',
    description: 'A plain-English guide to Vedic astrology: the 27 nakshatras, 12 signs, nine grahas, 12 houses, 44 yogas, the doshas and a glossary of Sanskrit terms.',
    h1: 'Learn Vedic astrology',
    eyebrow: 'Jyotisha, in plain English',
    crumbs: [{ name: 'Learn', path: U.hub }],
    body: [
      `        <p class="lede">Everything the app reads in your chart, written out so you can read it too. Start anywhere.</p>`,
      cards(o, [
        { path: U.naks, title: 'The 27 nakshatras', text: 'The lunar mansions. Your birth star sets your dasha timeline.', img: NAK_ART(1), alt: '' },
        { path: U.signs, title: 'The 12 signs', text: 'The sidereal zodiac, and why your Vedic sign may differ from your Western one.', img: SIGN_ART(1), alt: '' },
        { path: U.planets, title: 'The nine grahas', text: 'Sun to Ketu, in every sign and every house.', img: GRAHA_ART('sun'), alt: '' },
        { path: U.houses, title: 'The 12 houses', text: 'The areas of life, from self to liberation.' },
        { path: U.yogas, title: 'The 44 yogas', text: 'Combinations for status, wealth, learning and more, with their exact rules.' },
        { path: U.doshas, title: 'The doshas', text: 'Manglik, Kaal Sarp and the others, and how each is cancelled.' },
        { path: U.glossary, title: 'Glossary', text: 'Every Sanskrit term, from Abhijit to Yogini dasha.' },
      ]),
      `        <h2>Questions people ask</h2>`,
      `        <ul class="lt-list">
          <li>${a(U.glossary + '#sade-sati', 'What is Sade Sati, and when does mine end?')} The app finds your exact Sade Sati dates from your Moon sign.</li>
          <li>${a(U.dosha('manglik'), 'Am I Manglik?')} Most charts have some Mars emphasis, and most of it is cancelled.</li>
          <li>${a(U.dosha('gandanta'), 'What is Gandanta?')} The knot between a water sign and a fire sign.</li>
          <li>${a('match/', 'How does kundali matching work?')} The eight kootas, out of 36 gunas, with no sign-up.</li>
          <li>${a(U.house(7), 'What does my 7th house say about marriage?')}</li>
          <li>${a(U.planet('saturn'), 'What does Saturn mean in my chart?')}</li>
        </ul>`,
    ].join('\n'),
    tryText: 'Reading about it is one thing. Enter your birth details and every page here lights up with your own placements.',
  });
}

function page(o: LearnOptions, s: PageSpec): LearnPage {
  return { file: `${s.path}index.html`, html: shell(o, s) };
}

/** Every learn page, ready to write. */
export function learnPages(o: LearnOptions): LearnPage[] {
  return [hubPage(o), ...nakshatraPages(o), ...signPages(o), ...planetPages(o), ...housePages(o), ...yogaPages(o), ...doshaPages(o), glossaryPage(o)];
}

/** learn/sitemap.xml for the given pages. robots.txt points at it. */
export function learnSitemap(pages: LearnPage[]): string {
  const urls = pages.map((p) => `  <url><loc>${SITE}${p.file.replace(/index\.html$/, '')}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
