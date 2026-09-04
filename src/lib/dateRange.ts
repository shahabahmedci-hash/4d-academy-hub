import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

export type { DateRange };

/** True when an ISO yyyy-MM-dd string falls inside the selected range. */
export function isWithinRange(dateStr: string, range?: DateRange): boolean {
  if (!range?.from) return true;
  const from = format(range.from, "yyyy-MM-dd");
  const to = format(range.to ?? range.from, "yyyy-MM-dd");
  return dateStr >= from && dateStr <= to;
}

export function formatRange(range?: DateRange): string {
  if (!range?.from) return "Any date";
  if (!range.to || format(range.to, "yyyy-MM-dd") === format(range.from, "yyyy-MM-dd")) {
    return format(range.from, "PPP");
  }
  return `${format(range.from, "dd MMM yyyy")} — ${format(range.to, "dd MMM yyyy")}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export const RANGE_PRESETS: { label: string; build: () => DateRange }[] = [
  { label: "Today", build: () => ({ from: new Date(), to: new Date() }) },
  { label: "Last 7 days", build: () => ({ from: daysAgo(6), to: new Date() }) },
  {
    label: "This month",
    build: () => {
      const now = new Date();
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    },
  },
  { label: "Last 30 days", build: () => ({ from: daysAgo(29), to: new Date() }) },
];
