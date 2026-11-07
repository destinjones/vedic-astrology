import { useEffect, useMemo, useState } from 'react';
import { TimingDashboard } from '@vedic/timing/ui';
import { buildTimeline, windowId, type PredictionMark } from '@vedic/timing';
import { engineEphemeris, natalFromChart, scoredDashasFromChart } from '@vedic/timing/engine';
import type { BirthInput, Chart } from '../types/chart';
import { birthHash, loadMarks, saveMarks } from '../lib/predictions';
import { birthKey } from '../lib/lifeEvents';
import { disableNotifications, enableNotifications, notifyState, notifySupported, syncNotifications, type NotifyState, type NotifyWindow } from '../lib/notify';

/** The timing dashboard, driven by the same engine and chart as the rest of the page. */
export default function TimingSection({ context, name, input }: { context: NonNullable<Chart['engineContext']>; name?: string; input?: BirthInput }) {
  const { engine, chart } = context;
  const natal = useMemo(() => natalFromChart(chart), [chart]);
  const ephemeris = useMemo(
    () => engineEphemeris(engine, { ayanamsa: chart.meta.ayanamsa, nodeType: chart.meta.nodeType }),
    [engine, chart],
  );
  const dashas = useMemo(() => scoredDashasFromChart(chart, natal), [chart, natal]);
  const [marks, setMarks] = useState<PredictionMark[]>(() => (input ? loadMarks(input) : []));
  const onMarks = (m: PredictionMark[]) => { setMarks(m); if (input) saveMarks(input, m); };

  // favourable windows over the next two years, for notifications
  const upcoming = useMemo<NotifyWindow[]>(() => {
    if (!input || !notifySupported()) return [];
    const now = new Date();
    const t = buildTimeline(ephemeris, natal, { dashas, from: now, to: new Date(now.getTime() + 2 * 365.25 * 864e5), stepDays: 5 });
    const who = name?.trim();
    return t.windows.filter((w) => w.tone === 'favourable').map((w) => ({
      id: `${birthHash(input)}-${windowId(w)}`,
      start: w.start.toISOString(),
      end: w.end.toISOString(),
      title: `A favourable window opens${who ? ` for ${who}` : ''}`,
      body: `${w.dashaPath.join('–')} dasha, until ${w.end.toISOString().slice(0, 10)}. ${w.drivers.slice(1, 3).join('; ')}`.trim(),
    }));
  }, [ephemeris, natal, dashas, input, name]);

  const person = input ? birthKey(input) : '';
  const [notify, setNotify] = useState<NotifyState | null>(null);
  useEffect(() => {
    if (!person) return;
    let live = true;
    void notifyState(person).then((s) => { if (live) setNotify(s); });
    void syncNotifications(person, upcoming);
    return () => { live = false; };
  }, [person, upcoming]);

  const [printing, setPrinting] = useState(false);
  const printYear = async () => {
    if (!input) return;
    setPrinting(true);
    try {
      const { downloadYearPdf } = await import('../report/yearTimeline');
      await downloadYearPdf(engine, chart, input);
    } catch (e) {
      console.error(e);
      alert('The yearly PDF could not be made. Please try again.');
    } finally {
      setPrinting(false);
    }
  };

  const toggleNotify = async () => {
    if (!person) return;
    setNotify(notify?.enabled ? await disableNotifications(person) : await enableNotifications(person, upcoming));
  };

  const actions = input ? (
    <>
      <button className="vt-btn" onClick={printYear} disabled={printing} title="A printable PDF: twelve months of life weather, windows, month-by-month dashas and sky events">
        {printing ? 'Making the PDF…' : 'Print the year (PDF)'}
      </button>
      {notify?.supported && (
        <button className="vt-btn" onClick={toggleNotify} disabled={notify.permission === 'denied'} aria-pressed={notify.enabled}
          title={notify.permission === 'denied' ? 'Notifications are blocked for this site in your browser settings' : 'A notification on the first day of each favourable window, from this browser only'}>
          {notify.enabled ? 'Notifications on ✓' : 'Notify me'}
        </button>
      )}
      {notify?.enabled && (
        <p className="vt-sub" style={{ margin: '4px 0 0', flexBasis: '100%' }}>
          {notify.periodicSync
            ? 'You will get a notification on the first day of each favourable window, even with the app closed, as long as it is installed.'
            : 'This browser can only check when the app is open, so the notification comes the first time you open it inside a window. Installing the app in Chrome or Edge lets it check in the background.'}
        </p>
      )}
    </>
  ) : undefined;

  return (
    <TimingDashboard
      chart={natal}
      ephemeris={ephemeris}
      name={name}
      dashas={dashas}
      predictions={input ? { marks, onChange: onMarks } : undefined}
      windowActions={actions}
      calendarId={input ? birthHash(input) : undefined}
    />
  );
}
