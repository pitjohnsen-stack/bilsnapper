import { useCallback, useState } from 'react';

type Toast = { type: 'ok' | 'error'; msg: string } | null;

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      return body.error || body.message || `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  }
  const text = await response.text();
  return text || `HTTP ${response.status}`;
}

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
          throw new Error(await readErrorMessage(res));
        }
        showToast('ok', 'Scan er ferdig. Firestore er oppdatert med siste kjøring.');
        return;
      }

      const sameOriginBase = typeof window !== 'undefined' ? window.location.origin : '';
      if (!sameOriginBase) {
        showToast(
          'error',
          'Ingen scan-server er konfigurert her. Kjør appen via server.ts eller sett VITE_SCANNER_URL.',
        );
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
        if (res.status === 503) {
          showToast(
            'error',
            'Ingen scan-server er konfigurert her. Scraperen kjøres automatisk etter oppsettet på serveren.',
          );
          return;
        }
        throw new Error(await readErrorMessage(res));
      }
      showToast('ok', 'Scan startet via GitHub Actions. Resultater kommer når workflowen er ferdig.');
    } catch (e) {
      console.error(e);
      showToast('error', e instanceof Error ? e.message : 'Kunne ikke starte scan.');
    } finally {
      setScanning(false);
    }
  }, [scanning, showToast]);

  return { scanning, toast, triggerScraper };
}
