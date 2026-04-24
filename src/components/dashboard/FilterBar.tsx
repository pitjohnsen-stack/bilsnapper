import { CheckCircle, Filter, ListFilter, X } from 'lucide-react';
import { selectBase } from '../../lib/dashboard-styles';
import type { SortKey } from '../../types/car';
import { GETAROUND_MAX_KM, GETAROUND_MAX_YEAR_AGE } from '../../hooks/useFilteredSortedDeals';

export interface FilterBarProps {
  isDarkMode: boolean;
  searchText: string;
  setSearchText: (v: string) => void;
  brandFilter: string;
  setBrandFilter: (v: string) => void;
  modelFilter: string;
  setModelFilter: (v: string) => void;
  regionFilter: string;
  setRegionFilter: (v: string) => void;
  sortBy: SortKey;
  setSortBy: (v: SortKey) => void;
  showAdvanced: boolean;
  toggleAdvanced: () => void;
  getaroundFilter: boolean;
  toggleGetaround: () => void;
  hasActiveFilters: boolean;
  onReset: () => void;
  uniqueBrands: string[];
  uniqueModels: string[];
  uniqueRegions: string[];
}

const SORT_OPTIONS: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: 'dealScore', label: 'Beste kupp (score)' },
  { value: 'savingKr', label: 'Størst besparelse (kr)' },
  { value: 'savingPct', label: 'Størst besparelse (%)' },
  { value: 'priceAsc', label: 'Pris ↑' },
  { value: 'priceDesc', label: 'Pris ↓' },
  { value: 'yearDesc', label: 'Nyest årsmodell' },
  { value: 'yearAsc', label: 'Eldst årsmodell' },
  { value: 'kmAsc', label: 'Færrest km' },
  { value: 'kmDesc', label: 'Flest km' },
  { value: 'newest', label: 'Nyeste annonse' },
  { value: 'confidence', label: 'Høyest confidence' },
];

export function FilterBar(props: FilterBarProps) {
  const {
    isDarkMode, searchText, setSearchText,
    brandFilter, setBrandFilter, modelFilter, setModelFilter,
    regionFilter, setRegionFilter, sortBy, setSortBy,
    showAdvanced, toggleAdvanced, getaroundFilter, toggleGetaround,
    hasActiveFilters, onReset,
    uniqueBrands, uniqueModels, uniqueRegions,
  } = props;
  const getaroundMinYear = new Date().getFullYear() - GETAROUND_MAX_YEAR_AGE;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
        <Filter size={18} className="text-teal-600 dark:text-teal-400" />
        Filter
      </span>
      <input
        type="search"
        placeholder="Søk merke/modell…"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        className={`min-w-[160px] flex-1 px-3 py-2.5 text-sm ${selectBase(isDarkMode)}`}
      />
      <select
        className={`min-w-[130px] flex-1 px-3 py-2.5 text-sm ${selectBase(isDarkMode)}`}
        value={brandFilter}
        onChange={(e) => { setBrandFilter(e.target.value); setModelFilter('all'); }}
      >
        <option value="all">Alle merker</option>
        {uniqueBrands.map((brand) => (
          <option key={brand} value={brand}>{brand}</option>
        ))}
      </select>
      <select
        className={`min-w-[130px] flex-1 px-3 py-2.5 text-sm ${selectBase(isDarkMode)}`}
        value={modelFilter}
        onChange={(e) => setModelFilter(e.target.value)}
        disabled={brandFilter === 'all'}
        title={brandFilter === 'all' ? 'Velg merke først' : ''}
      >
        <option value="all">Alle modeller</option>
        {uniqueModels.map((model) => (
          <option key={model} value={model}>{model}</option>
        ))}
      </select>
      <select
        className={`min-w-[130px] flex-1 px-3 py-2.5 text-sm ${selectBase(isDarkMode)}`}
        value={regionFilter}
        onChange={(e) => setRegionFilter(e.target.value)}
      >
        <option value="all">Alle steder</option>
        {uniqueRegions.map((region) => (
          <option key={region} value={region}>{region}</option>
        ))}
      </select>
      <select
        className={`min-w-[150px] flex-1 px-3 py-2.5 text-sm ${selectBase(isDarkMode)}`}
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as SortKey)}
        title="Sortering"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={toggleAdvanced}
        className={
          isDarkMode
            ? 'flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700'
            : 'flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50'
        }
      >
        <ListFilter size={14} />
        {showAdvanced ? 'Skjul avansert' : 'Flere filtre'}
      </button>
      <button
        type="button"
        onClick={toggleGetaround}
        className={
          getaroundFilter
            ? 'flex items-center gap-2 rounded-lg border border-teal-500 bg-teal-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition'
            : isDarkMode
              ? 'flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700'
              : 'flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50'
        }
        title={`Vis kun biler egnet for Getaround (≥${getaroundMinYear}, <${GETAROUND_MAX_KM.toLocaleString('no-NO')} km)`}
      >
        <CheckCircle size={15} />
        Getaround-egnet
      </button>
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onReset}
          className={
            isDarkMode
              ? 'flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700'
              : 'flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50'
          }
        >
          <X size={14} />
          Nullstill
        </button>
      )}
    </div>
  );
}
