export function normalizeOccurredAt(value?: string): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new Error("occurredAt must be a valid date string");
  }
  return date.toISOString();
}

export function yearMonthPath(isoDate: string): { year: string; month: string } {
  const date = new Date(isoDate);
  return {
    year: String(date.getUTCFullYear()),
    month: String(date.getUTCMonth() + 1).padStart(2, "0")
  };
}
