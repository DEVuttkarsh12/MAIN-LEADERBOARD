export type LeaderboardPeriod = { id: string; from: number; to: number };

function parseDateOnly(value: string | undefined): number | undefined {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return undefined;
  }

  return timestamp;
}

function daysInUtcMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function firstDayOfUtcMonthAfter(start: number, monthsToAdd: number): number {
  const date = new Date(start);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthsToAdd, 1);
}

function firstDayOfNextUtcMonth(start: number): number {
  return firstDayOfUtcMonthAfter(start, 1);
}

function addUtcMonthsClamped(start: number, monthsToAdd: number): number {
  const date = new Date(start);
  const targetMonth = date.getUTCMonth() + monthsToAdd;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const targetDay = Math.min(date.getUTCDate(), daysInUtcMonth(targetYear, normalizedMonth));

  return Date.UTC(targetYear, normalizedMonth, targetDay);
}

function isLastDayOfUtcMonth(timestamp: number): boolean {
  const date = new Date(timestamp);
  return date.getUTCDate() === daysInUtcMonth(date.getUTCFullYear(), date.getUTCMonth());
}

export function monthlyPeriods(start: string | undefined, now = Date.now()) {
  const configuredStart = parseDateOnly(start) ?? Date.UTC(2026, 7, 31);
  const usesMonthEndStart = isLastDayOfUtcMonth(configuredStart);
  let from = configuredStart;
  let to = usesMonthEndStart
    ? firstDayOfUtcMonthAfter(configuredStart, 2)
    : addUtcMonthsClamped(configuredStart, 1);
  const completed: LeaderboardPeriod[] = [];

  while (now >= to) {
    completed.push({ id: new Date(from).toISOString().slice(0, 10), from, to });
    from = to;
    to = usesMonthEndStart ? firstDayOfNextUtcMonth(from) : addUtcMonthsClamped(from, 1);
  }

  return {
    current: { id: new Date(from).toISOString().slice(0, 10), from, to },
    completed: completed.reverse(),
  };
}
