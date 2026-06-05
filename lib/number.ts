export function toNumber(value: number | string | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}
