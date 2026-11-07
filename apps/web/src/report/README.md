# PDF report

The illustrated PDF behind **Download PDF report** and **Consultation export**. It is made entirely in the browser with jsPDF, as its own lazily loaded chunk, so nothing about a person's chart leaves their machine.

- `index.ts`: `generateReport(chart, options)` and `downloadReport`. Options pick the sections, and for a consultation add the astrologer's `brand` (name, tagline, contact, logo) and a personal `note`.
- `doc.ts`: a small flow-layout layer (headings, wrapping paragraphs across pages and columns, callouts, tables, chapter openers, running heads and folios).
- `charts.ts`: vector North and South Indian charts, the Blender wheel with each graha at its longitude, the life weather chart, dasha band and ashtakavarga bars.
- `assets.ts`: loads the Blender art from `assets/3d` and flattens it to JPEG for the page it sits on.
- `fonts/`: Cormorant Garamond and Inter as TTF (jsPDF embeds TrueType only), latin subsets under the SIL OFL. `fonts/indic/` holds Noto Serif and Noto Sans for Devanagari, Bengali, Gujarati, Tamil, Telugu and Kannada (two weights each, subset to the script with every layout feature kept).
- `indic.ts`: Indian scripts. jsPDF does no shaping, so each Indic run is shaped with HarfBuzz (`harfbuzzjs`, loaded only when needed) and drawn glyph by glyph in the matching Noto face; Latin text keeps the report's own faces, so mixed lines work. `doc.ts` does this for you in `line`, `wrap` and `width`, so sections need nothing special. Fonts are fetched for the app's language and for any script in the name, place, note or brand; text in a script with no font loaded is dropped rather than printed as boxes.

The app passes its language as `locale`: readings print in it when a translation exists (Hindi today), otherwise in English. The report's own headings and explanations are still English.
- `sections/`: one file per chapter.

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

`npm run smoke` builds nothing itself but, after `npm run build:pages`, downloads a report from the sample chart and checks it is a real PDF. To look at the pages, save one from the app and run `pdftoppm -r 60 -png report.pdf page`.
