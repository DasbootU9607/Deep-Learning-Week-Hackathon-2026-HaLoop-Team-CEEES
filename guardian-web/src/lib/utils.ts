import { type ClassValue, clsx } from "clsx";
import { format, formatDistanceToNowStrict } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDateTime(value: string | Date): string {
  const date = toDate(value);
  return format(date, "yyyy-MM-dd HH:mm:ss");
}

export function formatRelativeTime(value: string | Date): string {
  const date = toDate(value);
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

export function getRiskBgColor(level: "low" | "med" | "high"): string {
  if (level === "high") {
    return "bg-red-500/12 text-red-700 border-red-500/25";
  }
  if (level === "med") {
    return "bg-yellow-500/14 text-amber-700 border-yellow-500/25";
  }
  return "bg-green-500/12 text-emerald-700 border-green-500/25";
}

export function getRiskScoreColor(score: number): string {
  if (score >= 70) {
    return "text-red-600";
  }
  if (score >= 40) {
    return "text-amber-600";
  }
  return "text-emerald-600";
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}
