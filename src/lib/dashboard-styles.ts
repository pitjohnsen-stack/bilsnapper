/**
 * Shared Tailwind class builders for the dashboard surface.
 * Kept in one place so light/dark parity stays consistent as sections grow.
 */

export const chartPrimary = '#0d9488';
export const chartSecondary = '#f59e0b';
export const chartMuted = '#94a3b8';

export function selectBase(isDark: boolean): string {
  return isDark
    ? 'rounded-lg border border-slate-700/80 bg-slate-800/80 text-slate-100 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25'
    : 'rounded-lg border border-slate-200 bg-white text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';
}

export function cardClass(isDark: boolean): string {
  return isDark
    ? 'rounded-2xl border border-slate-700/60 bg-slate-800/50 p-6 shadow-lg shadow-black/20'
    : 'rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50';
}
