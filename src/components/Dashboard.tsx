import { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  doc,
} from 'firebase/firestore';
import { mergeUserSettings } from '../types/userSettings';
import type { CarListing, MarketStats } from '../types/car';
import { downloadDealsCsv } from '../lib/csvExport';
import { formatPrice } from '../lib/formatPrice';
import DashboardSkeleton from './DashboardSkeleton';
import {
  Car,
  Calendar,
  Gauge,
  Tag,
  Filter,
  Moon,
  Sun,
  CheckCircle,
  History,
  LayoutDashboard,
  Users,
  Palette,
  Download,
  RefreshCw,
  Sparkles,
  X,
  ListFilter,
  MapPin,
  Zap,
  SortAsc,
  Info,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
} from 'recharts';

const chartPrimary = '#0d9488';
const chartSecondary = '#f59e0b';
const chartMuted = '#94a3b8';

function selectBase(isDark: boolean) {
  return isDark
    ? 'rounded-lg border border-slate-700/80 bg-slate-800/80 text-slate-100 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25'
    : 'rounded-lg border border-slate-200 bg-white text-slate-900 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';
}

function cardClass(isDark: boolean) {
  return isDark
    ? 'rounded-2xl border border-slate-700/60 bg-slate-800/50 p-6 shadow-lg shadow-black/20'
    : 'rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-200/50';
}

type Prefs = ReturnType<typeof mergeUserSettings>;

type SortBy = 'price_asc' | 'price_desc' | 'year_desc' | 'km_asc' | 'savings_desc';

function formatScanTime(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toLocaleString('no-NO');
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const s = (value as { seconds: number }).seconds;
    if (typeof s === 'number') return new Date(s * 1000).toLocaleString('no-NO');
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString('no-NO');
  }
  return null;
}

