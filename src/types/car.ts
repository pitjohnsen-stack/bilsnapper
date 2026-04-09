/** Datamodeller for biler og markedsstatistikk (fra Firestore). */

export interface CarListing {
  id: string;
  finnId?: string;
  url?: string;
  brand: string;
  model: string;
  year?: number;
  price: number;
  mileage?: number;
  /** Alias for mileage */
  km?: number;
  color?: string;
  fuel?: string;
  gearbox?: string;
  owners?: number;
  region?: string;
  /** Alias for region */
  location?: string;
  sellerType?: string;
  imageUrl?: string;
  fairPrice?: number;
  confidence?: number;
  euApprovedUntil?: string;
  euControl?: string;
  status?: string;
  isAuction?: boolean;
}

export interface MarketStats {
  id: string;
  brand?: string;
  model?: string;
  avgPrice?: number;
  medianPrice?: number;
  sampleSize?: number;
  calculatedAt?: string | number;
}
