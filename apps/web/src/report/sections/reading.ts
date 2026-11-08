import type { ReportDoc } from '../doc';
import { C, F } from '../theme';
import type { ClientReading, ReportContext } from '../types';

const paragraphs = (t: string) => t.trim().split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);

/** Every piece of text in a reading, so the right script fonts are embedded. */
export const readingText = (r?: ClientReading) => (r ? [r.title, r.intro, ...r.sections.flatMap((s) => [s.heading, s.text])] : []);

/** The astrologer's own reading, from one of their templates: their headings, their words. Empty sections are left out. */
export function clientReading(doc: ReportDoc, ctx: ReportContext) {
  const r = ctx.reading;
  const sections = r?.sections.filter((s) => s.text.trim()) ?? [];
  if (!r || !sections.length) return;
  const title = r.title.trim() || 'Your reading';
  doc.newPage();
  doc.setRunning(title);
  doc.h2(title, { kicker: ctx.brand ? `A reading by ${ctx.brand.name}` : 'Your reading', toc: true });
  if (r.intro?.trim()) paragraphs(r.intro).forEach((p) => doc.para(p, { font: F.serifItalic, size: 12, leading: 1.45, color: C.muted, after: 8 }));
  for (const s of sections) {
    doc.h3(s.heading.trim() || ' ', { keep: 50 });
    paragraphs(s.text).forEach((p) => doc.para(p, { font: F.serif, size: 11.6, leading: 1.5, color: C.body, after: 8 }));
    doc.space(6);
  }
}
