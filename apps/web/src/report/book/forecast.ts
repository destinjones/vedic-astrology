import { HOUSE_TOPICS, SATURN_PHASE_TEXT, type Ephemeris, type Planet } from '@vedic/timing';
import { PLANET_BY_ID, signInfo } from '../../data/constants';
import type { ReportDoc } from '../doc';
import { ageAt, fromTiming, list, monthYear, ordinal, shortDate, toneWord } from '../format';
import { C, CONTENT_W, F, MARGIN } from '../theme';
import type { SectionHelpers } from '../types';
import { DASHA_FLAVOR } from '../sections/dasha';
import { astrologerNote, type BookContext, lesson, prose, sources } from './common';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BPHS = 'Brihat Parashara Hora Shastra (BPHS)';
const tc = (s: number) => (s >= 15 ? C.good : s <= -15 ? C.bad : C.mixed);
const name = (p: string) => PLANET_BY_ID[fromTiming(p)].name;
const signOf = (lon: number) => Math.floor((((lon % 360) + 360) % 360) / 30) + 1;
const houseFrom = (from: number, sign: number) => ((sign - from + 12) % 12) + 1;

/** Jupiter's transit counted from the natal Moon, in the spirit of the classical gochara chapters. */
const JUPITER_FROM_MOON: Record<number, string> = {
  1: 'Jupiter over your Moon (janma guru): a year of new beginnings and moves, though the texts warn it can feel unsettled and costly.',
  2: 'one of Jupiter\'s best positions: money, family life and your words carry more weight.',
  3: 'a modest position: effort meets delays, and a change of role or place is common.',
  4: 'a mixed position: home and family need attention, and peace of mind takes work.',
  5: 'one of Jupiter\'s best positions: children, creativity, study and romance flourish, and good counsel arrives.',
  6: 'a testing position: rivals, debts and health ask for care, though service and hard work pay.',
  7: 'one of Jupiter\'s best positions: partnership, marriage, agreements and journeys are favoured.',
  8: 'a testing position: fatigue, hidden worries and slow progress; a year for depth rather than display.',
  9: 'one of Jupiter\'s best positions: fortune, teachers, faith and long journeys open up.',
  10: 'a mixed position: career changes and pressure on status; avoid overreaching.',
  11: 'one of Jupiter\'s best positions: gains, recognition and wishes fulfilled, through friends and networks.',
  12: 'a costly position: expenses, travel and retreat; generosity and inner work go well.',
};
const SATURN_FROM_MOON: Record<number, string> = {
  1: 'Saturn over your Moon, the peak of Sade Sati: emotional weight, responsibility and deep maturing.',
  2: 'the setting phase of Sade Sati: finances, family and speech need care, and things start to ease.',
  3: 'one of Saturn\'s best positions: courage, steady effort and success over obstacles.',
  4: 'Kantaka (Ardhashtama) Shani: home, property and peace of mind need patience.',
  5: 'a demanding position: worries about children or creative work, and judgement needs checking.',
  6: 'one of Saturn\'s best positions: rivals fall away, health and work routines strengthen.',
  7: 'a demanding position: partnerships are tested and travel is tiring; commitments mature.',
  8: 'Ashtama Shani: a slow, heavy stretch; protect health and avoid risk.',
  9: 'a demanding position: luck and support feel thin; keep faith with long-term work.',
  10: 'a mixed position: heavy work and responsibility at work, rewarded later rather than now.',
  11: 'one of Saturn\'s best positions: steady gains and the reward of earlier effort.',
  12: 'the rising phase of Sade Sati: expenses and sleep need care, and the old order loosens.',
};

// ------------------------------------------------------------------ dasha wall chart

