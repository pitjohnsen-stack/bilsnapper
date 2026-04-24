import { useCallback, useState } from 'react';

type Toast = { type: 'ok' | 'error'; msg: string } | null;

/**
 * Owns the "run a scan now" UX: endpoint selection (configured VITE_SCANNER_URL
 * vs. same-origin Vercel proxy to GitHub Actions), optimistic toast lifecycle,
 * and scanning/disabled state.
 *
 * The Vercel proxy exists so `GITHUB_TOKEN` never leaves the server.
 */
export function useScanTrigger(): {
  scanning: boolean;
  toast: Toast;
  triggerScraper: () => Promise<void>;
} {
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const showToast = useCallback((type: 'ok' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 6000);
  }, []);

  const triggerScraper = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    const configured = (import.meta.env.VITE_SCANNER_URL || '').trim().replace(/\/$/, '');
    const base =
      configured ||
      (import.meta.env.DEV && typeof window !== 'undefined' ? window.location.origin : '');

    try {
      if (base) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const secret = import.meta.env.VITE_SCAN_SECRET;
        if (secret) headers['x-scan-secret'] = secret;
        const res = await fetch(`${base}/scan`, { method: 'POST', headers, body: '{}' });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || `HTTP ${res.status}`);
        }
        showToast('ok', 'Scan er startet. Firestore oppdateres om noen minutter.');
        return;
      }

      const sameOriginBase = typeof window !== 'undefined' ? window.location.origin : '';
      if (!sameOriginBase) {
        showToast('error', 'Ingen scan-server konfigurert. Scraperen kjører automatisk hvert 6. time.');
        return;
      }
      const proxyHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      const proxySecret = import.meta.env.VITE_SCAN_SECRET;
      if (proxySecret) proxyHeaders['x-scan-secret'] = proxySecret;
      const res = await fetch(`${sameOriginBase}/api/trigger-github-scrape`, {
        method: 'POST',
        headers: proxyHeaders,
        body: '{}',
      });
      if (!res.ok) {
        const t = await res.text();
        if (res.status === 503) {
          showToast('error', 'Ingen scan-server konfigurert. Scraperen kjører automatisk hvert 6. time.');
          return;
        }
        throw new Error(t || `Proxy HTTP ${res.status}`);
      }
      showToast('ok', 'Scan startet via GitHub Actions — resultater om ca. 5–15 min.');
    } catch (e) {
      console.error(e);
      showToast('error', e instanceof Error ? e.message : 'Kunne ikke starte scan.');
    } finally {
      setScanning(false);
    }
  }, [scanning, showToast]);

  return { scanning, toast, triggerScraper };
}
