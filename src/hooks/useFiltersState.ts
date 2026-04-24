import { useCallback, useState } from 'react';
import type { SortKey } from '../types/car';

/**
 * Canonical dashboard filter/sort state. One place for every knob the user
 * can turn, so `resetAll()` is exhaustive and `useFilteredSortedDeals` gets a
 * stable input shape.
 */
export interface FiltersState {
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
  searchText: string;
  sortBy: SortKey;
  showAdvanced: boolean;
}

export interface FiltersActions {
  setBrandFilter: (v: string) => void;
  setModelFilter: (v: string) => void;
  setRegionFilter: (v: string) => void;
  setColorFilter: (v: string) => void;
  setOwnersFilter: (v: string) => void;
  setFuelFilter: (v: string) => void;
  setGearboxFilter: (v: string) => void;
  setSellerTypeFilter: (v: string) => void;
  setGetaroundFilter: (v: boolean | ((prev: boolean) => boolean)) => void;
  setOnlyComplete: (v: boolean) => void;
  setOnlyWithImage: (v: boolean) => void;
  setPriceMin: (v: string) => void;
  setPriceMax: (v: string) => void;
  setYearMin: (v: string) => void;
  setYearMax: (v: string) => void;
  setKmMin: (v: string) => void;
  setKmMax: (v: string) => void;
  setSearchText: (v: string) => void;
  setSortBy: (v: SortKey) => void;
  setShowAdvanced: (v: boolean | ((prev: boolean) => boolean)) => void;
  resetAll: () => void;
  hasActiveFilters: () => boolean;
}

/** Hydrate filter defaults from a URL-param snapshot (string keys only). */
export function filtersFromParams(p: Record<string, string> = {}): Partial<FiltersState> {
  return {
    brandFilter: p.brand || 'all',
    modelFilter: p.model || 'all',
    regionFilter: p.region || 'all',
    colorFilter: p.color || 'all',
    ownersFilter: p.owners || 'all',
    fuelFilter: p.fuel || 'all',
    gearboxFilter: p.gearbox || 'all',
    sellerTypeFilter: p.seller || 'all',
    getaroundFilter: p.getaround === 'true',
    onlyComplete: p.complete === 'true',
    onlyWithImage: p.withImage === 'true',
    priceMin: p.priceMin || '',
    priceMax: p.priceMax || '',
    yearMin: p.yearMin || '',
    yearMax: p.yearMax || '',
    kmMin: p.kmMin || '',
    kmMax: p.kmMax || '',
    searchText: p.q || '',
    sortBy: (p.sort as SortKey) || 'savingKr',
  };
}

export function useFiltersState(initial: Partial<FiltersState> = {}): FiltersState & FiltersActions {
  const [brandFilter, setBrandFilter] = useState<string>(initial.brandFilter ?? 'all');
  const [modelFilter, setModelFilter] = useState<string>(initial.modelFilter ?? 'all');
  const [regionFilter, setRegionFilter] = useState<string>(initial.regionFilter ?? 'all');
  const [colorFilter, setColorFilter] = useState<string>(initial.colorFilter ?? 'all');
  const [ownersFilter, setOwnersFilter] = useState<string>(initial.ownersFilter ?? 'all');
  const [fuelFilter, setFuelFilter] = useState<string>(initial.fuelFilter ?? 'all');
  const [gearboxFilter, setGearboxFilter] = useState<string>(initial.gearboxFilter ?? 'all');
  const [sellerTypeFilter, setSellerTypeFilter] = useState<string>(initial.sellerTypeFilter ?? 'all');
  const [getaroundFilter, setGetaroundFilter] = useState<boolean>(initial.getaroundFilter ?? false);
  const [onlyComplete, setOnlyComplete] = useState<boolean>(initial.onlyComplete ?? false);
  const [onlyWithImage, setOnlyWithImage] = useState<boolean>(initial.onlyWithImage ?? false);
  const [priceMin, setPriceMin] = useState<string>(initial.priceMin ?? '');
  const [priceMax, setPriceMax] = useState<string>(initial.priceMax ?? '');
  const [yearMin, setYearMin] = useState<string>(initial.yearMin ?? '');
  const [yearMax, setYearMax] = useState<string>(initial.yearMax ?? '');
  const [kmMin, setKmMin] = useState<string>(initial.kmMin ?? '');
  const [kmMax, setKmMax] = useState<string>(initial.kmMax ?? '');
  const [searchText, setSearchText] = useState<string>(initial.searchText ?? '');
  const [sortBy, setSortBy] = useState<SortKey>(initial.sortBy ?? 'savingKr');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(initial.showAdvanced ?? false);

  const resetAll = useCallback(() => {
    setBrandFilter('all');
    setModelFilter('all');
    setRegionFilter('all');
    setColorFilter('all');
    setOwnersFilter('all');
    setFuelFilter('all');
    setGearboxFilter('all');
    setSellerTypeFilter('all');
    setGetaroundFilter(false);
    setOnlyComplete(false);
    setOnlyWithImage(false);
    setSearchText('');
    setPriceMin('');
    setPriceMax('');
    setYearMin('');
    setYearMax('');
    setKmMin('');
    setKmMax('');
  }, []);

  const hasActiveFilters = useCallback(
    () =>
      brandFilter !== 'all' ||
      modelFilter !== 'all' ||
      regionFilter !== 'all' ||
      colorFilter !== 'all' ||
      ownersFilter !== 'all' ||
      fuelFilter !== 'all' ||
      gearboxFilter !== 'all' ||
      sellerTypeFilter !== 'all' ||
      getaroundFilter ||
      onlyComplete ||
      onlyWithImage ||
      Boolean(searchText) ||
      Boolean(priceMin) ||
      Boolean(priceMax) ||
      Boolean(yearMin) ||
      Boolean(yearMax) ||
      Boolean(kmMin) ||
      Boolean(kmMax),
    [
      brandFilter, modelFilter, regionFilter, colorFilter, ownersFilter,
      fuelFilter, gearboxFilter, sellerTypeFilter, getaroundFilter,
      onlyComplete, onlyWithImage, searchText,
      priceMin, priceMax, yearMin, yearMax, kmMin, kmMax,
    ],
  );

  return {
    brandFilter, modelFilter, regionFilter, colorFilter, ownersFilter,
    fuelFilter, gearboxFilter, sellerTypeFilter, getaroundFilter,
    onlyComplete, onlyWithImage,
    priceMin, priceMax, yearMin, yearMax, kmMin, kmMax,
    searchText, sortBy, showAdvanced,
    setBrandFilter, setModelFilter, setRegionFilter, setColorFilter,
    setOwnersFilter, setFuelFilter, setGearboxFilter, setSellerTypeFilter,
    setGetaroundFilter, setOnlyComplete, setOnlyWithImage,
    setPriceMin, setPriceMax, setYearMin, setYearMax, setKmMin, setKmMax,
    setSearchText, setSortBy, setShowAdvanced,
    resetAll, hasActiveFilters,
  };
}
