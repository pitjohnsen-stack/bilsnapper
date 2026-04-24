/**
 * Domain types for scraped car ads and market statistics.
 *
 * Fields are optional because Finn.no's JSON-LD varies per ad; always guard
 * reads. `Record<string, unknown>` escape hatches are avoided in UI code — use
 * these types instead.
 */

export interface Car {
  id: string;
  finnId?: string;
  url?: string;
  adUrl?: string;
  adDate?: string | number;
  brand?: string;
  model?: string;
  year?: number;
  price: number;
  mileage?: number;
  /** Legacy alias for `mileage`. Scraper writes `mileage`; some old docs have `km`. */
  km?: number;
  color?: string;
  fuel?: string;
  gearbox?: string;
  owners?: number;
  region?: string;
  location?: string;
  sellerType?: string;
  imageUrl?: string;
  isComplete?: boolean;
  isAuction?: boolean;
  status?: 'active' | 'archived' | string;
  fairPrice?: number;
  confidence?: number;
  /** Server-computed score fields (ADR: scoring moved server-side in PR #10). */
  savingKr?: number;
  savingPct?: number;
  dealScore?: number;
  priceHistory?: Array<{ price: number; at: string }>;
  prevPrice?: number;
  euApprovedUntil?: string;
  euControl?: string;
}

export interface MarketStat {
  id: string;
  brand?: string;
  model?: string;
  avgPrice?: number;
  medianPrice?: number;
  sampleSize?: number;
  calculatedAt?: string | number;
}

export type SortKey =
  | 'dealScore'
  | 'savingKr'
  | 'savingPct'
  | 'priceAsc'
  | 'priceDesc'
  | 'yearDesc'
  | 'yearAsc'
  | 'kmAsc'
  | 'kmDesc'
  | 'newest'
  | 'confidence';
