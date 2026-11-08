/**
 * Upcoming alerts for each client: dasha changes and the slow transits an
 * astrologer would get in touch about (Saturn phases from the Moon, Saturn
 * return, Jupiter and the nodes changing sign), plus the follow-ups and
 * prediction checks the astrologer set themselves.
 *
 * All of it is worked out in this browser from the client's chart. Nothing
 * is sent anywhere, and no AI service is involved: the wording is fixed text.
 */
import {
  findIngresses, houseFrom, ordinal, saturnPhases, signName, signOf,
  type DashaPeriod, type Ephemeris, type NatalChart, type Planet,
} from '@vedic/timing';
import type { Tab } from './tabs';

export type AlertKind = 'dasha' | 'saturn' | 'jupiter' | 'nodes' | 'follow-up' | 'prediction';
export type AlertTone = 'good' | 'mixed' | 'hard';

export interface Alert {
  /** Stable id, so a calendar import updates rather than duplicates. */
  id: string;
  kind: AlertKind;
  /** YYYY-MM-DD the change happens (or is due) */
  date: string;
  title: string;
  detail: string;
  tone: AlertTone;
}

const DAY = 86_400_000;
const day = (d: Date) => d.toISOString().slice(0, 10);
const inside = (d: Date, from: Date, to: Date) => d.getTime() >= from.getTime() && d.getTime() < to.getTime();

/* ---------- dashas ---------- */

const DASHA_NAME: Record<1 | 2 | 3, string> = { 1: 'Mahadasha', 2: 'Antardasha', 3: 'Pratyantardasha' };

function themeText(p: DashaPeriod): string {
  const seen = new Set<number>();
  const parts: string[] = [];
  for (const t of p.themes) {
    if (seen.has(t.house)) continue;
    seen.add(t.house);
    parts.push(`${ordinal(t.house)} house (${t.topic.split(',')[0]})`);
    if (parts.length === 3) break;
  }
  return parts.length ? `${p.lord} brings up the ${parts.join(', ')}.` : '';
}

const dashaTone = (p: DashaPeriod): AlertTone => (p.tone === 'excellent' || p.tone === 'good' ? 'good' : p.tone === 'mixed' ? 'mixed' : 'hard');

/** Mahadasha and antardasha changes (and pratyantardasha when asked) that begin inside the window. */
export function dashaAlerts(mahas: DashaPeriod[], from: Date, to: Date, levels: 1 | 2 | 3 = 2): Alert[] {
  const out: Alert[] = [];
  const walk = (list: DashaPeriod[] | undefined) => {
    for (const p of list ?? []) {
      if (p.end.getTime() <= from.getTime() || p.start.getTime() >= to.getTime()) continue;
      if (p.level <= levels && inside(p.start, from, to)) {
        const lvl = p.level as 1 | 2 | 3;
        const chain = p.path.join('–');
        out.push({
          id: `dasha-${lvl}-${chain}-${day(p.start)}`,
          kind: 'dasha',
          date: day(p.start),
          title: lvl === 1 ? `${p.lord} Mahadasha begins` : `${chain} ${DASHA_NAME[lvl]} begins`,
          detail: [
            lvl === 1 ? `A new major period that runs until ${day(p.end)}.` : `Runs until ${day(p.end)}.`,
            themeText(p),
          ].filter(Boolean).join(' '),
          tone: dashaTone(p),
        });
      }
      if (p.level < levels) walk(p.children);
    }
  };
  walk(mahas);
  return out;
}

/* ---------- transits ---------- */

const SATURN_PHASE: Record<string, { title: string; detail: string; tone: AlertTone }> = {
  'sade-sati-rising': { title: 'Sade Sati begins (rising phase)', detail: 'Saturn enters the 12th from the Moon: expenses, sleep and old structures loosening.', tone: 'hard' },
  'sade-sati-peak': { title: 'Sade Sati peak begins', detail: 'Saturn moves over the natal Moon: emotional weight, responsibility, steady maturing.', tone: 'hard' },
  'sade-sati-setting': { title: 'Sade Sati setting phase begins', detail: 'Saturn enters the 2nd from the Moon: finances, family and speech need care; things start to ease.', tone: 'mixed' },
  kantaka: { title: 'Kantaka Shani begins', detail: 'Saturn 4th from the Moon: home, property and peace of mind need care.', tone: 'hard' },
  ashtama: { title: 'Ashtama Shani begins', detail: 'Saturn 8th from the Moon: obstacles, sudden changes, health vigilance.', tone: 'hard' },
};

