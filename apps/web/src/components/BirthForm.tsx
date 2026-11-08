import { useEffect, useMemo, useState } from 'react';
import type { Ayanamsa, BirthInput, CalendarSystem, RoddenRating, TimeConfidence } from '../types/chart';
import { RODDEN_LABEL, RODDEN_RATINGS, TIME_CONFIDENCE_LABEL, TIME_CONFIDENCES } from '../lib/birthQuality';
import { onlinePlaceSearch, searchGazetteer, setOnlinePlaceSearch } from '../lib/gazetteer';
import { placeAlias, normalizePlaceName } from '@vedic/engine/places';
import { CITIES, type City } from '../data/cities';
import { searchPlaces } from '../engine';
import { PlaceMap } from './PlaceMap';
import { useI18n } from '../i18n';

interface Props {
  initial: BirthInput;
  busy: boolean;
  onSubmit: (input: BirthInput) => void;
  onSample?: () => void;
  /** Text on the submit button. Defaults to the translated "Reveal my chart". */
  submitLabel?: string;
  /**
   * For someone filling in their own details (the client intake page): no Rodden rating or
   * ayanamsa, the coordinates tucked away, and the place must be picked or typed in.
   */
  simple?: boolean;
}

const ZONES: string[] = (() => {
  try { return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone'); } catch { return []; }
})();

export function BirthForm({ initial, busy, onSubmit, onSample, submitLabel, simple }: Props) {
  const { t } = useI18n();
  const [f, setF] = useState<BirthInput>(initial);
  const [error, setError] = useState<string | null>(null);
  // A fixed UTC offset (from the famous charts library) only fits the birth it came with,
  // so editing the date, time or place drops it and the zone's own rules apply again.
  const set = <K extends keyof BirthInput>(k: K, v: BirthInput[K]) => setF((s) => {
    const next = { ...s, [k]: v };
    if (!['name', 'ayanamsa', 'rodden', 'timeConfidence', 'calendar'].includes(k)) delete next.utcOffsetMinutes;
    return next;
  });

  const [showMatches, setShowMatches] = useState(false);
  const [remote, setRemote] = useState<City[]>([]);
  // the place picked from the list, so the map can say "formerly Pondicherry"
  const [picked, setPicked] = useState<City | null>(null);
  // only show the map once the person picks a place from the list or types coordinates:
  // mid-typing the coordinates still point at the old place, and just opening a chart
  // must not contact any other site (tools/smoke.mjs checks this).
  const [located, setLocated] = useState(false);
  const offline = useMemo(() => {
    const first = f.place.split(',')[0];
    const q = normalizePlaceName(first);
    if (q.length < 2) return [];
    const alias = placeAlias(first);
    const modern = alias ? normalizePlaceName(alias.modern) : null;
    const former = alias ? alias.former.replace(/\b\w/g, (c) => c.toUpperCase()) : undefined;
    return CITIES.flatMap((c): City[] => {
      const n = normalizePlaceName(c.name);
      if (modern && n.startsWith(modern)) return [{ ...c, formerly: former }];
      return n.includes(q) ? [c] : [];
    }).slice(0, 4);
  }, [f.place]);

  // the bundled GeoNames gazetteer: searched in this browser, nothing is sent
  const [gazetteer, setGazetteer] = useState<City[]>([]);
  useEffect(() => {
    const q = f.place.trim();
    if (!showMatches || q.length < 2) { setGazetteer([]); return; }
    let live = true;
    const t = setTimeout(() => { searchGazetteer(q).then((r) => { if (live) setGazetteer(r); }).catch(() => {}); }, 120);
    return () => { live = false; clearTimeout(t); };
  }, [f.place, showMatches]);

  // online place search (Open-Meteo via the engine), debounced to stay well inside its limits
  const [online, setOnline] = useState(onlinePlaceSearch);
  useEffect(() => {
    const q = f.place.trim();
    if (!online || !showMatches || q.length < 3) { setRemote([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      searchPlaces(q, ctl.signal)
        .then((r) => setRemote(r.map((g) => ({ name: g.name, latitude: g.latitude, longitude: g.longitude, timezone: g.timezone, formerly: g.formerly }))))
        .catch(() => {});
    }, 400);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [f.place, showMatches, online]);

  const matches = useMemo(() => {
    const seen = new Set<string>();
    // a renamed city found offline beats an unrelated literal match online (Madras, Oregon)
    const ordered = [...offline.filter((c) => c.formerly), ...gazetteer.filter((c) => c.formerly), ...offline, ...gazetteer, ...remote];
    // same town from both lists ("Mumbai, India" and "Mumbai, Maharashtra, India") shows once
    const key = (c: City) => `${c.latitude.toFixed(1)},${c.longitude.toFixed(1)}`;
    return ordered.filter((c) => (seen.has(key(c)) ? false : (seen.add(key(c)), true))).slice(0, 7);
  }, [remote, offline, gazetteer]);
  // dates before Britain's switch (1752) may be in either calendar; later ones are always Gregorian
  const year = Number(/^-?\d+/.exec(f.date)?.[0]);
  const showCalendar = Number.isFinite(year) && year < 1753 || (f.calendar !== undefined && f.calendar !== 'auto');
  const showMap = located && f.place.trim().length > 0 && Number.isFinite(f.latitude) && Number.isFinite(f.longitude)
    && Math.abs(f.latitude) <= 90 && Math.abs(f.longitude) <= 180;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.date || !f.time) return setError(t('form.errRequired'));
    if (simple && (!f.place.trim() || !Number.isFinite(f.latitude) || !Number.isFinite(f.longitude) || !f.timezone))
      return setError('Pick your birth place from the list that appears as you type. If your town is not listed, choose the nearest larger town.');
    if (!Number.isFinite(f.latitude) || Math.abs(f.latitude) > 90) return setError(t('form.errLatitude'));
    if (!Number.isFinite(f.longitude) || Math.abs(f.longitude) > 180) return setError(t('form.errLongitude'));
    setError(null);
    onSubmit(f);
  };

  const coordFields = (
    <>
      <label className="field">
        <span>{t('form.latitude')}</span>
        <input type="number" step="0.0001" value={Number.isFinite(f.latitude) ? f.latitude : ''} onChange={(e) => { set('latitude', parseFloat(e.target.value)); setLocated(true); }} />
      </label>
      <label className="field">
        <span>{t('form.longitude')}</span>
        <input type="number" step="0.0001" value={Number.isFinite(f.longitude) ? f.longitude : ''} onChange={(e) => { set('longitude', parseFloat(e.target.value)); setLocated(true); }} />
      </label>
      <label className="field">
        <span>{t('form.timezone')}</span>
        <input list="zones" value={f.timezone} onChange={(e) => set('timezone', e.target.value)} />
        <datalist id="zones">{ZONES.map((z) => <option key={z} value={z} />)}</datalist>
      </label>
    </>
  );

  return (
    <form className="birth-form" onSubmit={submit} autoComplete="off">
      <label className="field span-2">
        <span>{t('form.name')} <small className="muted">{t('form.optional')}</small></span>
        <input value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder={t('form.namePlaceholder')} />
      </label>
      <label className="field">
        <span>{t('form.date')}</span>
        <input type="date" required value={f.date} onChange={(e) => set('date', e.target.value)} />
      </label>
      <label className="field">
        <span>{t('form.time')}</span>
        <input type="time" step={1} required value={f.time} onChange={(e) => set('time', e.target.value)} />
      </label>
      <label className="field span-2 place-field">
        <span>{t('form.place')}</span>
        <input
          value={f.place}
          onChange={(e) => { set('place', e.target.value); setPicked(null); setLocated(false); setShowMatches(true); }}
          onFocus={() => setShowMatches(true)}
          onBlur={() => setTimeout(() => setShowMatches(false), 150)}
          placeholder={t('form.placePlaceholder')}
        />
        {showMatches && matches.length > 0 && (
          <ul className="suggest">
            {matches.map((c) => (
              <li key={c.name}>
                <button type="button" onMouseDown={() => {
                  setF((s) => ({ ...s, place: c.name, latitude: c.latitude, longitude: c.longitude, timezone: c.timezone }));
                  setPicked(c);
                  setLocated(true);
                  setShowMatches(false);
                }}>
                  <span>
                    {c.name}
                    {c.formerly && <small className="suggest-former">formerly {c.formerly}</small>}
                  </span>
                  <small className="muted">{c.timezone}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </label>
      <label className="check span-2 place-online">
        <input type="checkbox" checked={online} onChange={(e) => { setOnline(e.target.checked); setOnlinePlaceSearch(e.target.checked); }} />
        <span>Also search online for small towns <small className="muted">sends what you type to Open-Meteo and shows an OpenStreetMap preview. Off: 25,000 places are searched in this browser and nothing is sent.</small></span>
      </label>
      {showMap && online && (
        <PlaceMap
          key={picked?.name ?? 'typed'}
          latitude={f.latitude}
          longitude={f.longitude}
          label={f.place}
          formerly={picked?.name === f.place ? picked.formerly : undefined}
        />
      )}
      {simple ? (
        <details className="span-2 coords-more">
          <summary>Exact coordinates <small className="muted">filled in when you pick a place</small></summary>
          <div className="birth-form">{coordFields}</div>
        </details>
      ) : coordFields}
      {showCalendar && (
        <label className="field span-2">
          <span>Calendar of this date</span>
          <select value={f.calendar ?? 'auto'} onChange={(e) => set('calendar', e.target.value as CalendarSystem)}>
            <option value="auto">Automatic: Julian before 15 Oct 1582, Gregorian after</option>
            <option value="julian">Julian (Old Style), e.g. Britain and its colonies before Sept 1752</option>
            <option value="gregorian">Gregorian (New Style), the modern calendar</option>
          </select>
        </label>
      )}
      {!simple && (
        <label className="field">
          <span>Time source <small className="muted">Rodden rating</small></span>
          <select value={f.rodden ?? ''} onChange={(e) => set('rodden', (e.target.value || undefined) as RoddenRating | undefined)}>
            <option value="">Unrated</option>
            {RODDEN_RATINGS.map((r) => <option key={r} value={r}>{RODDEN_LABEL[r]}</option>)}
          </select>
        </label>
      )}
      <label className="field">
        <span>How exact is the time?</span>
        <select value={f.timeConfidence ?? ''} onChange={(e) => set('timeConfidence', (e.target.value || undefined) as TimeConfidence | undefined)}>
          <option value="">Not said</option>
          {TIME_CONFIDENCES.map((c) => <option key={c} value={c}>{TIME_CONFIDENCE_LABEL[c]}</option>)}
        </select>
      </label>
      {!simple && (
        <label className="field">
          <span>{t('form.ayanamsa')}</span>
          <select value={f.ayanamsa} onChange={(e) => set('ayanamsa', e.target.value as Ayanamsa)}>
            <option value="lahiri">{t('form.ayanamsaLahiri')}</option>
            <option value="true_chitra">{t('form.ayanamsaTrueChitra')}</option>
            <option value="raman">{t('form.ayanamsaRaman')}</option>
            <option value="krishnamurti">{t('form.ayanamsaKp')}</option>
          </select>
        </label>
      )}
      {error && <p className="form-error span-2" role="alert">{error}</p>}
      <button className="btn-primary span-2" disabled={busy}>{busy ? t('form.calculating') : submitLabel ?? t('form.submit')}</button>
      {onSample && <button type="button" className="btn-ghost span-2" disabled={busy} onClick={onSample}>{t('form.sample')}</button>}
      <p className="muted span-2 form-note">{t('form.note')}</p>
    </form>
  );
}
