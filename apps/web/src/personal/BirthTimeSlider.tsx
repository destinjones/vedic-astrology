import { useEffect, useMemo, useState } from 'react';
import type { Chart } from '../types/chart';
import type { ChartStyle } from '../types/ui';
import { fromEngine, type EngineChart } from '../engine/adapter';
import { NorthChart } from '../components/NorthChart';
import { SouthChart } from '../components/SouthChart';
import { useI18n } from '../i18n';
import { shiftLocal } from './time';

const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const RANGES = [{ m: 30, label: '±30 min' }, { m: 180, label: '±3 hours' }, { m: 720, label: '±12 hours' }];

const dmText = (deg: number) => `${Math.floor(deg)}°${String(Math.floor((deg % 1) * 60)).padStart(2, '0')}′`;
const signed = (n: number) => (n === 0 ? 'as recorded' : `${n > 0 ? '+' : '−'}${Math.abs(n) >= 60 ? `${Math.floor(Math.abs(n) / 60)}h ${String(Math.abs(n) % 60).padStart(2, '0')}m` : `${Math.abs(n)} min`}`);

/**
 * Drag the birth time and watch the chart re-cast live. Shows what moves
 * (lagna, navamsa lagna, Moon's pada, dasha balance) and where the lagna
 * changes sign, so it doubles as a rectification teaching tool.
 */
