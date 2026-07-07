export type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom' | 'all';

export type DateRangeValue = {
  preset: DateRangePreset;
  from: string;
  to: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DATE_RANGE_PRESETS: Array<{ value: DateRangePreset; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'custom', label: 'Custom' },
  { value: 'all', label: 'All dates' }
];

export function todayKey(): string {
  const date = new Date();
  return dateKey(date);
}

export function dateKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function rangeForPreset(preset: DateRangePreset, current: Partial<DateRangeValue> = {}): DateRangeValue {
  const today = new Date();
  const todayText = dateKey(today);
  if (preset === 'all') return { preset, from: '', to: '' };
  if (preset === 'custom') {
    return { preset, from: current.from || todayText, to: current.to || current.from || todayText };
  }
  if (preset === 'yesterday') {
    const yesterday = new Date(today.getTime() - MS_PER_DAY);
    const value = dateKey(yesterday);
    return { preset, from: value, to: value };
  }
  if (preset === 'this_week') {
    const start = new Date(today);
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    return { preset, from: dateKey(start), to: todayText };
  }
  if (preset === 'this_month') {
    return { preset, from: dateKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: todayText };
  }
  return { preset: 'today', from: todayText, to: todayText };
}

export function dateRangeParams(range: DateRangeValue, scopedLimit = 100, allDatesLimit = 1000): Record<string, string | number> {
  const limit = range.preset === 'all' ? allDatesLimit : scopedLimit;
  if (range.preset === 'all') return { limit };
  return { from: range.from, to: range.to || range.from, limit };
}
