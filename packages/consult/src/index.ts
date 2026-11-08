export { consultContext, runningChain, citeOf, type ConsultContext } from './context';
export { LIFE_AREAS, WATCH_KINDS, natalPromise, houseFacts, type AreaId, type LifeArea, type Point, type PointTone, type HouseFacts } from './areas';
export { clientSnapshot, type ClientSnapshot, type SnapshotFlag, type SnapshotItem, type SnapshotPeriod, type SnapshotTransit, type FlagLevel } from './snapshot';
export { talkingPoints, areaTalkingPoints, talkingPointsText, type AreaTalkingPoints } from './talkingPoints';
export {
  QUESTION_TOPICS,
  matchQuestion,
  answerQuestion,
  timingWindows,
  windowLine,
  type QuestionTopic,
  type QuestionAnswer,
  type TimingWindow,
  type TopicMatch,
  type FinderOptions,
} from './questions';
