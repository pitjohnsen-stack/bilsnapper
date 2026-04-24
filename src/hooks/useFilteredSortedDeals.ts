import { useMemo } from 'react';
import type { Car, SortKey } from '../types/car';
import type { mergeUserSettings } from '../types/userSettings';

type Prefs = ReturnType<typeof mergeUserSettings>;

/** Getaround safety constraints — hard-coded domain policy. */
const GETAROUND_MAX_YEAR_AGE = 15;
const GETAROUND_MAX_KM = 200_000;
const GETAROUND_EXCLUDED_BRANDS = new Set<string>([
  'Ferrari', 'Porsche', 'Lamborghini', 'Maserati', 'Bentley',
  'Rolls-Royce', 'Aston Martin', 'McLaren', 'Bugatti', 'Lotus',
]);

export { GETAROUND_MAX_KM, GETAROUND_MAX_YEAR_AGE };

export interface FilterInputs {
  brandFilter: string;
  modelFilter: string;
  regionFilter: string;
  colorFilter: string;
  ownersFilter: string;
  fuelFilter: string;
  gearboxFilter: string;
  sellerTypeFilter: string;
  getaroundFilter: boolean;
  onlyComplete: boolean;
  onlyWithImage: boolean;
  priceMin: string;
  priceMax: string;
  yearMin: string;
  yearMax: string;
  kmMin: string;
  kmMax: string;
  debouncedSearch: string;
  sortBy: SortKey;
  prefs: Prefs;
}

const parseIntOrNull = (s: string): number | null => (s ? parseInt(s, 10) : null);

/**
 * Pure derivation: takes the full car set + filter state and produces the
 * matching + sorted arrays. Two `useMemo`s so filter changes don't re-sort
 * and sort changes don't re-filter.
 *
 * Falls back to client-side scoring when the server hasn't populated
 * `savingKr`/`savingPct`/`dealScore` yet (backwards compatibility with old
 * Firestore docs).
 */
