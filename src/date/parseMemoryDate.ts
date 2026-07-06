import type { MemorySummary } from '@/src/data/mock';

export type ParsedMemoryDate = {
  year: number;
  month: number;
  day: number;
};

export function parseMemoryDate(memory: Pick<MemorySummary, 'date' | 'year'>): ParsedMemoryDate | null {
  const year = Number(memory.year);
  const match = memory.date.match(/(\d{1,2})月(\d{1,2})日/);
  if (!Number.isInteger(year) || year < 1900 || year > 2100 || !match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return { year, month, day };
}
