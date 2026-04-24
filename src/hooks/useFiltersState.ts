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

export function useFiltersState(): FiltersState & FiltersActions {
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [colorFilter, setColorFilter] = useState<string>('all');
  const [ownersFilter, setOwnersFilter] = useState<string>('all');
  const [fuelFilter, setFuelFilter] = useState<string>('all');
  const [gearboxFilter, setGearboxFilter] = useState<string>('all');
  const [sellerTypeFilter, setSellerTypeFilter] = useState<string>('all');
  const [getaroundFilter, setGetaroundFilter] = useState<boolean>(false);
  const [onlyComplete, setOnlyComplete] = useState<boolean>(false);
  const [onlyWithImage, setOnlyWithImage] = useState<boolean>(false);
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  const [yearMin, setYearMin] = useState<string>('');
  const [yearMax, setYearMax] = useState<string>('');
  const [kmMin, setKmMin] = useState<string>('');
  const [kmMax, setKmMax] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortKey>('savingKr');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

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
