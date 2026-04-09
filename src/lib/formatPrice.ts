/** Formatter for Norwegian price display (e.g. 350 000 kr). */
export function formatPrice(value: number): string {
  return `${value.toLocaleString('no-NO')} kr`;
}

/** Formatter for short price with k-suffix (e.g. 350k). */
export function formatPriceShort(value: number): string {
  return `${Math.round(value / 1000)}k`;
}