export function useFilteredSortedDeals(cars: Car[], f: FilterInputs): {
  matchingDeals: Car[];
  sortedDeals: Car[];
} {
  const getaroundMinYear = new Date().getFullYear() - GETAROUND_MAX_YEAR_AGE;

  const matchingDeals = useMemo(() => {
    const pMin = parseIntOrNull(f.priceMin);
    const pMax = parseIntOrNull(f.priceMax);
    const yMin = parseIntOrNull(f.yearMin);
    const yMax = parseIntOrNull(f.yearMax);
    const kMin = parseIntOrNull(f.kmMin);
    const kMax = parseIntOrNull(f.kmMax);
    const searchLower = f.debouncedSearch.trim().toLowerCase();

    return cars.filter((car) => {
      if (f.brandFilter !== 'all' && car.brand !== f.brandFilter) return false;
      if (f.modelFilter !== 'all' && car.model !== f.modelFilter) return false;
      if (f.regionFilter !== 'all' && car.region !== f.regionFilter && car.location !== f.regionFilter) return false;
      if (f.colorFilter !== 'all' && car.color !== f.colorFilter) return false;
      if (f.ownersFilter !== 'all') {
        const ok = f.ownersFilter === '1' ? car.owners === 1 : (car.owners ?? 0) > 1;
        if (!ok) return false;
      }
      if (f.fuelFilter !== 'all' && car.fuel !== f.fuelFilter) return false;
      if (f.gearboxFilter !== 'all' && car.gearbox !== f.gearboxFilter) return false;
      if (f.sellerTypeFilter !== 'all' && car.sellerType !== f.sellerTypeFilter) return false;
      if (!(car.price > 0)) return false;

      if (pMin != null && car.price < pMin) return false;
      if (pMax != null && car.price > pMax) return false;
      if (yMin != null && (!car.year || car.year < yMin)) return false;
      if (yMax != null && (!car.year || car.year > yMax)) return false;

      const km = car.mileage ?? car.km;
      if (kMin != null && (km == null || km < kMin)) return false;
      if (kMax != null && (km == null || km > kMax)) return false;

      if (f.onlyComplete && !car.isComplete) return false;
      if (f.onlyWithImage && !car.imageUrl) return false;

      if (searchLower) {
        const hay = `${car.brand ?? ''} ${car.model ?? ''}`.toLowerCase();
        if (!hay.includes(searchLower)) return false;
      }

      if (f.getaroundFilter) {
        if (!car.year || car.year < getaroundMinYear) return false;
        if (car.mileage && car.mileage >= GETAROUND_MAX_KM) return false;
        if (car.brand && GETAROUND_EXCLUDED_BRANDS.has(car.brand)) return false;
      }

      if (typeof f.prefs.maxListPrice === 'number' && car.price > f.prefs.maxListPrice) return false;

      const fair = typeof car.fairPrice === 'number' ? car.fairPrice : null;
      if (f.prefs.onlyBelowFair) {
        if (fair == null || !(car.price < fair)) return false;
      }
      if (f.prefs.minSavingKr != null && f.prefs.minSavingKr > 0) {
        if (fair == null || fair - car.price < f.prefs.minSavingKr) return false;
      }
      if (f.prefs.minConfidence != null) {
        if (typeof car.confidence !== 'number' || car.confidence < f.prefs.minConfidence) return false;
      }

      return true;
    });
  }, [
    cars,
    f.brandFilter, f.modelFilter, f.regionFilter, f.colorFilter, f.ownersFilter,
    f.fuelFilter, f.gearboxFilter, f.sellerTypeFilter, f.getaroundFilter,
    getaroundMinYear,
    f.onlyComplete, f.onlyWithImage,
    f.priceMin, f.priceMax, f.yearMin, f.yearMax, f.kmMin, f.kmMax,
    f.debouncedSearch, f.prefs,
  ]);

  const sortedDeals = useMemo(() => {
    const saving = (c: Car) => (
      typeof c.savingKr === 'number' ? c.savingKr
        : typeof c.fairPrice === 'number' ? c.fairPrice - c.price
        : -Infinity
    );
    const savingPct = (c: Car) => (
      typeof c.savingPct === 'number' ? c.savingPct
        : typeof c.fairPrice === 'number' && c.fairPrice > 0 ? (c.fairPrice - c.price) / c.fairPrice
        : -Infinity
    );
    const adTs = (c: Car) => {
      if (!c.adDate) return 0;
      const d = new Date(c.adDate).getTime();
      return Number.isFinite(d) ? d : 0;
    };

    const arr = matchingDeals.slice();
    switch (f.sortBy) {
      case 'priceAsc': arr.sort((a, b) => a.price - b.price); break;
      case 'priceDesc': arr.sort((a, b) => b.price - a.price); break;
      case 'yearDesc': arr.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)); break;
      case 'yearAsc': arr.sort((a, b) => (a.year ?? 99999) - (b.year ?? 99999)); break;
      case 'kmAsc': arr.sort((a, b) => (a.mileage ?? Infinity) - (b.mileage ?? Infinity)); break;
      case 'kmDesc': arr.sort((a, b) => (b.mileage ?? -1) - (a.mileage ?? -1)); break;
      case 'newest': arr.sort((a, b) => adTs(b) - adTs(a)); break;
      case 'confidence': arr.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)); break;
      case 'savingPct': arr.sort((a, b) => savingPct(b) - savingPct(a)); break;
      case 'dealScore': arr.sort((a, b) => (b.dealScore ?? -1) - (a.dealScore ?? -1)); break;
      case 'savingKr':
      default: arr.sort((a, b) => saving(b) - saving(a)); break;
    }
    return arr;
  }, [matchingDeals, f.sortBy]);

  return { matchingDeals, sortedDeals };
}
