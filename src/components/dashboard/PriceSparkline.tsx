import type { Car } from '../../types/car';

/**
 * Tiny inline SVG sparkline of the car's price history. No tooltip, no axes —
 * just a visual cue. Returns null if history has < 2 points.
 */
export function PriceSparkline({ car, width = 80, height = 20 }: { car: Car; width?: number; height?: number }) {
  const hist = car.priceHistory;
  if (!Array.isArray(hist) || hist.length < 2) return null;

  const prices = hist.map((h) => h.price).filter((p): p is number => typeof p === 'number');
  if (prices.length < 2) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const step = width / (prices.length - 1);
  const pts = prices
    .map((p, i) => `${(i * step).toFixed(1)},${(height - ((p - min) / span) * height).toFixed(1)}`)
    .join(' ');

  const last = prices[prices.length - 1];
  const first = prices[0];
  const stroke = last < first ? '#10b981' /* emerald-500 */ : last > first ? '#f43f5e' /* rose-500 */ : '#94a3b8';

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden>
      <polyline fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" points={pts} />
    </svg>
  );
}