/** Every mahadasha and antardasha of a lifetime, as a reference to pin up. */
export function wallChart(doc: ReportDoc, ctx: BookContext) {
  const { dashas, now } = ctx;
  const birth = new Date(ctx.engineChart.meta.utc);
  const end = new Date(birth.getTime() + 100 * 3.15576e10);
  doc.newPage();
  doc.setRunning('Your life in periods');
  doc.h2('Your life in periods', { kicker: 'A wall chart of every dasha', toc: true });
  doc.para('Every mahadasha and antardasha from your birth to your hundredth year. The row in gold is running now. Tones are how supportive each period is for your chart: green supportive, gold mixed, terracotta demanding.', { size: 8.6, color: C.muted, after: 10 });
  doc.columns(2, 20);
  for (const m of dashas.filter((d) => d.start < end && d.end > birth)) {
    const kids = (m.children ?? []).filter((k) => k.end > birth && k.start < end);
    doc.ensure(40 + Math.min(4, kids.length) * 13);
    const live = m.start <= now && now < m.end;
    const top = doc.y;
    doc.fill(live ? C.gold : C.ink).pdf.rect(doc.x, top, doc.w, 20, 'F');
    doc.line(`${name(m.lord).toUpperCase()} MAHADASHA`, doc.x + 7, top + 6, { font: F.sansBold, size: 7.2, color: '#FFFFFF', charSpace: 1 });
    doc.line(`${m.start.getUTCFullYear()}–${m.end.getUTCFullYear()} · age ${Math.max(0, ageAt(birth, m.start))}–${ageAt(birth, m.end)}`, doc.x + doc.w - 7, top + 6.5, { font: F.sans, size: 7, color: C.goldPale, align: 'right' });
    doc.y = top + 24;
    for (const k of kids) {
      if (doc.y + 13 > doc.bottom) doc.breakFrame();
      const now2 = k.start <= now && now < k.end;
      if (now2) doc.fill(C.goldPale).pdf.rect(doc.x, doc.y - 1.5, doc.w, 13, 'F');
      doc.fill(tc(k.score)).pdf.circle(doc.x + 5, doc.y + 4.6, 2.2, 'F');
      doc.line(`${PLANET_BY_ID[fromTiming(m.lord)].abbr}–${name(k.lord)}`, doc.x + 13, doc.y, { font: now2 ? F.sansBold : F.sans, size: 7.6, color: C.ink });
      doc.line(`${monthYear(k.start)} – ${monthYear(k.end)}`, doc.x + doc.w - 4, doc.y, { font: F.sans, size: 7.4, color: C.muted, align: 'right' });
      doc.y += 13;
    }
    doc.y += 9;
  }
  doc.endColumns();
}

// ------------------------------------------------------------------ year by year

