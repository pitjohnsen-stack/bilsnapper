import { useMemo, useState } from 'react';
import { downloadDealsCsv } from '../lib/csvExport';
import { useDashboardData } from '../hooks/useDashboardData';
import { useDebounced } from '../hooks/useDebounced';
import { filtersFromParams, useFiltersState } from '../hooks/useFiltersState';
import { useFilteredSortedDeals } from '../hooks/useFilteredSortedDeals';
import { useScanTrigger } from '../hooks/useScanTrigger';
import { readInitialParams, useUrlSync } from '../hooks/useUrlSync';
import { useWatchlist } from '../hooks/useWatchlist';
import type { mergeUserSettings } from '../types/userSettings';
import type { Car } from '../types/car';
import DashboardSkeleton from './DashboardSkeleton';
import { AdvancedFilters } from './dashboard/AdvancedFilters';
import { DealsGrid } from './dashboard/DealsGrid';
import { FilterBar } from './dashboard/FilterBar';
import { HeaderActions } from './dashboard/HeaderActions';
import { HistoryChart } from './dashboard/HistoryChart';
import { PriceCharts } from './dashboard/PriceCharts';
import { StatsCards } from './dashboard/StatsCards';

type Prefs = ReturnType<typeof mergeUserSettings>;
type Tab = 'oversikt' | 'historikk';

export interface DashboardProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  userId: string;
  prefs: Prefs;
}

/**
 * Top-level dashboard. Pure composition + derivations — all state, data
 * fetching, and derived logic live in dedicated hooks/components. Keep this
 * file small.
 */
