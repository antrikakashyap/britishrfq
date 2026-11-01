/** Money lives as integer cents inside the system, decimals only at the API edge. */
export const toCents = (n: number): number => Math.round(n * 100);
export const fromCents = (c: number): number => c / 100;

/** true when n is finite and has at most 2 decimal places. */
export function isMoney(n: number): boolean {
  return Number.isFinite(n) && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}
