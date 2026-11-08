# PDF report

The illustrated PDF behind **Download PDF report** and **Consultation export**. It is made entirely in the browser with jsPDF, as its own lazily loaded chunk, so nothing about a person's chart leaves their machine.

- `index.ts`: `generateReport(chart, options)` and `downloadReport`. Options pick the sections, add the astrologer's `brand` (name, practice, tagline, contact, logo) and, for a consultation, a personal `note`. The brand comes from the one "Your branding" setting in `src/lib/branding.ts`, which also feeds the yearly PDF (`yearTimeline.ts`) and the Life Chart Book (`book/`). A branded `ReportDoc` prints the name and contact details at the foot of every numbered page.
- `doc.ts`: a small flow-layout layer (headings, wrapping paragraphs across pages and columns, callouts, tables, chapter openers, running heads and folios).
- `charts.ts`: vector North and South Indian charts, the Blender wheel with each graha at its longitude, the life weather chart, dasha band and ashtakavarga bars.
- `assets.ts`: loads the Blender art from `assets/3d` and flattens it to JPEG for the page it sits on.
- `fonts/`: Cormorant Garamond and Inter as TTF (jsPDF embeds TrueType only), latin subsets under the SIL OFL. `fonts/indic/` holds Noto Serif and Noto Sans for Devanagari, Bengali, Gujarati, Tamil, Telugu and Kannada (two weights each, subset to the script with every layout feature kept).
- `indic.ts`: Indian scripts. jsPDF does no shaping, so each Indic run is shaped with HarfBuzz (`harfbuzzjs`, loaded only when needed) and drawn glyph by glyph in the matching Noto face; Latin text keeps the report's own faces, so mixed lines work. `doc.ts` does this for you in `line`, `wrap` and `width`, so sections need nothing special. Fonts are fetched for the app's language and for any script in the name, place, note or brand; text in a script with no font loaded is dropped rather than printed as boxes.

The app passes its language as `locale`: readings print in it when a translation exists (Hindi today), otherwise in English. The report's own headings and explanations are still English.
- `sections/`: one file per chapter.

## The Life Chart Book

`book/` builds a much longer book from the same pieces, for an astrologer to give a client. It sits beside the report and the consultation export and changes neither.

- `book/draft.ts`: what the astrologer writes (title, dedication, letters, key points, notes keyed `chapter:<id>`, `graha:<id>`, `house:<n>`, `yoga:<id>`, `dosha:<id>`, `remedy:<id>`, `year:<yyyy>`) and the format options. No PDF dependencies; the editor in `components/LifeChartBook.tsx` imports it eagerly and keeps one draft per birth in `localStorage`.
- `book/index.ts`: `generateBook` and `downloadBook`. It reuses the report's own chapters (glance, grahas, houses, yogas, vargas, dasha, timing, glossary) and adds the book's: front matter (`front.ts`), the teaching chapters on the language of the chart, the lagna and the Moon (`teach.ts`), the dasha wall chart and the year-by-year forecast (`forecast.ts`), remedies from `@vedic/remedies` with numbered sources (`remedies.ts`) and the sources chapter, closing letter, notes pages and covers (`back.ts`).
- Astrologer notes reach the reused chapters through `ctx.annotate(doc, key)`, which the report leaves unset.
- Print edition: `ReportDoc` takes `{ bleed, recto }`. With a bleed every page is shifted so layout keeps its trim coordinates and full-page backgrounds run past the trim; with `recto` each chapter opener lands on a right-hand page, the left-hand page before it filled by `doc.filler` (a ruled notes page) or left blank. The interior is padded to a multiple of four pages, and `coverSpread` draws back cover, spine and front cover on one sheet. The spine width is Lulu's paperback estimate unless the astrologer types the one from their printer's template.

## Adding a section from another feature

Register it from your feature's own code. `registry.ts` has no PDF dependencies, so importing it costs nothing:

```ts
import { registerReportSection } from '../report/registry';

registerReportSection({
  id: 'shadbala',
  title: 'Planet strength',            // shown in the consultation picker
  blurb: 'Shadbala and bhava bala scores',
  order: 810,                          // 800–899 sit after the timing chapter, before the glossary
  chapter: true,                       // gets the next roman numeral
  render(doc, ctx, h) {
    doc.chapter({ numeral: h.numeral, kicker: 'Strength', title: 'Planet strength', art: ctx.art.cosmos, intro: '…' });
    doc.h2('Shadbala', { toc: true });
    doc.table([...], [...]);
    ctx.glossary.set('Shadbala', '…');  // terms land in the glossary automatically
  },
});
```

`ctx` carries the UI chart, the live engine and its full chart (`ctx.engine`, `ctx.engineChart`), every interpretation, the scored dashas and the timeline. Registered sections appear in the full report and in the consultation picker. A section that throws is skipped and logged, so one bug never costs someone the whole report.

## Checking a change

`npm run smoke` builds nothing itself but, after `npm run build:pages`, downloads a report and a Life Chart Book from the sample chart and checks they are real PDFs. To look at the pages, save one from the app and run `pdftoppm -r 60 -png report.pdf page`.
