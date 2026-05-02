import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { formatScanTime } from '../lib/format';
import type { Car, MarketStat } from '../types/car';

const MAX_STATS = 50;

function describeFirestoreError(error: unknown, source: string): { message: string; fatal: boolean } {
  const code =
    error && typeof error === 'object' && 'code' in error ? String((error as { code: string }).code) : '';

  if (code === 'resource-exhausted') {
    return {
      message:
        'Firestore-kvoten er brukt opp for dagen på dette prosjektet. Dashboardet stopper lesing til kvoten er tilbake eller prosjektet oppgraderes.',
      fatal: true,
    };
  }
  if (code === 'permission-denied') {
    return {
      message: `Tilgang nektet når vi leste ${source}. Sjekk firestore.rules og valgt database.`,
      fatal: true,
    };
  }
  if (code === 'failed-precondition') {
    return {
      message: `Firestore-spørringen for ${source} krever en indeks som ikke finnes ennå.`,
      fatal: true,
    };
  }
  if (code === 'unauthenticated') {
    return {
      message: `Mangler autentisering for å lese ${source}. Logg ut og inn igjen.`,
      fatal: true,
    };
  }
  if (code === 'unavailable') {
    return {
      message: `Firestore er midlertidig utilgjengelig for ${source}.`,
      fatal: false,
    };
  }
  return {
    message: `Kunne ikke lese ${source} fra Firestore akkurat nå.`,
    fatal: true,
  };
}

export function useDashboardData(): {
  cars: Car[];
  stats: MarketStat[];
  lastScanLabel: string | null;
  loading: boolean;
  dataHint: string | null;
} {
  const [cars, setCars] = useState<Car[]>([]);
  const [stats, setStats] = useState<MarketStat[]>([]);
  const [lastScanLabel, setLastScanLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataHint, setDataHint] = useState<string | null>(null);

  useEffect(() => {
    let unsubStats: (() => void) | null = null;
    let unsubCars: (() => void) | null = null;
    let unsubScan: (() => void) | null = null;

    const qStats = query(collection(db, 'market_statistics'), orderBy('calculatedAt', 'desc'), limit(MAX_STATS));
    unsubStats = onSnapshot(
      qStats,
      (snapshot) => {
        setStats(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as MarketStat[]);
      },
      (error) => {
        const { message, fatal } = describeFirestoreError(error, 'markedsstatistikk');
        console.warn('market_statistics lytting feilet:', error);
        setDataHint(message);
        setStats([]);
        if (fatal && unsubStats) {
          unsubStats();
          unsubStats = null;
        }
      },
    );

    const qCars = query(collection(db, 'cars'), where('status', '==', 'active'), where('isAuction', '==', false));
    unsubCars = onSnapshot(
      qCars,
      (snapshot) => {
        setCars(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Car[]);
        setLoading(false);
      },
      (error) => {
        const { message, fatal } = describeFirestoreError(error, 'biler');
        console.warn('cars lytting feilet:', error);
        setDataHint(message);
        setCars([]);
        setLoading(false);
        if (fatal && unsubCars) {
          unsubCars();
          unsubCars = null;
        }
      },
    );

    unsubScan = onSnapshot(
      doc(db, 'scans', 'latest'),
      (snap) => {
        if (!snap.exists()) {
          setLastScanLabel(null);
          return;
        }
        const data = snap.data() as Record<string, unknown>;
        setLastScanLabel(
          formatScanTime(data.scanTime) ??
            formatScanTime(data.updatedAt) ??
            formatScanTime(data.completedAt) ??
            formatScanTime(data.finishedAt),
        );
      },
      (error) => {
        const { fatal } = describeFirestoreError(error, 'siste scan');
        console.warn('scans/latest lytting feilet:', error);
        setLastScanLabel(null);
        if (fatal && unsubScan) {
          unsubScan();
          unsubScan = null;
        }
      },
    );

    return () => {
      unsubStats?.();
      unsubCars?.();
      unsubScan?.();
    };
  }, []);

  return { cars, stats, lastScanLabel, loading, dataHint };
}
