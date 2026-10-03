import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";
import { format as formatFns } from "date-fns";

export const DEFAULT_TIMEZONE = process.env.COMPANY_TIMEZONE || "Asia/Kolkata";

export function getCompanyTimeZone(): string {
  return process.env.COMPANY_TIMEZONE || DEFAULT_TIMEZONE;
}

/**
 * Format a UTC Date into the configured company timezone display string.
 */
export function formatCompanyTime(
  date: Date | string | number | null | undefined,
  formatString: string = "dd MMM yyyy, hh:mm a"
): string {
  if (!date) return "-";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  try {
    return formatInTimeZone(d, getCompanyTimeZone(), formatString);
  } catch {
    return d.toISOString();
  }
}

/**
 * Converts a datetime string selected in the UI (assumed to be in the company timezone) into a UTC Date.
 */
export function parseLocalInputToUtc(localDatetimeString: string): Date {
  const timeZone = getCompanyTimeZone();
  // e.g. "2026-10-03T14:30"
  return fromZonedTime(localDatetimeString, timeZone);
}

/**
 * Converts a UTC Date into a format suitable for HTML <input type="datetime-local"> in the company timezone.
 */
export function formatForDateTimeLocalInput(date: Date): string {
  const timeZone = getCompanyTimeZone();
  return formatInTimeZone(date, timeZone, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Checks if two half-open intervals [startA, endA) and [startB, endB) overlap.
 * Condition: startA < endB && endA > startB
 */
export function intervalsOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
}