export default function BirthTimeSlider({ chart, style, onApply }: { chart: Chart; style: ChartStyle; onApply: (date: string, time: string) => void }) {
  const { v } = useI18n();
  const ctx = chart.engineContext!;
  const { engine } = ctx;
  const base = ctx.chart;
  const [range, setRange] = useState(180);
  const [offset, setOffset] = useState(0);
  const [playing, setPlaying] = useState(false);
  // charts already cast for this birth, by minute offset (the parent remounts this for a new birth)
  const cache = useMemo(() => new Map<number, Chart>(), []);

  const castAt = (min: number): Chart => {
    const hit = cache.get(min);
    if (hit) return hit;
    const { date, time } = shiftLocal(chart.input.date, chart.input.time, min);
    const input = { ...chart.input, date, time };
    const c = engine.computeChart(
      {
        date, time, name: input.name,
        place: { name: input.place, latitude: input.latitude, longitude: input.longitude, timezone: input.timezone || undefined },
        utcOffsetMinutes: input.utcOffsetMinutes,
      },
      { ayanamsa: input.ayanamsa, nodeType: base.meta.nodeType, dashaLevels: 1, strength: false, vargas: ['D9'] },
    );
    const ui = { ...fromEngine(input, c as unknown as EngineChart), engineContext: { engine, chart: c } };
    if (cache.size > 600) cache.clear();
    cache.set(min, ui);
    return ui;
  };
  const live = offset === 0 ? chart : castAt(offset);
  const eng = live.engineContext!.chart;

  // where the lagna changes sign inside the range: scan the ascendant every 2 minutes
  const marks = useMemo(() => {
    const out: { at: number; sign: number }[] = [];
    const jd0 = base.meta.jdUt;
    const asc = (min: number) => Math.floor(engine.ascendantAt(jd0 + min / 1440, chart.input.latitude, chart.input.longitude, base.meta.ayanamsa) / 30);
    let prev = asc(-range);
    for (let m = -range + 2; m <= range; m += 2) {
      const s = asc(m);
      if (s !== prev) {
        // refine to the minute
        let lo = m - 2;
        while (lo < m && asc(lo + 1) === prev) lo++;
        out.push({ at: lo + 1, sign: s + 1 });
        prev = s;
      }
    }
    return out;
  }, [engine, base, chart.input.latitude, chart.input.longitude, range]);

  // play: sweep forward two minutes a frame, wrapping round the range
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = 0;
    const step = (t: number) => {
      if (t - last > 33) {
        last = t;
        setOffset((o) => (o + 2 > range ? -range : o + 2));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, range]);

  const shifted = shiftLocal(chart.input.date, chart.input.time, offset);
  const d9 = live.vargas.D9!;
  const baseD9 = chart.vargas.D9!;
  const moon = live.planets.find((p) => p.id === 'moon')!;
  const baseMoon = chart.planets.find((p) => p.id === 'moon')!;
  const balance = eng.dasha.balanceYears;
  const facts = [
    { k: 'Lagna', val: `${SIGNS[live.ascendant.sign - 1]} ${dmText(live.ascendant.degreeInSign)}`, moved: live.ascendant.sign !== chart.ascendant.sign },
    { k: 'Lagna nakshatra', val: `${v.nakshatras[live.ascendant.nakshatra - 1]} ${live.ascendant.pada}`, moved: live.ascendant.nakshatra !== chart.ascendant.nakshatra || live.ascendant.pada !== chart.ascendant.pada },
    { k: 'Navamsa lagna', val: SIGNS[d9.ascSign - 1], moved: d9.ascSign !== baseD9.ascSign },
    { k: 'Moon', val: `${v.nakshatras[moon.nakshatra - 1]} pada ${moon.pada}`, moved: moon.nakshatra !== baseMoon.nakshatra || moon.pada !== baseMoon.pada },
    { k: 'Dasha at birth', val: `${v.planets[eng.dasha.startLord].name}, ${Math.floor(balance)}y ${Math.floor((balance % 1) * 12)}m left`, moved: eng.dasha.startLord !== ctx.chart.dasha.startLord },
  ];
  const housesMoved = live.ascendant.sign !== chart.ascendant.sign;
  const nextMark = marks.find((m) => m.at > offset);
  const prevMark = [...marks].reverse().find((m) => m.at <= offset);
  const pct = (m: number) => `${((m + range) / (2 * range)) * 100}%`;
  const ChartView = style === 'north' ? NorthChart : SouthChart;

  return (
    <div className="bts">
      <div className="bts-stage">
        <ChartView chart={live} varga={live.vargas.D1!} selection={null} hoverPlanet={null} onSelect={() => {}} onHoverPlanet={() => {}} />
      </div>
      <div className="bts-side">
        <div className="bts-clock">
          <b className="mono">{shifted.time}</b>
          <span className="muted">{shifted.date !== chart.input.date ? `${shifted.date} · ` : ''}{signed(offset)}</span>
        </div>
        <div className="bts-track">
          <input
            type="range"
            min={-range}
            max={range}
            step={1}
            value={offset}
            aria-label="Birth time"
            aria-valuetext={`${shifted.time}, ${signed(offset)}`}
            onChange={(e) => { setPlaying(false); setOffset(+e.target.value); }}
          />
          <div className="bts-marks" aria-hidden>
            {marks.map((m) => <span key={m.at} style={{ left: pct(m.at) }} title={`${SIGNS[m.sign - 1]} rises at ${shiftLocal(chart.input.date, chart.input.time, m.at).time}`} />)}
            <i style={{ left: pct(0) }} />
          </div>
        </div>
        <div className="bts-controls">
          <button className="btn-ghost" onClick={() => setOffset((o) => Math.max(-range, o - 1))} aria-label="One minute earlier">−1m</button>
          <button className="btn-ghost" onClick={() => setPlaying((p) => !p)}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
          <button className="btn-ghost" onClick={() => setOffset((o) => Math.min(range, o + 1))} aria-label="One minute later">+1m</button>
          <button className="btn-ghost" onClick={() => { setPlaying(false); setOffset(0); }} disabled={offset === 0}>Reset</button>
          <select value={range} onChange={(e) => { setRange(+e.target.value); setOffset(0); }} aria-label="Range">
            {RANGES.map((r) => <option key={r.m} value={r.m}>{r.label}</option>)}
          </select>
        </div>
        <ul className="bts-facts">
          {facts.map((f) => (
            <li key={f.k} className={f.moved ? 'is-moved' : ''}><small>{f.k}</small><b>{f.val}</b></li>
          ))}
        </ul>
        <p className="muted bts-note">
          {housesMoved
            ? 'A new sign is rising, so every planet has moved house. This is why the birth minute matters.'
            : nextMark || prevMark
              ? `The lagna stays ${SIGNS[live.ascendant.sign - 1]} from ${prevMark ? shiftLocal(chart.input.date, chart.input.time, prevMark.at).time : 'before this range'} to ${nextMark ? shiftLocal(chart.input.date, chart.input.time, nextMark.at - 1).time : 'past this range'}. The gold ticks on the slider mark each change.`
              : `The lagna stays ${SIGNS[live.ascendant.sign - 1]} across the whole range.`}
        </p>
        {offset !== 0 && (
          <button className="btn-primary" onClick={() => onApply(shifted.date, shifted.time)}>Use {shifted.time} as the birth time</button>
        )}
      </div>
    </div>
  );
}
