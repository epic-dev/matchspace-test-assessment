/**
 * Pure interval-overlap check used to decide whether a requested booking
 * slot conflicts with an existing one. Half-open intervals
 * (`[start, end)`) — a slot that starts exactly when another ends is
 * "adjacent", not overlapping, and counts as available.
 */
export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
