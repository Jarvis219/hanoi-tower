import { mulberry32, seedFromDate } from '../utils/seededRandom';
import { saveManager } from './SaveManager';

const isoDate = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface DailyContext {
  date: string;
  seed: number;
  rng: () => number;
}

export const buildDailyContext = (date: Date = new Date()): DailyContext => {
  const seed = seedFromDate(date);
  return {
    date: isoDate(date),
    seed,
    rng: mulberry32(seed),
  };
};

export const dailyAlreadyPlayed = (): boolean => {
  return saveManager.hasPlayedDaily() !== undefined;
};

export const formatDateLabel = (iso: string): string => {
  // yyyy-mm-dd → dd/mm/yyyy
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
