import { Car as CarIcon, Sparkles, Tag } from 'lucide-react';
import { cardClass } from '../../lib/dashboard-styles';
import { formatKr } from '../../lib/format';

export interface StatsCardsProps {
  isDarkMode: boolean;
  totalActive: number;
  medianAcrossFilter: number | null;
  sampleHint: string;
  possibleDeals: number;
  matchingCount: number;
}

export function StatsCards({
  isDarkMode, totalActive, medianAcrossFilter, sampleHint, possibleDeals, matchingCount,
}: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      <div className={cardClass(isDarkMode)}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Aktive annonser</h3>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400">
            <CarIcon size={22} />
          </div>
        </div>
        <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{totalActive}</p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">I databasen (aktive, ikke auksjon)</p>
      </div>

      <div className={cardClass(isDarkMode)}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Median (filter)</h3>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Tag size={22} />
          </div>
        </div>
        <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
          {formatKr(medianAcrossFilter)}
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{sampleHint}</p>
      </div>

      <div className={cardClass(isDarkMode)}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Mulige kupp</h3>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Sparkles size={22} />
          </div>
        </div>
        <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{possibleDeals}</p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Annonser under beregnet verdi (av {matchingCount} treff)
        </p>
      </div>
    </div>
  );
}
