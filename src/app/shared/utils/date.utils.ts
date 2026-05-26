const PT_BR_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const INPUT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_IN_MS = 1000 * 60 * 60 * 24;

export function parsePtBrDate(dateStr?: string | null): number {
  const match = PT_BR_DATE_PATTERN.exec(dateStr?.trim() ?? '');
  if (!match) {
    return 0;
  }

  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

export function getPtBrDateMonthYear(dateStr?: string | null): { month: number; year: number } | null {
  const match = PT_BR_DATE_PATTERN.exec(dateStr?.trim() ?? '');
  if (!match) {
    return null;
  }

  const [, , month, year] = match;
  return {
    month: Number(month) - 1,
    year: Number(year)
  };
}

export function formatPtBrDateToInputValue(dateStr?: string | null): string {
  const match = PT_BR_DATE_PATTERN.exec(dateStr?.trim() ?? '');
  if (!match) {
    return '';
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

export function formatInputDateToPtBr(dateStr?: string | null): string {
  const match = INPUT_DATE_PATTERN.exec(dateStr?.trim() ?? '');
  if (!match) {
    return '';
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function getStartOfDayTimestamp(reference = new Date()): number {
  const date = new Date(reference);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function getDayDiffFromToday(dateStr?: string | null, today = new Date()): number | null {
  const targetTime = parsePtBrDate(dateStr);
  if (!targetTime) {
    return null;
  }

  const targetDate = new Date(targetTime);
  targetDate.setHours(0, 0, 0, 0);

  const currentDate = new Date(today);
  currentDate.setHours(0, 0, 0, 0);

  return Math.ceil((targetDate.getTime() - currentDate.getTime()) / DAY_IN_MS);
}
