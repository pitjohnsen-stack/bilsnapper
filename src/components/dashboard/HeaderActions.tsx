import { Download, History, LayoutDashboard, Moon, RefreshCw, Sun } from 'lucide-react';

type Tab = 'oversikt' | 'historikk';

export interface HeaderActionsProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  scanning: boolean;
  onScan: () => void;
  onExport: () => void;
  canExport: boolean;
  statsCalculatedAt?: string | number;
  lastScanLabel: string | null;
}

export function HeaderActions({
  isDarkMode,
  toggleDarkMode,
  activeTab,
  onTabChange,
  scanning,
  onScan,
  onExport,
  canExport,
  statsCalculatedAt,
  lastScanLabel,
}: HeaderActionsProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Markedsoversikt
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Marked statistikk:{' '}
          {statsCalculatedAt ? new Date(statsCalculatedAt).toLocaleString('no-NO') : '—'}
          {' · '}
          <span className="inline-flex items-center gap-1">
            <RefreshCw size={14} className="inline shrink-0 opacity-70" aria-hidden />
            Siste fullførte scan: {lastScanLabel ?? '—'}
          </span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div
          className={
            isDarkMode
              ? 'flex rounded-xl border border-slate-600/80 bg-slate-800/80 p-1'
              : 'flex rounded-xl border border-slate-200 bg-slate-100/80 p-1'
          }
        >
          <button
            type="button"
            onClick={() => onTabChange('oversikt')}
            className={
              activeTab === 'oversikt'
                ? 'flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-teal-900/30'
                : 'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }
          >
            <LayoutDashboard size={16} /> Oversikt
          </button>
          <button
            type="button"
            onClick={() => onTabChange('historikk')}
            className={
              activeTab === 'historikk'
                ? 'flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-teal-900/30'
                : 'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }
          >
            <History size={16} /> Historikk
          </button>
        </div>
        <button
          type="button"
          onClick={toggleDarkMode}
          className={
            isDarkMode
              ? 'rounded-xl border border-slate-600 bg-slate-800 p-2.5 text-amber-300 transition hover:bg-slate-700'
              : 'rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition hover:bg-slate-50'
          }
          aria-label={isDarkMode ? 'Lys modus' : 'Mørk modus'}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button
          type="button"
          onClick={onScan}
          disabled={scanning}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-900/25 transition hover:from-teal-500 hover:to-teal-600 disabled:opacity-60"
        >
          {scanning ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Starter…
            </>
          ) : (
            'Kjør scan'
          )}
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={!canExport}
          className={
            !canExport
              ? isDarkMode
                ? 'flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-slate-500'
                : 'flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-400'
              : isDarkMode
                ? 'flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-700'
                : 'flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50'
          }
        >
          <Download size={18} />
          Eksporter CSV
        </button>
      </div>
    </div>
  );
}
