import type { MealType } from '@/types';

export type CalendarViewMode = 'day' | 'week' | 'month';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export const MEAL_TYPES: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
];

/**
 * Get the start of the week (Monday) for a given date
 */
export function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the first day of the month for a given date
 */
export function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Format a date for API requests (YYYY-MM-DD)
 */
export function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format a week range for display (e.g., "Dec 2 - 8, 2024")
 */
export function formatWeekRange(startOfWeek: Date): string {
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  const startMonth = startOfWeek.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = endOfWeek.toLocaleDateString('en-US', { month: 'short' });
  const year = endOfWeek.getFullYear();
  if (startMonth === endMonth) {
    return `${startMonth} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${year}`;
  }
  return `${startMonth} ${startOfWeek.getDate()} - ${endMonth} ${endOfWeek.getDate()}, ${year}`;
}

/**
 * Format month and year for display (e.g., "December 2024")
 */
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Format a full day date for display (e.g., "Monday, December 9, 2024")
 */
export function formatDayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Get all days to display in a month calendar (includes padding from adjacent months)
 * Returns exactly 42 days (6 weeks) to fill a standard calendar grid
 */
export function getDaysInMonth(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];

  // Add days from previous month to start on Monday
  const startDayOfWeek = firstDay.getDay();
  const daysFromPrevMonth = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  for (let i = daysFromPrevMonth; i > 0; i--) {
    days.push(new Date(year, month, 1 - i));
  }

  // Add all days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }

  // Fill remaining slots with next month's days
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    days.push(new Date(year, month + 1, i));
  }

  return days;
}

/**
 * Get an array of dates for a week starting from the given date
 */
export function getWeekDates(startOfWeek: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * Check if a date is in the current month
 */
export function isCurrentMonth(date: Date, referenceDate: Date): boolean {
  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth()
  );
}

/**
 * Navigate to next period based on view mode
 */
export function getNextPeriod(currentDate: Date, viewMode: CalendarViewMode): Date {
  const newDate = new Date(currentDate);
  switch (viewMode) {
    case 'day':
      newDate.setDate(newDate.getDate() + 1);
      break;
    case 'week':
      newDate.setDate(newDate.getDate() + 7);
      break;
    case 'month':
      newDate.setMonth(newDate.getMonth() + 1);
      break;
  }
  return newDate;
}

/**
 * Navigate to previous period based on view mode
 */
export function getPrevPeriod(currentDate: Date, viewMode: CalendarViewMode): Date {
  const newDate = new Date(currentDate);
  switch (viewMode) {
    case 'day':
      newDate.setDate(newDate.getDate() - 1);
      break;
    case 'week':
      newDate.setDate(newDate.getDate() - 7);
      break;
    case 'month':
      newDate.setMonth(newDate.getMonth() - 1);
      break;
  }
  return newDate;
}

/**
 * Get the date range for API fetching based on view mode
 */
export function getCalendarDateRange(
  currentDate: Date,
  viewMode: CalendarViewMode
): { start: Date; end: Date } {
  switch (viewMode) {
    case 'week': {
      const start = getStartOfWeek(currentDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { start, end };
    }
    case 'month': {
      const start = getStartOfMonth(currentDate);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      return { start, end };
    }
    case 'day':
    default: {
      const start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      return { start, end: start };
    }
  }
}

/**
 * Format calendar header text based on view mode
 */
export function getCalendarHeaderText(currentDate: Date, viewMode: CalendarViewMode): string {
  switch (viewMode) {
    case 'week':
      return formatWeekRange(getStartOfWeek(currentDate));
    case 'month':
      return formatMonthYear(currentDate);
    case 'day':
      return formatDayDate(currentDate);
  }
}