/** Saturn phases from the Moon that start (or Sade Sati that ends) inside the window, and the Saturn return. */
export function saturnAlerts(eph: Ephemeris, natal: NatalChart, from: Date, to: Date): Alert[] {
  const out: Alert[] = [];
  // look back a little so a phase that started on `from` is still a real start, not the search edge
  const { phases, sadeSati } = saturnPhases(eph, natal, new Date(from.getTime() - 40 * DAY), to);
  for (const ph of phases) {
    if (!inside(ph.start, from, to)) continue;
    const t = SATURN_PHASE[ph.kind];
    out.push({
      id: `saturn-${ph.kind}-${day(ph.start)}`,
      kind: 'saturn',
      date: day(ph.start),
      title: t.title + (ph.reentry ? ' (retrograde re-entry)' : ''),
      detail: `Saturn enters ${signName(ph.sign)}. ${t.detail}`,
      tone: t.tone,
    });
  }
  for (const sp of sadeSati) {
    // the spell's end is real only if it ends before the search edge
    if (inside(sp.end, from, to) && sp.end.getTime() < to.getTime() - DAY) {
      out.push({
        id: `saturn-sadesati-end-${day(sp.end)}`,
        kind: 'saturn',
        date: day(sp.end),
        title: 'Sade Sati ends',
        detail: `Saturn leaves the 2nd from the Moon, closing the 7½-year spell that began ${day(sp.start)}.`,
        tone: 'good',
      });
    }
  }
  const natalSign = signOf(natal.planets.Saturn.longitude);
  for (const ing of findIngresses(eph, 'Saturn', from, to)) {
    if (ing.toSign !== natalSign) continue;
    const age = Math.round((ing.date.getTime() - natal.birth.getTime()) / (365.25 * DAY));
    out.push({
      id: `saturn-return-${day(ing.date)}`,
      kind: 'saturn',
      date: day(ing.date),
      title: `Saturn return${ing.retrograde ? ' (retrograde re-entry)' : ''}`,
      detail: `Saturn comes back to its birth sign, ${signName(natalSign)}, at about age ${age}: a review of career, duty and the life built so far.`,
      tone: 'mixed',
    });
  }
  return out;
}

/** Jupiter's classical good houses from the Moon (gochara). */
const JUPITER_GOOD = new Set([2, 5, 7, 9, 11]);
const JUPITER_TEXT: Record<number, string> = {
  1: 'over the Moon: a fresh start, but restless and costly',
  2: 'wealth, family and speech are supported',
  3: 'effort without much reward; changes of place',
  4: 'home and mind feel unsettled',
  5: 'children, creativity, study and romance are supported',
  6: 'health and rivals need watching',
  7: 'marriage, partnerships and travel are supported',
  8: 'obstacles and delays; go carefully',
  9: 'luck, teachers, dharma and long travel are supported',
  10: 'work brings pressure and changes',
  11: 'gains, friends and wishes fulfilled',
  12: 'expenses and distance; spiritual retreat',
};

const NODE_TEXT: Record<number, string> = {
  1: 'Rahu over the Moon, Ketu in the 7th: restless mind, relationship questions',
  2: 'Rahu in the 2nd: money and family matters stirred up',
  3: 'Rahu in the 3rd: courage, initiative and new ventures favoured',
  4: 'Rahu in the 4th: home and inner peace unsettled',
  5: 'Rahu in the 5th: children, romance and speculation need care',
  6: 'Rahu in the 6th: wins over rivals, good for competition',
  7: 'Rahu in the 7th, Ketu over the Moon: partnerships tested',
  8: 'Rahu in the 8th: sudden events, health vigilance',
  9: 'Rahu in the 9th: beliefs, teachers and father questioned',
  10: 'Rahu in the 10th: ambition and visibility at work',
  11: 'Rahu in the 11th: gains and wider networks favoured',
  12: 'Rahu in the 12th: expenses, foreign links, sleep',
};
const NODES_GOOD = new Set([3, 6, 11]);

