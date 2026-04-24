import { ListFilter } from 'lucide-react';
import { cardClass } from '../../lib/dashboard-styles';
import type { Car } from '../../types/car';
import { DealCard } from './DealCard';

export interface DealsGridProps {
  deals: Car[];
  isDarkMode: boolean;
}

export function DealsGrid({ deals, isDarkMode }: DealsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {deals.map((car) => (
        <DealCard key={car.id} car={car} isDarkMode={isDarkMode} />
      ))}
      {deals.length === 0 && (
        <div className={`col-span-2 flex flex-col items-center gap-4 py-20 ${cardClass(isDarkMode)}`}>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700/60">
            <ListFilter size={28} className="text-slate-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-slate-700 dark:text-slate-300">Ingen treff</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Prøv å endre filtrene eller innstillingene dine.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
