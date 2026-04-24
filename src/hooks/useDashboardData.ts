import { useEffect, useState } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Car, MarketStat } from '../types/car';
import { formatScanTime } from '../lib/format';

const MAX_STATS = 50;

/**
 * Subscribes to active (non-auction) car ads, market statistics, and the
 * latest scan metadata. Returns once the cars snapshot has fired.
 *
 * Hook owns the Firestore listeners — component code stays free of SDK
 * knowledge.
 */
export function useDashboardData(): {
  cars: Car[];
  stats: MarketStat[];
  lastScanLabel: string | null;
  loading: boolean;
} {
  const [cars, setCars] = useState<Car[]>([]);
  const [stats, setStats] = useState<MarketStat[]>([]);
  const [lastScanLabel, setLastScanLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qStats = query(
      collection(db, 'market_statistics'),
      orderBy('calculatedAt', 'desc'),
      limit(MAX_STATS),
    );
    const unsubStats = onSnapshot(qStats, (snapshot) => {
      setStats(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as MarketStat[]);
    });

    const qCars = query(
      collection(db, 'cars'),
      where('status', '==', 'active'),
      where('isAuction', '==', false),
    );
    const unsubCars = onSnapshot(qCars, (snapshot) => {
      setCars(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Car[]);
      setLoading(false);
    });

    const unsubScan = onSnapshot(doc(db, 'scans', 'latest'), (snap) => {
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
    });

    return () => {
      unsubStats();
      unsubCars();
      unsubScan();
    };
  }, []);

  return { cars, stats, lastScanLabel, loading };
}