export default function Dashboard({ isDarkMode, toggleDarkMode, userId, prefs }: DashboardProps) {
  const { cars, stats, lastScanLabel, loading } = useDashboardData();
  const filters = useFiltersState(filtersFromParams(readInitialParams()));
  const debouncedSearch = useDebounced(filters.searchText, 300);
  useUrlSync({
    brand: filters.brandFilter, model: filters.modelFilter, region: filters.regionFilter,
    color: filters.colorFilter, owners: filters.ownersFilter, fuel: filters.fuelFilter,
    gearbox: filters.gearboxFilter, seller: filters.sellerTypeFilter,
    getaround: String(filters.getaroundFilter), complete: String(filters.onlyComplete),
    withImage: String(filters.onlyWithImage),
    priceMin: filters.priceMin, priceMax: filters.priceMax,
    yearMin: filters.yearMin, yearMax: filters.yearMax,
    kmMin: filters.kmMin, kmMax: filters.kmMax,
    q: debouncedSearch, sort: filters.sortBy,
  });
  const { scanning, toast, triggerScraper } = useScanTrigger();
  const { watchedIds, toggleWatch } = useWatchlist(userId);
  const [activeTab, setActiveTab] = useState<Tab>('oversikt');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const uniqueBrands = useMemo(
    () => dedupSorted(cars.map((c) => c.brand)),
    [cars],
  );
  const uniqueModels = useMemo(
    () => dedupSorted(
      cars
        .filter((c) => filters.brandFilter === 'all' || c.brand === filters.brandFilter)
        .map((c) => c.model),
    ),
    [cars, filters.brandFilter],
  );
  const uniqueRegions = useMemo(() => dedupSorted(cars.map((c) => c.region || c.location)), [cars]);
  const uniqueColors = useMemo(() => dedupSorted(cars.map((c) => c.color)), [cars]);
  const uniqueFuels = useMemo(() => dedupSorted(cars.map((c) => c.fuel)), [cars]);
  const uniqueGearboxes = useMemo(() => dedupSorted(cars.map((c) => c.gearbox)), [cars]);
  const uniqueSellerTypes = useMemo(() => dedupSorted(cars.map((c) => c.sellerType)), [cars]);

  const { matchingDeals, sortedDeals } = useFilteredSortedDeals(cars, {
    brandFilter: filters.brandFilter,
    modelFilter: filters.modelFilter,
    regionFilter: filters.regionFilter,
    colorFilter: filters.colorFilter,
    ownersFilter: filters.ownersFilter,
    fuelFilter: filters.fuelFilter,
    gearboxFilter: filters.gearboxFilter,
    sellerTypeFilter: filters.sellerTypeFilter,
    getaroundFilter: filters.getaroundFilter,
    onlyComplete: filters.onlyComplete,
    onlyWithImage: filters.onlyWithImage,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    yearMin: filters.yearMin,
    yearMax: filters.yearMax,
    kmMin: filters.kmMin,
    kmMax: filters.kmMax,
    debouncedSearch,
    sortBy: filters.sortBy,
    prefs,
  });

  const favoriteFiltered = useMemo(
    () => (onlyFavorites ? sortedDeals.filter((c) => watchedIds.has(c.id)) : sortedDeals),
    [sortedDeals, onlyFavorites, watchedIds],
  );

  const filteredDeals = useMemo(
    () => favoriteFiltered.slice(0, prefs.listLimit),
    [favoriteFiltered, prefs.listLimit],
  );

  const filteredStats = useMemo(() => {
    if (filters.brandFilter === 'all') return stats.slice(0, 5);
    return stats.filter((s) => s.brand === filters.brandFilter).slice(0, 5);
  }, [stats, filters.brandFilter]);

  const statsChartRows = useMemo(
    () => filteredStats.map((s) => ({
      id: s.id,
      label: `${s.brand ?? ''} ${s.model ?? ''}`.trim() || s.id,
      avg: typeof s.avgPrice === 'number' ? s.avgPrice : null,
      median: typeof s.medianPrice === 'number' ? s.medianPrice : null,
    })),
    [filteredStats],
  );

  const scatterData = useMemo(
    () => filteredDeals.map((c) => ({
      mileage: c.mileage ?? c.km ?? 0,
      price: c.price,
      brand: c.brand,
    })),
    [filteredDeals],
  );

  const reversedStats = useMemo(() => stats.slice().reverse(), [stats]);

  const medianAcrossFilter =
    filteredStats.length && typeof filteredStats[0].medianPrice === 'number'
      ? filteredStats[0].medianPrice
      : null;
  const sampleHint =
    filteredStats.length && typeof filteredStats[0].sampleSize === 'number'
      ? `n ≈ ${filteredStats[0].sampleSize} annonser (siste utvalg)`
      : 'Basert på siste beregnede utvalg';

  if (loading) return <DashboardSkeleton isDarkMode={isDarkMode} />;

  const possibleDeals = matchingDeals.filter(
    (c) => typeof c.fairPrice === 'number' && c.price < c.fairPrice,
  ).length;

  return (
    <div className="space-y-8">
      <HeaderActions
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        scanning={scanning}
        onScan={triggerScraper}
        onExport={() =>
          downloadDealsCsv(
            matchingDeals as unknown as Record<string, unknown>[],
            `bruktbil-utvalg-${userId.slice(0, 8)}.csv`,
          )
        }
        canExport={matchingDeals.length > 0}
        statsCalculatedAt={stats[0]?.calculatedAt}
        lastScanLabel={lastScanLabel}
      />

      {toast && (
        <div
          className={
            toast.type === 'ok'
              ? 'rounded-xl border border-teal-500/30 bg-teal-950/30 px-4 py-3 text-sm text-teal-100 dark:text-teal-200'
              : 'rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200'
          }
          role="status"
        >
          {toast.msg}
        </div>
      )}

      <p
        className={
          isDarkMode
            ? 'rounded-xl border border-amber-500/20 bg-amber-950/25 px-4 py-3 text-center text-xs text-amber-100/90'
            : 'rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-center text-xs text-amber-950/90'
        }
      >
        Anslåtte priser og «kupp» er veiledende modellutdata — ikke erstatning for egen vurdering eller rådgivning.
      </p>

      <div
        className={
          isDarkMode
            ? 'space-y-3 rounded-2xl border border-slate-700/60 bg-slate-800/40 p-4'
            : 'space-y-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm'
        }
      >
        <FilterBar
          isDarkMode={isDarkMode}
          searchText={filters.searchText}
          setSearchText={filters.setSearchText}
          brandFilter={filters.brandFilter}
          setBrandFilter={filters.setBrandFilter}
          modelFilter={filters.modelFilter}
          setModelFilter={filters.setModelFilter}
          regionFilter={filters.regionFilter}
          setRegionFilter={filters.setRegionFilter}
          sortBy={filters.sortBy}
          setSortBy={filters.setSortBy}
          showAdvanced={filters.showAdvanced}
          toggleAdvanced={() => filters.setShowAdvanced((v) => !v)}
          getaroundFilter={filters.getaroundFilter}
          toggleGetaround={() => filters.setGetaroundFilter((v) => !v)}
          hasActiveFilters={filters.hasActiveFilters()}
          onReset={filters.resetAll}
          uniqueBrands={uniqueBrands}
          uniqueModels={uniqueModels}
          uniqueRegions={uniqueRegions}
        />
        {filters.showAdvanced && (
          <AdvancedFilters
            isDarkMode={isDarkMode}
            fuelFilter={filters.fuelFilter}
            setFuelFilter={filters.setFuelFilter}
            gearboxFilter={filters.gearboxFilter}
            setGearboxFilter={filters.setGearboxFilter}
            sellerTypeFilter={filters.sellerTypeFilter}
            setSellerTypeFilter={filters.setSellerTypeFilter}
            colorFilter={filters.colorFilter}
            setColorFilter={filters.setColorFilter}
            ownersFilter={filters.ownersFilter}
            setOwnersFilter={filters.setOwnersFilter}
            priceMin={filters.priceMin} setPriceMin={filters.setPriceMin}
            priceMax={filters.priceMax} setPriceMax={filters.setPriceMax}
            yearMin={filters.yearMin} setYearMin={filters.setYearMin}
            yearMax={filters.yearMax} setYearMax={filters.setYearMax}
            kmMin={filters.kmMin} setKmMin={filters.setKmMin}
            kmMax={filters.kmMax} setKmMax={filters.setKmMax}
            onlyComplete={filters.onlyComplete}
            setOnlyComplete={filters.setOnlyComplete}
            onlyWithImage={filters.onlyWithImage}
            setOnlyWithImage={filters.setOnlyWithImage}
            uniqueFuels={uniqueFuels}
            uniqueGearboxes={uniqueGearboxes}
            uniqueSellerTypes={uniqueSellerTypes}
            uniqueColors={uniqueColors}
          />
        )}
      </div>

      {activeTab === 'oversikt' ? (
        <>
          <StatsCards
            isDarkMode={isDarkMode}
            totalActive={cars.length}
            medianAcrossFilter={medianAcrossFilter}
            sampleHint={sampleHint}
            possibleDeals={possibleDeals}
            matchingCount={matchingDeals.length}
          />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Utvalgte annonser</h3>
                <button
                  type="button"
                  onClick={() => setOnlyFavorites((v) => !v)}
                  className={
                    onlyFavorites
                      ? 'rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-600'
                      : 'rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
                  }
                  title={onlyFavorites ? 'Viser kun favoritter' : 'Vis kun favoritter'}
                >
                  {watchedIds.size > 0 ? `♥ Favoritter (${watchedIds.size})` : '♥ Favoritter'}
                </button>
              </div>
              <DealsGrid
                deals={filteredDeals}
                isDarkMode={isDarkMode}
                watchedIds={watchedIds}
                onToggleWatch={(c) =>
                  toggleWatch(c.id, { brand: c.brand, model: c.model, price: c.price })
                }
              />
            </div>
            <PriceCharts
              isDarkMode={isDarkMode}
              statsChartRows={statsChartRows}
              scatterData={scatterData}
              deals={filteredDeals}
            />
          </div>
        </>
      ) : (
        <HistoryChart
          isDarkMode={isDarkMode}
          reversedStats={reversedStats}
          brandFilter={filters.brandFilter}
        />
      )}

    </div>
  );
}

function dedupSorted(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values))
    .filter((v): v is string => Boolean(v) && v !== 'Ukjent')
    .sort();
}

// Tree-shake guard: keep `Car` referenced for consumers that re-export it via
// barrel files without pulling the type import across the boundary.
export type { Car };
