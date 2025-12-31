export interface Level {
  label: string;
  score: number;
  criteria: string;
}

export interface Criterion {
  id: string;
  focus: string;
  levels: Level[];
}

export interface Student {
  id: string;
  name: string;
  contents: string[];
  feedback: string;
  score: number | null;
  levelLabel: string;
  status: 'idle' | 'loading' | 'done' | 'error';
  errorMsg?: string;
}

export interface GradingResult {
  score: number;
  levelLabel: string;
  feedback: string;
}