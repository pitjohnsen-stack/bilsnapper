import { X } from 'lucide-react';
import type { Car } from '../../types/car';

export interface ComparePanelProps {
  cars: Car[];
  isDarkMode: boolean;
  onRemove: (car: Car) => void;
  onClear: () => void;
}

/**
 * Side-by-side comparison of up to 4 selected cars. Renders a horizontally
 * scrollable table with key specs. Closes automatically when `cars` is empty
 * (the parent should not render it then, but we guard anyway).
 */
export function ComparePanel({ cars, isDarkMode, onRemove, onClear }: ComparePanelProps) {
  if (!cars.length) return null;

  const rows: Array<{ label: string; get: (c: Car) => string }> = [
    { label: 'Merke', get: (c) => c.brand ?? '—' },
    { label: 'Modell', get: (c) => c.model ?? '—' },
    { label: 'Årsmodell', get: (c) => (c.year && c.year > 0 ? String(c.year) : '—') },
    { label: 'Pris', get: (c) => `${c.price.toLocaleString('no-NO')} kr` },
    {
      label: 'Antatt markedspris',
      get: (c) => (typeof c.fairPrice === 'number' ? `${c.fairPrice.toLocaleString('no-NO')} kr` : '—'),
    },
    {
      label: 'Besparelse',
      get: (c) => {
        if (typeof c.fairPrice !== 'number') return '—';
        const s = c.fairPrice - c.price;
        return s > 0 ? `${s.toLocaleString('no-NO')} kr` : '—';
      },
    },
    {
      label: 'Kilometer',
      get: (c) => {
        const km = c.mileage ?? c.km;
        return km != null && km > 0 ? `${Number(km).toLocaleString('no-NO')} km` : '—';
      },
    },
    { label: 'Drivstoff', get: (c) => c.fuel ?? '—' },
    { label: 'Girkasse', get: (c) => c.gearbox ?? '—' },
    { label: 'Farge', get: (c) => c.color ?? '—' },
    { label: 'Eiere', get: (c) => (c.owners != null ? String(c.owners) : '—') },
    { label: 'Region', get: (c) => c.region || c.location || '—' },
    { label: 'Selger', get: (c) => c.sellerType ?? '—' },
    {
      label: 'Tillit',
      get: (c) => (typeof c.confidence === 'number' ? `${Math.round(c.confidence * 100)}%` : '—'),
    },
  ];

  return (
    <section
      aria-label="Sammenlign biler"
      className={
        isDarkMode
          ? 'rounded-2xl border border-slate-700/60 bg-slate-800/40 p-4'
          : 'rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm'
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Sammenlign ({cars.length})
        </h3>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-slate-500 hover:text-rose-500 dark:text-slate-400"
        >
          Tøm
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-inherit px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Spesifikasjon
              </th>
              {cars.map((c) => (
                <th
                  key={c.id}
                  className="px-3 py-2 text-left align-top text-slate-700 dark:text-slate-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">
                        {c.brand} {c.model}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {c.year && c.year > 0 ? c.year : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(c)}
                      aria-label={`Fjern ${c.brand} ${c.model} fra sammenligning`}
                      className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-700"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-slate-200/60 dark:border-slate-700/60">
                <td className="sticky left-0 z-10 bg-inherit px-2 py-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {row.label}
                </td>
                {cars.map((c) => (
                  <td
                    key={c.id}
                    className="px-3 py-2 tabular-nums text-slate-700 dark:text-slate-200"
                  >
                    {row.get(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
