import { selectBase } from '../../lib/dashboard-styles';

export interface AdvancedFiltersProps {
  isDarkMode: boolean;
  fuelFilter: string;
  setFuelFilter: (v: string) => void;
  gearboxFilter: string;
  setGearboxFilter: (v: string) => void;
  sellerTypeFilter: string;
  setSellerTypeFilter: (v: string) => void;
  colorFilter: string;
  setColorFilter: (v: string) => void;
  ownersFilter: string;
  setOwnersFilter: (v: string) => void;
  priceMin: string; setPriceMin: (v: string) => void;
  priceMax: string; setPriceMax: (v: string) => void;
  yearMin: string; setYearMin: (v: string) => void;
  yearMax: string; setYearMax: (v: string) => void;
  kmMin: string; setKmMin: (v: string) => void;
  kmMax: string; setKmMax: (v: string) => void;
  onlyComplete: boolean; setOnlyComplete: (v: boolean) => void;
  onlyWithImage: boolean; setOnlyWithImage: (v: boolean) => void;
  uniqueFuels: string[];
  uniqueGearboxes: string[];
  uniqueSellerTypes: string[];
  uniqueColors: string[];
}

export function AdvancedFilters(p: AdvancedFiltersProps) {
  const cls = `px-3 py-2 text-sm ${selectBase(p.isDarkMode)}`;
  const inputCls = `w-full px-3 py-2 text-sm ${selectBase(p.isDarkMode)}`;
  return (
    <div className="grid grid-cols-2 gap-3 border-t border-slate-200/60 pt-3 dark:border-slate-700/60 sm:grid-cols-3 lg:grid-cols-4">
      <select className={cls} value={p.fuelFilter} onChange={(e) => p.setFuelFilter(e.target.value)}>
        <option value="all">Alle drivstoff</option>
        {p.uniqueFuels.map((f) => <option key={f} value={f}>{f}</option>)}
      </select>
      <select className={cls} value={p.gearboxFilter} onChange={(e) => p.setGearboxFilter(e.target.value)}>
        <option value="all">Alle girkasser</option>
        {p.uniqueGearboxes.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
      <select className={cls} value={p.sellerTypeFilter} onChange={(e) => p.setSellerTypeFilter(e.target.value)}>
        <option value="all">Alle selgere</option>
        {p.uniqueSellerTypes.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select className={cls} value={p.colorFilter} onChange={(e) => p.setColorFilter(e.target.value)}>
        <option value="all">Alle farger</option>
        {p.uniqueColors.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select className={cls} value={p.ownersFilter} onChange={(e) => p.setOwnersFilter(e.target.value)}>
        <option value="all">Alle eiere</option>
        <option value="1">1 eier</option>
        <option value="2+">Flere eiere</option>
      </select>
      <div className="flex gap-2">
        <input type="number" inputMode="numeric" placeholder="Pris fra" value={p.priceMin} onChange={(e) => p.setPriceMin(e.target.value)} className={inputCls} />
        <input type="number" inputMode="numeric" placeholder="Pris til" value={p.priceMax} onChange={(e) => p.setPriceMax(e.target.value)} className={inputCls} />
      </div>
      <div className="flex gap-2">
        <input type="number" inputMode="numeric" placeholder="År fra" value={p.yearMin} onChange={(e) => p.setYearMin(e.target.value)} className={inputCls} />
        <input type="number" inputMode="numeric" placeholder="År til" value={p.yearMax} onChange={(e) => p.setYearMax(e.target.value)} className={inputCls} />
      </div>
      <div className="flex gap-2">
        <input type="number" inputMode="numeric" placeholder="Km fra" value={p.kmMin} onChange={(e) => p.setKmMin(e.target.value)} className={inputCls} />
        <input type="number" inputMode="numeric" placeholder="Km til" value={p.kmMax} onChange={(e) => p.setKmMax(e.target.value)} className={inputCls} />
      </div>
      <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 sm:col-span-1">
        <input type="checkbox" checked={p.onlyComplete} onChange={(e) => p.setOnlyComplete(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
        Kun komplette data
      </label>
      <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 sm:col-span-1">
        <input type="checkbox" checked={p.onlyWithImage} onChange={(e) => p.setOnlyWithImage(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
        Kun med bilde
      </label>
    </div>
  );
}
