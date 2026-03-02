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
    return "bg-red-500/15 text-red-300 border-red-500/30";
  }
  if (level === "med") {
    return "bg-yellow-500/15 text-yellow-300 border-yellow-500/30";
  }
  return "bg-green-500/15 text-green-300 border-green-500/30";
}

export function getRiskScoreColor(score: number): string {
  if (score >= 70) {
    return "text-red-400";
  }
  if (score >= 40) {
    return "text-yellow-400";
  }
  return "text-green-400";
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}
