import { useEffect } from 'react';

type StringKV = Record<string, string>;

/**
 * Two-way sync between a filter-state snapshot and `window.location.search`.
 * Read initial params synchronously via `readInitialParams()`, feed them into
 * `useFiltersState()` initial values, then call `useUrlSync(snapshot)` to
 * push changes back to the URL (debounced-ish by React's effect scheduler).
 *
 * We use `replaceState` — back button shouldn't replay filter churn.
 */
export function useUrlSync(snapshot: StringKV): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(snapshot)) {
      if (v && v !== 'all' && v !== 'false') params.set(k, v);
    }
    const qs = params.toString();
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', next);
  }, [JSON.stringify(snapshot)]);
}

export function readInitialParams(): StringKV {
  if (typeof window === 'undefined') return {};
  const sp = new URLSearchParams(window.location.search);
  const out: StringKV = {};
  sp.forEach((v, k) => { out[k] = v; });
  return out;
}
