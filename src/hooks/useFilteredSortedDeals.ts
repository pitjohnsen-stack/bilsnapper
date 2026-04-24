import { useMemo } from 'react';
import type { Car, SortKey } from '../types/car';
import type { mergeUserSettings } from '../types/userSettings';
import { filterCars, sortCars, GETAROUND_MAX_KM, GETAROUND_MAX_YEAR_AGE } from '../lib/deals-engine';

export { GETAROUND_MAX_KM, GETAROUND_MAX_YEAR_AGE };

type Prefs = ReturnType<typeof mergeUserSettings>;

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

/**
 * Two-stage memo over the pure engine in `lib/deals-engine.ts`. Sort changes
 * shouldn't re-filter; filter changes shouldn't re-sort.
 */
export function useFilteredSortedDeals(cars: Car[], f: FilterInputs): {
  matchingDeals: Car[];
  sortedDeals: Car[];
} {
  const matchingDeals = useMemo(
    () => filterCars(cars, f),
    [
      cars,
      f.brandFilter, f.modelFilter, f.regionFilter, f.colorFilter, f.ownersFilter,
      f.fuelFilter, f.gearboxFilter, f.sellerTypeFilter, f.getaroundFilter,
      f.onlyComplete, f.onlyWithImage,
      f.priceMin, f.priceMax, f.yearMin, f.yearMax, f.kmMin, f.kmMax,
      f.debouncedSearch, f.prefs,
    ],
  );

  const sortedDeals = useMemo(() => sortCars(matchingDeals, f.sortBy), [matchingDeals, f.sortBy]);

  return { matchingDeals, sortedDeals };
}
