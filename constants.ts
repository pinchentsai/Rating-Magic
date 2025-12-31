import { Level } from './types';

export const DEFAULT_LEVELS: Level[] = [
  { label: "超級優異 (Superb)", score: 100, criteria: "" },
  { label: "表現良好 (Good)", score: 89, criteria: "" },
  { label: "已經做到 (Done)", score: 79, criteria: "" },
  { label: "還要加油 (Developing)", score: 69, criteria: "" },
  { label: "努力改進 (Beginning)", score: 59, criteria: "" }
];

export const MAX_TASKS = 5;
export const MAX_CRITERIA = 5;

export const MAGIC_COLORS = {
  pink: '#ff69b4',
  gold: '#ffd700',
  purple: '#e6e6fa',
  deepPurple: '#4b0082'
};