export default function Dashboard({
  isDarkMode,
  toggleDarkMode,
  userId,
  prefs,
}: {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  userId: string;
  prefs: Prefs;
}) {
  const [stats, setStats] = useState<MarketStats[]>([]);
  const [deals, setDeals] = useState<CarListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastScanLabel, setLastScanLabel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'oversikt' | 'historikk'>('oversikt');

  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [colorFilter, setColorFilter] = useState<string>('all');
  const [ownersFilter, setOwnersFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [fuelFilter, setFuelFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('price_asc');
  const [scanStatus, setScanStatus] = useState<{ type: 'info' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const qStats = query(collection(db, 'market_statistics'), orderBy('calculatedAt', 'desc'), limit(50));
    const unsubSta = onSnapshot(qStats, (snapshot) => {
      const statsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setStats(statsData);
    });

    const qCars = query(collection(db, 'cars'), where('status', '==', 'active'), where('isAuction', '==', false));
    const unsubCar = onSnapshot(qCars, (snapshot) => {
      const carsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setDeals(carsData);
      setLoading(false);
    });

    return () => {
      unsubSta();
      unsubCar();
    };
  }, []);

  useEffect(() => {
    const ref = doc(db, 'scans', 'latest');
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setLastScanLabel(null);
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      const label =
        formatScanTime(data.scanTime) ??
        formatScanTime(data.updatedAt) ??
        formatScanTime(data.completedAt) ??
        formatScanTime(data.finishedAt);
      setLastScanLabel(label);
    });
  }, []);

  const triggerScraper = async () => {
    const configured = (import.meta.env.VITE_SCANNER_URL || '').trim().replace(/\/$/, '');
    const base =
      configured ||
      (import.meta.env.DEV && typeof window !== 'undefined'
        ? window.location.origin
        : '');
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
        setScanStatus({ type: 'info', message: 'Scan er startet på serveren. Oppdatering i Firestore kan ta flere minutter.' });
        return;
      }
      const ghToken = import.meta.env.VITE_GITHUB_TOKEN;
      if (!ghToken) {
        setScanStatus({
          type: 'error',
          message:
            'Sett VITE_SCANNER_URL (f.eks. Cloud Run), eller kjør appen lokalt i dev, eller VITE_GITHUB_TOKEN for å trigge GitHub Actions.',
        });
        return;
      }
      const res = await fetch(
        'https://api.github.com/repos/pitjohnsen-stack/bilsnapper/actions/workflows/scraper.yml/dispatches',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ghToken}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref: 'main' }),
        },
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `GitHub API HTTP ${res.status}`);
      }
      setScanStatus({ type: 'info', message: 'Scan er startet via GitHub Actions. Resultater oppdateres i Firestore om ca. 5–15 minutter.' });
    } catch (e) {
      console.error(e);
      setScanStatus({ type: 'error', message: e instanceof Error ? e.message : 'Kunne ikke starte scan.' });
    }
  };

  const uniqueBrands = useMemo(() => Array.from(new Set(deals.map((d) => d.brand))).filter(Boolean).sort(), [deals]);
  const uniqueRegions = useMemo(
    () => Array.from(new Set(deals.map((d) => d.region || d.location || ''))).filter(Boolean).sort(),
    [deals],
  );
  const uniqueColors = useMemo(
    () => Array.from(new Set(deals.map((d) => d.color))).filter((c) => c && c !== 'Ukjent').sort() as string[],
    [deals],
  );
  const uniqueFuels = useMemo(
    () => Array.from(new Set(deals.map((d) => d.fuel))).filter((f) => f && f !== 'Ukjent').sort() as string[],
    [deals],
  );
  const uniqueYears = useMemo(
    () => {
      const years: number[] = deals
        .map((d) => d.year)
        .filter((y): y is number => typeof y === 'number' && y > 1980);
      return Array.from(new Set<number>(years)).sort((a, b) => b - a);
    },
    [deals],
  );

  const matchingDeals = useMemo(() => {
    return deals.filter((car) => {
      const matchBrand = brandFilter === 'all' || car.brand === brandFilter;
      const matchRegion =
        regionFilter === 'all' || car.region === regionFilter || car.location === regionFilter;
      const matchColor = colorFilter === 'all' || car.color === colorFilter;
      const matchOwners =
        ownersFilter === 'all' ||
        (ownersFilter === '1' ? car.owners != null && car.owners === 1 : car.owners != null && car.owners > 1);
      const matchFuel = fuelFilter === 'all' || car.fuel === fuelFilter;
      const matchYear = yearFilter === 'all' || String(car.year) === yearFilter;
      if (!matchBrand || !matchRegion || !matchColor || !matchOwners || !matchFuel || !matchYear || !(car.price > 0)) return false;

      if (typeof prefs.maxListPrice === 'number' && car.price > prefs.maxListPrice) return false;

      if (prefs.minYear != null && (car.year == null || car.year < prefs.minYear)) return false;

      const fair = typeof car.fairPrice === 'number' ? car.fairPrice : null;
      if (prefs.onlyBelowFair) {
        if (fair == null || !(car.price < fair)) return false;
      }
      if (prefs.minSavingKr != null && prefs.minSavingKr > 0) {
        if (fair == null || fair - car.price < prefs.minSavingKr) return false;
      }
      if (prefs.minConfidence != null) {
        if (typeof car.confidence !== 'number' || car.confidence < prefs.minConfidence) return false;
      }

      return true;
    });
  }, [deals, brandFilter, regionFilter, colorFilter, ownersFilter, fuelFilter, yearFilter, prefs]);

  const sortedMatchingDeals = useMemo(() => {
    const arr = [...matchingDeals];
    switch (sortBy) {
      case 'price_asc': return arr.sort((a, b) => a.price - b.price);
      case 'price_desc': return arr.sort((a, b) => b.price - a.price);
      case 'year_desc': return arr.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      case 'km_asc': return arr.sort((a, b) => (a.mileage ?? a.km ?? 0) - (b.mileage ?? b.km ?? 0));
      case 'savings_desc':
        return arr.sort((a, b) => {
          const sa = typeof a.fairPrice === 'number' ? a.fairPrice - a.price : -Infinity;
          const sb = typeof b.fairPrice === 'number' ? b.fairPrice - b.price : -Infinity;
          return sb - sa;
        });
      default: return arr;
    }
  }, [matchingDeals, sortBy]);

  const filteredDeals = useMemo(
    () => sortedMatchingDeals.slice(0, prefs.listLimit),
    [sortedMatchingDeals, prefs.listLimit],
  );

  const totalSavings = useMemo(
    () => matchingDeals.reduce((sum, c) => {
      if (typeof c.fairPrice === 'number' && c.price < c.fairPrice) return sum + (c.fairPrice - c.price);
      return sum;
    }, 0),
    [matchingDeals],
  );

  const filteredStats = useMemo(() => {
    if (brandFilter === 'all') return stats.slice(0, 5);
    return stats.filter((s) => s.brand === brandFilter).slice(0, 5);
  }, [stats, brandFilter]);

  /** Firestore fra scanner: avgPrice, medianPrice (ikke avgPricePrivate/Dealer) */
  const statsChartRows = useMemo(
    () =>
      filteredStats.map((s) => ({
        ...s,
        label: `${s.brand ?? ''} ${s.model ?? ''}`.trim() || s.id,
        avg: typeof s.avgPrice === 'number' ? s.avgPrice : null,
        median: typeof s.medianPrice === 'number' ? s.medianPrice : null,
      })),
    [filteredStats],
  );

  const scatterData = useMemo(
    () =>
      filteredDeals.map((c) => ({
        ...c,
        mileage: c.mileage ?? c.km ?? 0,
        price: c.price,
        brand: c.brand,
      })),
    [filteredDeals],
  );

  const hasActiveFilters = brandFilter !== 'all' || regionFilter !== 'all' || colorFilter !== 'all' || ownersFilter !== 'all' || fuelFilter !== 'all' || yearFilter !== 'all';

  const resetFilters = () => {
    setBrandFilter('all');
    setRegionFilter('all');
    setColorFilter('all');
    setOwnersFilter('all');
    setFuelFilter('all');
    setYearFilter('all');
  };

  if (loading) {
    return <DashboardSkeleton isDarkMode={isDarkMode} />;
  }

  const textColor = isDarkMode ? '#cbd5e1' : '#475569';
  const gridColor = isDarkMode ? '#334155' : '#e2e8f0';
  const tooltipStyle = {
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
    border: `1px solid ${gridColor}`,
    borderRadius: '12px',
    color: textColor,
  };

  const medianAcrossFilter =
    filteredStats.length && typeof filteredStats[0].medianPrice === 'number'
      ? filteredStats[0].medianPrice
      : null;
  const sampleHint =
    filteredStats.length && typeof filteredStats[0].sampleSize === 'number'
      ? `n ≈ ${filteredStats[0].sampleSize} annonser (siste utvalg)`
      : 'Basert på siste beregnede utvalg';

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Markedsoversikt
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Marked statistikk:{' '}
            {stats.length > 0 && stats[0].calculatedAt
              ? new Date(stats[0].calculatedAt as string).toLocaleString('no-NO')
              : '—'}
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
              onClick={() => setActiveTab('oversikt')}
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
              onClick={() => setActiveTab('historikk')}
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
            onClick={triggerScraper}
            className="rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-900/25 transition hover:from-teal-500 hover:to-teal-600"
          >
            Kjør scan
          </button>
          <button
            type="button"
            onClick={() => downloadDealsCsv(sortedMatchingDeals as Record<string, unknown>[])}
            disabled={sortedMatchingDeals.length === 0}
            className={
              sortedMatchingDeals.length === 0
                ? isDarkMode
                  ? 'cursor-not-allowed rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-slate-500'
                  : 'cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-400'
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

      {scanStatus && (
        <div
          className={
            scanStatus.type === 'error'
              ? isDarkMode
                ? 'flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-950/30 px-4 py-3 text-sm text-red-200'
                : 'flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'
              : isDarkMode
                ? 'flex items-start gap-3 rounded-xl border border-teal-500/25 bg-teal-950/30 px-4 py-3 text-sm text-teal-200'
                : 'flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800'
          }
          role="status"
          aria-live="polite"
        >
          <Info size={16} className="mt-0.5 shrink-0" />
          <p className="flex-1">{scanStatus.message}</p>
          <button
            type="button"
            onClick={() => setScanStatus(null)}
            className="shrink-0 rounded-lg p-1 opacity-70 hover:opacity-100"
            aria-label="Lukk"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <p
        className={
          isDarkMode
            ? 'rounded-xl border border-amber-500/20 bg-amber-950/25 px-4 py-3 text-center text-xs text-amber-100/90'
            : 'rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-center text-xs text-amber-950/90'
        }
      >
        Anslåtte priser og «kupp» er veiledende modellutdata — ikke erstatning for egen vurdering eller rådgivning.
      </p>

      <div
        className={
          isDarkMode
            ? 'space-y-3 rounded-2xl border border-slate-700/60 bg-slate-800/40 p-4'
            : 'space-y-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm'
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <Filter size={18} className="text-teal-600 dark:text-teal-400" />
            Filter
          </span>
          <select
            aria-label="Filtrer etter merke"
            className={`min-w-[140px] flex-1 px-3 py-2.5 text-sm ${selectBase(isDarkMode)}`}
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
          >
            <option value="all">Alle merker</option>
            {uniqueBrands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrer etter sted"
            className={`min-w-[140px] flex-1 px-3 py-2.5 text-sm ${selectBase(isDarkMode)}`}
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
          >
            <option value="all">Alle steder</option>
            {uniqueRegions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrer etter farge"
            className={`min-w-[140px] flex-1 px-3 py-2.5 text-sm ${selectBase(isDarkMode)}`}
            value={colorFilter}
            onChange={(e) => setColorFilter(e.target.value)}
          >
            <option value="all">Alle farger</option>
            {uniqueColors.map((color) => (
              <option key={color} value={color}>
                {color}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrer etter antall eiere"
            className={`min-w-[140px] flex-1 px-3 py-2.5 text-sm ${selectBase(isDarkMode)}`}
            value={ownersFilter}
            onChange={(e) => setOwnersFilter(e.target.value)}
          >
            <option value="all">Eiere</option>
            <option value="1">1 eier</option>
            <option value="2+">Flere eiere</option>
          </select>
          {uniqueFuels.length > 0 && (
            <select
              aria-label="Filtrer etter drivstoff"
              className={`min-w-[140px] flex-1 px-3 py-2.5 text-sm ${selectBase(isDarkMode)}`}
              value={fuelFilter}
              onChange={(e) => setFuelFilter(e.target.value)}
            >
              <option value="all">Alle drivstoff</option>
              {uniqueFuels.map((fuel) => (
                <option key={fuel} value={fuel}>
                  {fuel}
                </option>
              ))}
            </select>
          )}
          {uniqueYears.length > 0 && (
            <select
              aria-label="Filtrer etter årsmodell"
              className={`min-w-[120px] flex-1 px-3 py-2.5 text-sm ${selectBase(isDarkMode)}`}
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              <option value="all">Alle år</option>
              {uniqueYears.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          )}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className={
                isDarkMode
                  ? 'flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700'
                  : 'flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50'
              }
            >
              <X size={14} />
              Nullstill
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
            Viser <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredDeals.length}</span> av{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-200">{matchingDeals.length}</span> treff
            {deals.length !== matchingDeals.length ? ` (${deals.length} totalt i databasen)` : ''}
          </p>
          <div className="flex items-center gap-2">
            <SortAsc size={16} className="text-slate-400" aria-hidden />
            <select
              aria-label="Sorter annonser"
              className={`px-2.5 py-1.5 text-xs ${selectBase(isDarkMode)}`}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
            >
              <option value="price_asc">Pris: lav → høy</option>
              <option value="price_desc">Pris: høy → lav</option>
              <option value="year_desc">Årsmodell: nyest</option>
              <option value="km_asc">Km: lavest</option>
              <option value="savings_desc">Størst besparelse</option>
            </select>
          </div>
        </div>
      </div>

      {activeTab === 'oversikt' ? (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className={cardClass(isDarkMode)}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Aktive annonser</h3>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400">
                  <Car size={22} />
                </div>
              </div>
              <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">{deals.length}</p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">I databasen (aktive, ikke auksjon)</p>
            </div>

            <div className={cardClass(isDarkMode)}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Median (filter)</h3>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Tag size={22} />
                </div>
              </div>
              <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                {medianAcrossFilter != null ? formatPrice(medianAcrossFilter) : '—'}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{sampleHint}</p>
            </div>

            <div className={cardClass(isDarkMode)}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Mulige kupp</h3>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Sparkles size={22} />
                </div>
              </div>
              <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                {matchingDeals.filter((c) => typeof c.fairPrice === 'number' && c.price < c.fairPrice).length}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Annonser under beregnet verdi (av {matchingDeals.length} treff)
                {totalSavings > 0 && (
                  <span className="ml-1 font-medium text-amber-600 dark:text-amber-400">
                    · Samlet spart: {formatPrice(totalSavings)}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Utvalgte annonser</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredDeals.map((car) => {
                  const km = car.mileage ?? car.km;
                  const finnUrl =
                    car.url ||
                    (car.finnId || car.id
                      ? `https://www.finn.no/car/used/ad.html?finnkode=${car.finnId || car.id}`
                      : '#');
                  const eu = car.euApprovedUntil || car.euControl;
                  const fair = typeof car.fairPrice === 'number' ? car.fairPrice : null;
                  const savings = fair != null ? fair - car.price : null;
                  const isGoodDeal = savings != null && savings > 0;
                  const region = car.region || car.location;
                  const pricePerKm = km != null && km > 0 && car.price > 0 ? Math.round(car.price / km) : null;
                  const confidencePct = typeof car.confidence === 'number' ? Math.round(car.confidence * 100) : null;
                  return (
                    <article
                      key={car.id}
                      className={
                        isDarkMode
                          ? 'group overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-800/40 transition hover:border-teal-500/40'
                          : 'group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:border-teal-300 hover:shadow-md'
                      }
                    >
                      <div
                        className={
                          isDarkMode
                            ? 'relative flex h-44 items-center justify-center overflow-hidden bg-slate-900/60'
                            : 'relative flex h-44 items-center justify-center overflow-hidden bg-slate-100'
                        }
                      >
                        {car.imageUrl ? (
                          <img
                            src={car.imageUrl}
                            alt={`${car.brand} ${car.model}`}
                            className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <Car size={44} className="text-slate-400 opacity-40" aria-hidden />
                        )}
                        {/* Gradient overlay for readability */}
                        {car.imageUrl && (
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                        )}
                        {isGoodDeal ? (
                          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1 text-xs font-bold text-slate-900 shadow-md">
                            <Sparkles size={12} />
                            Spar {formatPrice(savings!)}
                          </span>
                        ) : confidencePct != null ? (
                          <span className="absolute right-3 top-3 rounded-lg bg-teal-600/90 px-2.5 py-1 text-xs font-bold text-white shadow-md">
                            {confidencePct}% konf.
                          </span>
                        ) : null}
                        {region && (
                          <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-md bg-black/50 px-2 py-0.5 text-xs text-white/90 backdrop-blur-sm">
                            <MapPin size={11} />
                            {region}
                          </span>
                        )}
                      </div>
                      <div className="p-5">
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <h4 className="font-semibold leading-snug text-slate-900 dark:text-white">
                            {car.brand} {car.model}
                          </h4>
                          <div className="shrink-0 text-right">
                            <span className="block text-lg font-bold tabular-nums text-teal-600 dark:text-teal-400">
                              {formatPrice(car.price)}
                            </span>
                            {fair != null && (
                              <span className="block text-xs tabular-nums text-slate-400 line-through">
                                {formatPrice(fair)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mb-4 mt-3 grid grid-cols-2 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={14} className="text-teal-600 dark:text-teal-400" />
                            {car.year && car.year > 0 ? car.year : '—'}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Gauge size={14} className="text-teal-600 dark:text-teal-400" />
                            {km != null && km > 0 ? `${Number(km).toLocaleString('no-NO')} km` : '—'}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Palette size={14} className="text-teal-600 dark:text-teal-400" />
                            {car.color && car.color !== 'Ukjent' ? car.color : '—'}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users size={14} className="text-teal-600 dark:text-teal-400" />
                            {car.owners != null ? `${car.owners} eier(e)` : '—'}
                          </div>
                          {car.fuel && car.fuel !== 'Ukjent' && (
                            <div className="flex items-center gap-1.5">
                              <Zap size={14} className="text-teal-600 dark:text-teal-400" />
                              {car.fuel}
                            </div>
                          )}
                          {pricePerKm != null && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                              {pricePerKm.toLocaleString('no-NO')} kr/km
                            </div>
                          )}
                          {eu && eu !== 'Ukjent' && (
                            <div className="col-span-2 flex items-center gap-1.5">
                              <CheckCircle size={14} className="text-teal-500" />
                              EU-kontroll: {eu}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-200/80 pt-4 dark:border-slate-700/80">
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-600 dark:bg-slate-900/80 dark:text-slate-300">
                            {car.sellerType ?? 'Ukjent selger'}
                          </span>
                          <a
                            href={finnUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-semibold text-teal-600 hover:text-teal-500 dark:text-teal-400 dark:hover:text-teal-300"
                          >
                            Åpne på Finn →
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {filteredDeals.length === 0 && (
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
            </div>

            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Prisnivå</h3>

              <div className={cardClass(isDarkMode)}>
                <h4 className="mb-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Snitt og median per modell (filter)
                </h4>
                {statsChartRows.length === 0 ? (
                  <div className="flex h-64 items-center justify-center text-sm text-slate-400">
                    Ingen statistikk tilgjengelig for dette filteret.
                  </div>
                ) : (
                  <div className="h-64 w-full min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statsChartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: textColor }}
                          interval={0}
                          angle={-18}
                          textAnchor="end"
                          height={56}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 11, fill: textColor }}
                          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                        />
                        <Tooltip
                          formatter={(value: number) =>
                            value != null ? formatPrice(value) : '—'
                          }
                          contentStyle={tooltipStyle}
                        />
                        <Legend />
                        <Bar dataKey="avg" name="Snitt" fill={chartPrimary} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="median" name="Median" fill={chartSecondary} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className={cardClass(isDarkMode)}>
                <h4 className="mb-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Pris vs. kilometer (utvalg)
                </h4>
                <div className="h-64 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis
                        type="number"
                        dataKey="mileage"
                        name="Km"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: textColor }}
                        tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                      />
                      <YAxis
                        type="number"
                        dataKey="price"
                        name="Pris"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: textColor }}
                        tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                      />
                      <ZAxis type="category" dataKey="brand" name="Merke" />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3', stroke: chartMuted }}
                        contentStyle={tooltipStyle}
                      />
                      <Scatter name="Biler" data={scatterData} fill={chartPrimary} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className={cardClass(isDarkMode)}>
          <h3 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">Prisutvikling over tid</h3>
          <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
            Historikk fra lagrede market_statistics-punkter
            {brandFilter !== 'all' ? ` (filtrert: ${brandFilter})` : ''}.
          </p>

          {stats.length === 0 ? (
            <div className="flex h-96 flex-col items-center justify-center gap-4 text-slate-400">
              <History size={40} className="opacity-40" />
              <p className="text-sm">Ingen historiske data tilgjengelig ennå. Kjør en scan for å samle data over tid.</p>
            </div>
          ) : (
            <div className="h-96 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.slice().reverse()} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis
                    dataKey="calculatedAt"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: textColor }}
                    tickFormatter={(val) =>
                      val ? new Date(val).toLocaleDateString('no-NO', { day: '2-digit', month: 'short' }) : ''
                    }
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: textColor }}
                    tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                  />
                  <Tooltip
                    labelFormatter={(val) => (val ? new Date(val).toLocaleString('no-NO') : '')}
                    formatter={(value: number) =>
                      value != null ? formatPrice(value) : '—'
                    }
                    contentStyle={tooltipStyle}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avgPrice"
                    name="Snittpris"
                    stroke={chartPrimary}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="medianPrice"
                    name="Median"
                    stroke={chartSecondary}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
