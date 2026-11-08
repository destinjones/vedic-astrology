import { useSyncExternalStore } from 'react';
import { practiceStore, type Practice } from './practice';

/** The practice's packages and business details, shared by every panel. */
export function usePractice(): [Practice, (p: Practice) => void] {
  const p = useSyncExternalStore(practiceStore.subscribe, practiceStore.get, practiceStore.get);
  return [p, practiceStore.set];
}
