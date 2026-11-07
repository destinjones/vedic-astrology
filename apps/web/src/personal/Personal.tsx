/**
 * The personal features, loaded as one chunk after the chart appears:
 * today brief, Sade Sati countdown, rarity, birth-time slider, chart story,
 * ayanamsa diff, poster, time capsule and calendar feed.
 */
import type { ChartInterpretation } from '@vedic/interpretations';
import type { Chart } from '../types/chart';
import type { ChartStyle, Selection } from '../types/ui';
import BirthTimeSlider from './BirthTimeSlider';
import AyanamsaDiffView from './AyanamsaDiffView';
import ChartStory from './ChartStory';
import { RarityCard, SadeSatiCard, TodayCard } from './ForYou';
import { CalendarFeed, PosterMaker, TimeCapsule } from './Keepsakes';
import './personal.css';

export type PersonalPart = 'today' | 'slider' | 'story' | 'ayanamsa' | 'keepsakes';

interface Props {
  part: PersonalPart;
  chart: Chart;
  report?: ChartInterpretation | null;
  style?: ChartStyle;
  onSelect?: (s: Selection) => void;
  onApplyTime?: (date: string, time: string) => void;
}

export default function Personal({ part, chart, report, style = 'north', onSelect = () => {}, onApplyTime = () => {} }: Props) {
  if (!chart.engineContext) return null;
  switch (part) {
    case 'today':
      return (
        <div className="fy-row">
          <TodayCard chart={chart} />
          <SadeSatiCard chart={chart} />
          {report && <RarityCard report={report} />}
        </div>
      );
    case 'slider':
      return (
        <section className="card" id="birth-time">
          <div className="card-head"><h3>Birth-time slider</h3><span className="muted">drag the time and watch the chart re-cast live</span></div>
          <BirthTimeSlider key={chart.engineContext.chart.meta.utc} chart={chart} style={style} onApply={onApplyTime} />
        </section>
      );
    case 'story':
      return report ? (
        <section className="card" id="story">
          <div className="card-head"><h3>Your chart as a story</h3><span className="muted">the findings, in order, for reading top to bottom</span></div>
          <ChartStory chart={chart} report={report} onSelect={onSelect} />
        </section>
      ) : null;
    case 'ayanamsa':
      return (
        <section className="card" id="ayanamsa-diff">
          <div className="card-head"><h3>Four ayanamsas, side by side</h3><span className="muted">what changes if you use another school's zodiac</span></div>
          <AyanamsaDiffView chart={chart} />
        </section>
      );
    case 'keepsakes':
      return (
        <div className="ks-grid">
          <section className="card" id="poster"><div className="card-head"><h3>Your chart as a poster</h3></div><PosterMaker chart={chart} /></section>
          <div className="ks-col">
            <section className="card" id="capsule"><div className="card-head"><h3>Time capsule</h3><span className="muted">seal a prediction, score it later</span></div><TimeCapsule chart={chart} /></section>
            <section className="card" id="calendar"><div className="card-head"><h3>Panchanga in your calendar</h3></div><CalendarFeed chart={chart} /></section>
          </div>
        </div>
      );
  }
}