export function forecast(doc: ReportDoc, ctx: BookContext, h: SectionHelpers, eph: Ephemeris | null) {
  const { chart, dashas, now } = ctx;
  const t = ctx.forecast;
  const birth = new Date(ctx.engineChart.meta.utc);
  const moonSign = chart.planets.find((p) => p.id === 'moon')!.sign;
  const ascSign = chart.ascendant.sign;
  const y0 = now.getUTCFullYear();
  const years = Array.from({ length: ctx.draft.years }, (_, i) => y0 + i);
  doc.chapter({
    numeral: h.numeral, kicker: 'Part three · the years ahead', title: `${ctx.draft.years === 10 ? 'Ten' : 'Five'} years, one by one`, art: ctx.art.cosmos,
    intro: `A year-by-year guide from ${y0} to ${y0 + years.length - 1}: which planetary period you are in, where the two great slow planets are moving, and which months look supportive or demanding. Come back to it each birthday.`,
  });

  lesson(doc, 'How a year is read');
  prose(doc, [
    'Two clocks run at once. The dasha clock, set at birth, says which planet\'s promises come forward; it is the "what". The transits (gochara), the planets moving through the sky now, say when those promises are triggered; they are the "when". A good dasha with poor transits still delivers, slowly. A hard dasha with good transits gives relief and openings.',
    'Of the transits, Jupiter and Saturn matter most because they move slowly: Jupiter spends about a year in each sign, Saturn about two and a half. The classical texts count their effect from your Moon sign, and they name the houses from the Moon where each one does well: for Jupiter the 2nd, 5th, 7th, 9th and 11th; for Saturn the 3rd, 6th and 11th. Each year below says where they are.',
    'The month strip for each year comes from this book\'s weekly forecast score, which combines the dasha running that week with the transits, measured against your own chart\'s average. Read it as emphasis, not as a verdict.',
  ]);
  sources(doc, ctx, [['Phaladeepika', 'chapter 26, on gochara (the results of transits counted from the Moon)'], [BPHS, 'on the Vimshottari dasha and the effects of antardashas']]);

  for (const Y of years) {
    const from = new Date(Date.UTC(Y, 0, 1));
    const to = new Date(Date.UTC(Y + 1, 0, 1));
    doc.newPage();
    doc.setRunning(`The years ahead · ${Y}`);
    const turns = Y - birth.getUTCFullYear();
    doc.h2(String(Y), { kicker: turns > 0 ? `The year you turn ${turns}` : 'Your year', toc: true });

    // the periods running
    const mahas = dashas.filter((d) => d.start < to && d.end > from);
    const antars = mahas.flatMap((m) => (m.children ?? []).filter((k) => k.start < to && k.end > from));
    if (mahas.length) {
      const mh = mahas[0];
      const mid = fromTiming(mh.lord);
      doc.para(mahas.length > 1
        ? `This year the ${name(mahas[0].lord)} mahadasha hands over to ${name(mahas[1].lord)} in ${monthYear(mahas[1].start)}: a change of chapter. ${name(mahas[1].lord)} brings ${DASHA_FLAVOR[fromTiming(mahas[1].lord)]}.`
        : `The whole year sits inside your ${name(mh.lord)} mahadasha (until ${monthYear(mh.end)}), with its emphasis on ${DASHA_FLAVOR[mid]}.`,
      { font: F.serif, size: 12, leading: 1.45, color: C.ink, after: 6 });
      if (antars.length) {
        doc.bullets(antars.map((k) => {
          const mp = k.path?.[0] ?? mh.lord;
          return `${name(mp)}–${name(k.lord)} sub-period, ${shortDate(k.start < from ? from : k.start)} to ${shortDate(k.end > to ? new Date(to.getTime() - 864e5) : k.end)}: ${toneWord(k.score).toLowerCase()} (${k.score > 0 ? '+' : ''}${k.score}). ${k.themes.slice(0, 2).map((th) => `${ordinal(th.house)} house: ${th.topic}`).join('; ')}.`;
        }), { size: 8.8 });
      }
    }

    // month strip
    if (t) {
      const months = Array.from({ length: 12 }, (_, mi) => {
        const a = Date.UTC(Y, mi, 1);
        const b = Date.UTC(Y, mi + 1, 1);
        const pts = t.series.filter((p) => p.date.getTime() >= a && p.date.getTime() < b);
        return pts.length ? Math.round(pts.reduce((s, p) => s + p.combined, 0) / pts.length) : null;
      });
      const known = months.filter((v): v is number => v !== null);
      if (known.length) {
        doc.ensure(70);
        doc.label('Month by month', { after: 2 });
        const cw = CONTENT_W / 12;
        const top = doc.y;
        months.forEach((v, mi) => {
          const x = MARGIN.left + mi * cw;
          doc.fill(v === null ? C.paperDeep : tc(v)).opacity(v === null ? 1 : 0.25 + Math.min(0.6, Math.abs(v) / 60)).pdf.rect(x + 1, top, cw - 2, 26, 'F');
          doc.opacity(1);
          doc.line(MON[mi], x + cw / 2, top + 5, { font: F.sansBold, size: 7, color: C.ink, align: 'center' });
          doc.line(v === null ? '' : `${v > 0 ? '+' : ''}${v}`, x + cw / 2, top + 15, { font: F.sans, size: 6.6, color: C.ink, align: 'center' });
        });
        doc.y = top + 34;
        const best = months.indexOf(Math.max(...known));
        const worst = months.indexOf(Math.min(...known));
        const avg = Math.round(known.reduce((s, v) => s + v, 0) / known.length);
        doc.para(`Overall the year reads as ${toneWord(avg).toLowerCase()} (${avg > 0 ? '+' : ''}${avg}). The most supportive month looks like ${MONTH[best]}; the one asking most care, ${MONTH[worst]}.`, { size: 9.2 });
      }
    }

    // Jupiter and Saturn
    if (eph) {
      doc.h3('Jupiter and Saturn this year', { keep: 90 });
      for (const p of ['Jupiter', 'Saturn'] as Planet[]) {
        const s0 = signOf(eph.positions(new Date(Date.UTC(Y, 0, 1)))[p].longitude);
        const moves = (t?.ingresses ?? []).filter((i) => i.planet === p && i.date >= from && i.date < to);
        const text = p === 'Jupiter' ? JUPITER_FROM_MOON : SATURN_FROM_MOON;
        const hm = houseFrom(moonSign, s0);
        const hl = houseFrom(ascSign, s0);
        let s = `${p} begins the year in ${signInfo(s0).name}, the ${ordinal(hm)} from your Moon and your ${ordinal(hl)} house (${HOUSE_TOPICS[hl]}): ${text[hm]}`;
        for (const mv of moves) {
          const to1 = mv.toSign + 1; // the timing package counts signs from 0
          const m2 = houseFrom(moonSign, to1);
          s += ` On ${shortDate(mv.date)} it ${mv.retrograde ? 'moves back' : 'moves on'} into ${signInfo(to1).name}, the ${ordinal(m2)} from your Moon and ${ordinal(houseFrom(ascSign, to1))} house: ${text[m2]}`;
        }
        doc.para(s, { size: 9.2, after: 6 });
      }
    }

    // Saturn phases, windows, retrogrades
    const phases = (t?.saturn.phases ?? []).filter((ph) => ph.start < to && ph.end > from);
    if (phases.length) {
      doc.callout({
        label: 'Saturn\'s long cycle',
        body: phases.map((ph) => `${shortDate(ph.start < from ? from : ph.start)} – ${shortDate(ph.end > to ? new Date(to.getTime() - 864e5) : ph.end)}: ${SATURN_PHASE_TEXT[ph.kind]}`),
        edge: C.bad, tint: C.badPale, size: 8.6,
      });
    }
    const wins = (t?.windows ?? []).filter((w) => w.start < to && w.end > from);
    if (wins.length) {
      doc.label('Windows worth marking', { after: 1 });
      doc.bullets(wins.slice(0, 6).map((w) => `${shortDate(w.start)} – ${shortDate(w.end)}: ${w.tone === 'favourable' ? 'supportive' : 'demanding'}${w.drivers.length ? `, ${w.drivers.slice(0, 2).join('; ')}` : ''}.`), { size: 8.6, mark: C.gold });
    }
    const retro = (t?.retrogrades ?? []).filter((r) => r.stationRetrograde >= from && r.stationRetrograde < to && ['Mercury', 'Venus', 'Mars'].includes(r.planet));
    if (retro.length) doc.para(`Retrogrades: ${list(retro.map((r) => `${r.planet} from ${shortDate(r.stationRetrograde)}${r.stationDirect ? ` to ${shortDate(r.stationDirect)}` : ''}`))}. Good times to review, repair and finish rather than launch.`, { size: 8.6, color: C.muted });

    astrologerNote(doc, ctx, `year:${Y}`);
    if (doc.room > 110) {
      doc.label('For reflection', { after: 2 });
      const lord = antars.length ? name(antars[antars.length - 1].lord) : mahas.length ? name(mahas[0].lord) : 'the year';
      doc.para(`At the end of ${Y}, look back: where did ${lord}'s themes show up, and what would you carry into ${Y + 1}?`, { font: F.serifItalic, size: 11, color: C.muted });
    }
  }
  astrologerNote(doc, ctx, 'chapter:forecast');
}
