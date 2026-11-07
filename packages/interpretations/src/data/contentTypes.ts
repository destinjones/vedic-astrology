/** Types for the readings compiled from content/*.yaml. */

export interface WrittenNakshatraReading {
  summary: string;
  detail: string[];
  strengths: string[];
  challenges: string[];
  /** Overrides the composed score when set. */
  score?: number;
}

export interface YogaCitation {
  source: string;
  ref?: string;
  /** True once someone has checked the reference against a printed translation. */
  verified: boolean;
  edition?: string;
  verifiedBy?: string;
}

/** Audit notes kept beside every yoga: where the rule comes from and what cancels it. */
export interface YogaMeta {
  citation: YogaCitation;
  also?: string[];
  cancellation: string;
}