/** Jupiter and Rahu changing sign inside the window, read from the Moon and the lagna. */
export function slowIngressAlerts(eph: Ephemeris, natal: NatalChart, from: Date, to: Date): Alert[] {
  const out: Alert[] = [];
  const moon = signOf(natal.planets.Moon.longitude);
  const lagna = signOf(natal.ascendant);
  const add = (planet: Planet) => {
    for (const ing of findIngresses(eph, planet, from, to)) {
      const fromMoon = houseFrom(moon, ing.toSign);
      const fromLagna = houseFrom(lagna, ing.toSign);
      const retro = ing.retrograde && planet === 'Jupiter' ? ' (retrograde)' : '';
      if (planet === 'Jupiter') {
        out.push({
          id: `jupiter-${day(ing.date)}-${ing.toSign}`,
          kind: 'jupiter',
          date: day(ing.date),
          title: `Jupiter enters ${signName(ing.toSign)}${retro}`,
          detail: `${ordinal(fromMoon)} from the Moon, ${ordinal(fromLagna)} from the lagna: ${JUPITER_TEXT[fromMoon]}.`,
          tone: JUPITER_GOOD.has(fromMoon) ? 'good' : fromMoon === 8 || fromMoon === 12 ? 'hard' : 'mixed',
        });
      } else {
        out.push({
          id: `nodes-${day(ing.date)}-${ing.toSign}`,
          kind: 'nodes',
          date: day(ing.date),
          title: `Rahu enters ${signName(ing.toSign)}, Ketu ${signName((ing.toSign + 6) % 12)}`,
          detail: `${NODE_TEXT[fromMoon]}. ${ordinal(fromLagna)} from the lagna.`,
          tone: NODES_GOOD.has(fromMoon) ? 'good' : [1, 7, 8, 12].includes(fromMoon) ? 'hard' : 'mixed',
        });
      }
    }
  };
  add('Jupiter');
  add('Rahu');
  return out;
}

/** Every chart-based alert for one client, soonest first. */
export function chartAlerts(eph: Ephemeris, natal: NatalChart, dashas: DashaPeriod[], from: Date, to: Date, opts: { dashaLevels?: 1 | 2 | 3 } = {}): Alert[] {
  return sortAlerts([
    ...dashaAlerts(dashas, from, to, opts.dashaLevels ?? 2),
    ...saturnAlerts(eph, natal, from, to),
    ...slowIngressAlerts(eph, natal, from, to),
  ]);
}

/* ---------- the astrologer's own reminders ---------- */

/** Follow-up dates and predictions due for checking, from the client's notes. Overdue items are included. */
export function reminderAlerts(tab: Pick<Tab, 'followUp' | 'log'>, to: Date, today: string): Alert[] {
  const end = day(to);
  const out: Alert[] = [];
  if (tab.followUp && tab.followUp.date < end) {
    out.push({
      id: `follow-up-${tab.followUp.date}`,
      kind: 'follow-up',
      date: tab.followUp.date,
      title: tab.followUp.date < today ? 'Follow-up overdue' : 'Follow up',
      detail: tab.followUp.note || 'Get back in touch.',
      tone: 'mixed',
    });
  }
  for (const e of tab.log) {
    if (e.kind !== 'prediction' || e.outcome !== 'open' || !e.about || e.about >= end) continue;
    out.push({
      id: `prediction-${e.id}`,
      kind: 'prediction',
      date: e.about,
      title: e.about < today ? 'Prediction ready to check' : 'Prediction comes due',
      detail: e.text.length > 160 ? `${e.text.slice(0, 157)}…` : e.text,
      tone: 'mixed',
    });
  }
  return out;
}

export const sortAlerts = (list: Alert[]) => [...list].sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));

/* ---------- a message the astrologer can send ---------- */

/** A plain, editable note to send the client about an alert. Fixed wording, no AI. */
export function reachOutText(name: string, alert: Alert, signature = ''): string {
  const first = name.trim().split(/\s+/)[0] || 'there';
  const when = new Date(`${alert.date}T12:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const body =
    alert.kind === 'follow-up' ? `I wanted to check in on how things have been going since our last session.`
    : alert.kind === 'prediction' ? `When we spoke, we looked at a period around ${when}. I'd love to hear how it has turned out for you.`
    : `A change is coming up in your chart: ${alert.title} on ${when}. ${alert.detail} It could be a good moment for a reading to plan ahead.`;
  return `Hi ${first},\n\n${body}\n\nWould you like to book a time to talk?${signature ? `\n\n${signature}` : ''}`;
}
