import { useCallback, useState } from 'react';
import type { Car } from '../types/car';

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
  return (await response.text()) || `HTTP ${response.status}`;
}

function apiBase(): string {
  const configured = (import.meta.env.VITE_SCANNER_URL || '').trim().replace(/\/$/, '');
  return configured || (typeof window !== 'undefined' ? window.location.origin : '');
}

export function useArchiveCar(): {
  archivingIds: Set<string>;
  archiveToast: Toast;
  archiveCar: (car: Car) => Promise<void>;
  checkFinnLink: (car: Car) => Promise<void>;
} {
  const [archivingIds, setArchivingIds] = useState<Set<string>>(() => new Set());
  const [archiveToast, setArchiveToast] = useState<Toast>(null);

  const showToast = useCallback((type: 'ok' | 'error', msg: string) => {
    setArchiveToast({ type, msg });
    setTimeout(() => setArchiveToast(null), 6000);
  }, []);

  const archiveCar = useCallback(async (car: Car) => {
    const carId = String(car.finnId || car.id || '').trim();
    if (!carId || archivingIds.has(carId)) return;

    setArchivingIds((prev) => new Set(prev).add(carId));
    try {
      const base = apiBase();
      if (!base) throw new Error('Ingen server er konfigurert for arkivering.');

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const secret = import.meta.env.VITE_SCAN_SECRET;
      if (secret) headers['x-scan-secret'] = secret;

      const res = await fetch(`${base}/api/cars/${encodeURIComponent(carId)}/archive`, {
        method: 'POST',
        headers,
        body: '{}',
      });
      if (!res.ok) throw new Error(await readErrorMessage(res));

      showToast('ok', `${car.brand ?? 'Annonse'} ${car.model ?? ''} er flyttet til arkiv.`.trim());
    } catch (e) {
      console.error(e);
      showToast('error', e instanceof Error ? e.message : 'Kunne ikke arkivere annonsen.');
    } finally {
      setArchivingIds((prev) => {
        const next = new Set(prev);
        next.delete(carId);
        return next;
      });
    }
  }, [archivingIds, showToast]);

  const checkFinnLink = useCallback(async (car: Car) => {
    const carId = String(car.finnId || car.id || '').trim();
    const finnUrl =
      car.url ||
      car.adUrl ||
      (carId ? `https://www.finn.no/car/used/ad.html?finnkode=${encodeURIComponent(carId)}` : '');
    if (!carId || !finnUrl) return;

    try {
      const base = apiBase();
      if (!base) return;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const secret = import.meta.env.VITE_SCAN_SECRET;
      if (secret) headers['x-scan-secret'] = secret;

      const res = await fetch(`${base}/api/cars/${encodeURIComponent(carId)}/check-finn-link`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: finnUrl }),
      });
      if (!res.ok) return;

      const body = (await res.json()) as { archived?: boolean };
      if (body.archived) {
        showToast('ok', 'FINN-lenken ga 404. Annonsen ble flyttet til arkiv.');
      }
    } catch (e) {
      console.warn('Kunne ikke sjekke FINN-lenke:', e);
    }
  }, [showToast]);

  return { archivingIds, archiveToast, archiveCar, checkFinnLink };
}
