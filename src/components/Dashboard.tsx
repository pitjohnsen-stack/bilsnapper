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
  Timestamp,
} from 'firebase/firestore';
import { mergeUserSettings } from '../types/userSettings';
import { downloadDealsCsv } from '../lib/csvExport';
import DashboardSkeleton from './DashboardSkeleton';
import {
  TrendingDown,
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

function formatScanTime(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Timestamp) return value.toDate().toLocaleString('no-NO');
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
  const [stats, setStats] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastScanLabel, setLastScanLabel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'oversikt' | 'historikk'>('oversikt');
  const [scanning, setScanning] = useState(false);

  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [colorFilter, setColorFilter] = useState<string>('all');
  const [ownersFilter, setOwnersFilter] = useState<string>('all');
  const [fuelFilter, setFuelFilter] = useState<string>('all');
  const [gearboxFilter, setGearboxFilter] = useState<string>('all');
  const [sellerTypeFilter, setSellerTypeFilter] = useState<string>('all');
  const [getaroundFilter, setGetaroundFilter] = useState<boolean>(false);
  const [onlyComplete, setOnlyComplete] = useState<boolean>(false);
  const [onlyWithImage, setOnlyWithImage] = useState<boolean>(false);
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');
  const [yearMin, setYearMin] = useState<string>('');
  const [yearMax, setYearMax] = useState<string>('');
  const [kmMin, setKmMin] = useState<string>('');
  const [kmMax, setKmMax] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('savingKr');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const GETAROUND_MAX_YEAR_AGE = 15;
  const GETAROUND_MAX_KM = 200_000;
  const GETAROUND_EXCLUDED_BRANDS = new Set([
    'Ferrari', 'Porsche', 'Lamborghini', 'Maserati', 'Bentley',
    'Rolls-Royce', 'Aston Martin', 'McLaren', 'Bugatti', 'Lotus',
  ]);
  const currentYear = new Date().getFullYear();
  const getaroundMinYear = currentYear - GETAROUND_MAX_YEAR_AGE;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(t);
  }, [searchText]);

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

  const [scanToast, setScanToast] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'ok' | 'error', msg: string) => {
    setScanToast({ type, msg });
    setTimeout(() => setScanToast(null), 6000);
  };

  const triggerScraper = async () => {
    if (scanning) return;
    setScanning(true);
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
        showToast('ok', 'Scan er startet. Firestore oppdateres om noen minutter.');
        return;
      }
      // GitHub Actions dispatch går via server-side proxy (/api/trigger-github-scrape)
      // slik at GITHUB_TOKEN ikke eksponeres i frontend-bundlen.
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
  };

  const uniqueBrands = useMemo(() => Array.from(new Set(deals.map((d) => d.brand))).filter((b) => b && b !== 'Ukjent').sort(), [deals]);
  const uniqueModels = useMemo(
    () => Array.from(new Set(
      deals
        .filter((d) => brandFilter === 'all' || d.brand === brandFilter)
        .map((d) => d.model)
    )).filter((m) => m && m !== 'Ukjent').sort(),
    [deals, brandFilter],
  );
  const uniqueRegions = useMemo(
    () => Array.from(new Set(deals.map((d) => d.region || d.location || ''))).filter((r) => r && r !== 'Ukjent').sort(),
    [deals],
  );
  const uniqueColors = useMemo(
    () => Array.from(new Set(deals.map((d) => d.color))).filter((c) => c && c !== 'Ukjent').sort(),
    [deals],
  );
  const uniqueFuels = useMemo(
    () => Array.from(new Set(deals.map((d) => d.fuel))).filter((f) => f && f !== 'Ukjent').sort(),
    [deals],
  );
  const uniqueGearboxes = useMemo(
    () => Array.from(new Set(deals.map((d) => d.gearbox))).filter((g) => g && g !== 'Ukjent').sort(),
    [deals],
  );
  const uniqueSellerTypes = useMemo(
    () => Array.from(new Set(deals.map((d) => d.sellerType))).filter((s) => s && s !== 'Ukjent').sort(),
    [deals],
  );

  const matchingDeals = useMemo(() => {
    const pMin = priceMin ? parseInt(priceMin, 10) : null;
    const pMax = priceMax ? parseInt(priceMax, 10) : null;
    const yMin = yearMin ? parseInt(yearMin, 10) : null;
    const yMax = yearMax ? parseInt(yearMax, 10) : null;
    const kMin = kmMin ? parseInt(kmMin, 10) : null;
    const kMax = kmMax ? parseInt(kmMax, 10) : null;
    const searchLower = debouncedSearch.trim().toLowerCase();

    return deals.filter((car) => {
      const matchBrand = brandFilter === 'all' || car.brand === brandFilter;
      const matchModel = modelFilter === 'all' || car.model === modelFilter;
      const matchRegion =
        regionFilter === 'all' || car.region === regionFilter || car.location === regionFilter;
      const matchColor = colorFilter === 'all' || car.color === colorFilter;
      const matchOwners =
        ownersFilter === 'all' || (ownersFilter === '1' ? car.owners === 1 : car.owners > 1);
      const matchFuel = fuelFilter === 'all' || car.fuel === fuelFilter;
      const matchGearbox = gearboxFilter === 'all' || car.gearbox === gearboxFilter;
      const matchSellerType = sellerTypeFilter === 'all' || car.sellerType === sellerTypeFilter;
      if (!matchBrand || !matchModel || !matchRegion || !matchColor || !matchOwners) return false;
      if (!matchFuel || !matchGearbox || !matchSellerType || !(car.price > 0)) return false;

      if (pMin != null && car.price < pMin) return false;
      if (pMax != null && car.price > pMax) return false;
      if (yMin != null && (!car.year || car.year < yMin)) return false;
      if (yMax != null && (!car.year || car.year > yMax)) return false;
      const km = car.mileage ?? car.km;
      if (kMin != null && (km == null || km < kMin)) return false;
      if (kMax != null && (km == null || km > kMax)) return false;

      if (onlyComplete && !car.isComplete) return false;
      if (onlyWithImage && !car.imageUrl) return false;

      if (searchLower) {
        const hay = `${car.brand ?? ''} ${car.model ?? ''}`.toLowerCase();
        if (!hay.includes(searchLower)) return false;
      }

      if (getaroundFilter) {
        if (!car.year || car.year < getaroundMinYear) return false;
        if (car.mileage && car.mileage >= GETAROUND_MAX_KM) return false;
        if (GETAROUND_EXCLUDED_BRANDS.has(car.brand)) return false;
      }

      if (typeof prefs.maxListPrice === 'number' && car.price > prefs.maxListPrice) return false;

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
  }, [deals, brandFilter, modelFilter, regionFilter, colorFilter, ownersFilter, fuelFilter, gearboxFilter, sellerTypeFilter, getaroundFilter, getaroundMinYear, onlyComplete, onlyWithImage, priceMin, priceMax, yearMin, yearMax, kmMin, kmMax, debouncedSearch, prefs]);

  const sortedDeals = useMemo(() => {
    const arr = matchingDeals.slice();
    // Bruk server-beregnede savingKr/savingPct/dealScore hvis tilgjengelig, ellers fallback
    const saving = (c: any) => (
      typeof c.savingKr === 'number' ? c.savingKr
        : typeof c.fairPrice === 'number' ? c.fairPrice - c.price
        : -Infinity
    );
    const savingPct = (c: any) => (
      typeof c.savingPct === 'number' ? c.savingPct
        : typeof c.fairPrice === 'number' && c.fairPrice > 0 ? (c.fairPrice - c.price) / c.fairPrice
        : -Infinity
    );
    const adTs = (c: any) => {
      const d = c.adDate ? new Date(c.adDate).getTime() : 0;
      return Number.isFinite(d) ? d : 0;
    };
    switch (sortBy) {
      case 'priceAsc': arr.sort((a, b) => a.price - b.price); break;
      case 'priceDesc': arr.sort((a, b) => b.price - a.price); break;
      case 'yearDesc': arr.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)); break;
      case 'yearAsc': arr.sort((a, b) => (a.year ?? 99999) - (b.year ?? 99999)); break;
      case 'kmAsc': arr.sort((a, b) => (a.mileage ?? Infinity) - (b.mileage ?? Infinity)); break;
      case 'kmDesc': arr.sort((a, b) => (b.mileage ?? -1) - (a.mileage ?? -1)); break;
      case 'newest': arr.sort((a, b) => adTs(b) - adTs(a)); break;
      case 'confidence': arr.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)); break;
      case 'savingPct': arr.sort((a, b) => savingPct(b) - savingPct(a)); break;
      case 'dealScore': arr.sort((a, b) => (b.dealScore ?? -1) - (a.dealScore ?? -1)); break;
      case 'savingKr':
      default: arr.sort((a, b) => saving(b) - saving(a)); break;
    }
    return arr;
  }, [matchingDeals, sortBy]);

  const filteredDeals = useMemo(
    () => sortedDeals.slice(0, prefs.listLimit),
    [sortedDeals, prefs.listLimit],
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

  const reversedStats = useMemo(() => stats.slice().reverse(), [stats]);

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
              ? new Date(stats[0].calculatedAt).toLocaleString('no-NO')
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
            onClick={() =>
              downloadDealsCsv(
                matchingDeals as Record<string, unknown>[],
                `bruktbil-utvalg-${userId.slice(0, 8)}.csv`,
              )
            }
            disabled={matchingDeals.length === 0}
            className={
              matchingDeals.length === 0
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

      {scanToast && (
        <div
          className={
            scanToast.type === 'ok'
              ? 'rounded-xl border border-teal-500/30 bg-teal-950/30 px-4 py-3 text-sm text-teal-100 dark:text-teal-200'
              : 'rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200'
          }
          role="status"
        >
          {scanToast.msg}
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
          <input
            type="search"
            placeholder="Søk merke/modell…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className={`min-w-[160px] flex-1 px-3 py-2.5 text-sm ${selectBase(isDarkMode)}`}
          />
          <select
            className={`min-w-[130px] flex-1 px-3 py-2.5 text-sm ${selectBase(isDarkMode)}`}
            value={brandFilter}
            onChange={(e) => { setBrandFilter(e.target.value); setModelFilter('all'); }}
          >
            <option value="all">Alle merker</option>
            {uniqueBrands.map((brand) => (
              <option key={brand} value={brand}>{brand}</option>
            ))}
          </select>
          <select
            className={`min-w-[130px] flex-1 px-3 py-2.5 text-sm ${selectBase(isDarkMode)}`}
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            disabled={brandFilter === 'all'}
            title={brandFilter === 'all' ? 'Velg merke først' : ''}
          >
            <option value="all">Alle modeller</option>
            {uniqueModels.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
          <select
            className={`min-w-[130px] flex-1 px-3 py-2.5 text-sm ${selectBase(isDarkMode)}`}
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
          >
            <option value="all">Alle steder</option>
            {uniqueRegions.map((region) => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
          <select
            className={`min-w-[150px] flex-1 px-3 py-2.5 text-sm ${selectBase(isDarkMode)}`}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            title="Sortering"
          >
            <option value="dealScore">Beste kupp (score)</option>
            <option value="savingKr">Størst besparelse (kr)</option>
            <option value="savingPct">Størst besparelse (%)</option>
            <option value="priceAsc">Pris ↑</option>
            <option value="priceDesc">Pris ↓</option>
            <option value="yearDesc">Nyest årsmodell</option>
            <option value="yearAsc">Eldst årsmodell</option>
            <option value="kmAsc">Færrest km</option>
            <option value="kmDesc">Flest km</option>
            <option value="newest">Nyeste annonse</option>
            <option value="confidence">Høyest confidence</option>
          </select>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={
              isDarkMode
                ? 'flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700'
                : 'flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50'
            }
          >
            <ListFilter size={14} />
            {showAdvanced ? 'Skjul avansert' : 'Flere filtre'}
          </button>
          <button
            type="button"
            onClick={() => setGetaroundFilter((v) => !v)}
            className={
              getaroundFilter
                ? 'flex items-center gap-2 rounded-lg border border-teal-500 bg-teal-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition'
                : isDarkMode
                  ? 'flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-700'
                  : 'flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50'
            }
            title={`Vis kun biler egnet for Getaround (≥${getaroundMinYear}, <${GETAROUND_MAX_KM.toLocaleString('no-NO')} km)`}
          >
            <CheckCircle size={15} />
            Getaround-egnet
          </button>
          {(brandFilter !== 'all' || modelFilter !== 'all' || regionFilter !== 'all' || colorFilter !== 'all' || ownersFilter !== 'all' || fuelFilter !== 'all' || gearboxFilter !== 'all' || sellerTypeFilter !== 'all' || getaroundFilter || onlyComplete || onlyWithImage || searchText || priceMin || priceMax || yearMin || yearMax || kmMin || kmMax) && (
            <button
              type="button"
              onClick={() => {
                setBrandFilter('all'); setModelFilter('all'); setRegionFilter('all');
                setColorFilter('all'); setOwnersFilter('all'); setFuelFilter('all');
                setGearboxFilter('all'); setSellerTypeFilter('all');
                setGetaroundFilter(false); setOnlyComplete(false); setOnlyWithImage(false);
                setSearchText(''); setPriceMin(''); setPriceMax('');
                setYearMin(''); setYearMax(''); setKmMin(''); setKmMax('');
              }}
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

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-3 border-t border-slate-200/60 pt-3 dark:border-slate-700/60 sm:grid-cols-3 lg:grid-cols-4">
            <select
              className={`px-3 py-2 text-sm ${selectBase(isDarkMode)}`}
              value={fuelFilter}
              onChange={(e) => setFuelFilter(e.target.value)}
            >
              <option value="all">Alle drivstoff</option>
              {uniqueFuels.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <select
              className={`px-3 py-2 text-sm ${selectBase(isDarkMode)}`}
              value={gearboxFilter}
              onChange={(e) => setGearboxFilter(e.target.value)}
            >
              <option value="all">Alle girkasser</option>
              {uniqueGearboxes.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select
              className={`px-3 py-2 text-sm ${selectBase(isDarkMode)}`}
              value={sellerTypeFilter}
              onChange={(e) => setSellerTypeFilter(e.target.value)}
            >
              <option value="all">Alle selgere</option>
              {uniqueSellerTypes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              className={`px-3 py-2 text-sm ${selectBase(isDarkMode)}`}
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
            >
              <option value="all">Alle farger</option>
              {uniqueColors.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              className={`px-3 py-2 text-sm ${selectBase(isDarkMode)}`}
              value={ownersFilter}
              onChange={(e) => setOwnersFilter(e.target.value)}
            >
              <option value="all">Alle eiere</option>
              <option value="1">1 eier</option>
              <option value="2+">Flere eiere</option>
            </select>
            <div className="flex gap-2">
              <input type="number" inputMode="numeric" placeholder="Pris fra" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className={`w-full px-3 py-2 text-sm ${selectBase(isDarkMode)}`} />
              <input type="number" inputMode="numeric" placeholder="Pris til" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className={`w-full px-3 py-2 text-sm ${selectBase(isDarkMode)}`} />
            </div>
            <div className="flex gap-2">
              <input type="number" inputMode="numeric" placeholder="År fra" value={yearMin} onChange={(e) => setYearMin(e.target.value)} className={`w-full px-3 py-2 text-sm ${selectBase(isDarkMode)}`} />
              <input type="number" inputMode="numeric" placeholder="År til" value={yearMax} onChange={(e) => setYearMax(e.target.value)} className={`w-full px-3 py-2 text-sm ${selectBase(isDarkMode)}`} />
            </div>
            <div className="flex gap-2">
              <input type="number" inputMode="numeric" placeholder="Km fra" value={kmMin} onChange={(e) => setKmMin(e.target.value)} className={`w-full px-3 py-2 text-sm ${selectBase(isDarkMode)}`} />
              <input type="number" inputMode="numeric" placeholder="Km til" value={kmMax} onChange={(e) => setKmMax(e.target.value)} className={`w-full px-3 py-2 text-sm ${selectBase(isDarkMode)}`} />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 sm:col-span-1">
              <input type="checkbox" checked={onlyComplete} onChange={(e) => setOnlyComplete(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
              Kun komplette data
            </label>
            <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 sm:col-span-1">
              <input type="checkbox" checked={onlyWithImage} onChange={(e) => setOnlyWithImage(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
              Kun med bilde
            </label>
          </div>
        )}
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
                {medianAcrossFilter != null ? `${medianAcrossFilter.toLocaleString('no-NO')} kr` : '—'}
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
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <Car size={44} className="text-slate-400 opacity-40" />
                        )}
                        {/* Gradient overlay for readability */}
                        {car.imageUrl && (
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                        )}
                        {isGoodDeal ? (
                          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1 text-xs font-bold text-slate-900 shadow-md">
                            <Sparkles size={12} />
                            Spar {savings!.toLocaleString('no-NO')} kr
                          </span>
                        ) : car.confidence ? (
                          <span className="absolute right-3 top-3 rounded-lg bg-teal-600/90 px-2.5 py-1 text-xs font-bold text-white shadow-md">
                            Mulig verdi
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
                              {car.price.toLocaleString('no-NO')} kr
                            </span>
                            {fair != null && (
                              <span className="block text-xs tabular-nums text-slate-400 line-through">
                                {fair.toLocaleString('no-NO')} kr
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
                          value != null ? `${value.toLocaleString('no-NO')} kr` : '—'
                        }
                        contentStyle={tooltipStyle}
                      />
                      <Legend />
                      <Bar dataKey="avg" name="Snitt" fill={chartPrimary} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="median" name="Median" fill={chartSecondary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
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

          <div className="h-96 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reversedStats} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
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
                    value != null ? `${value.toLocaleString('no-NO')} kr` : '—'
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
        </div>
      )}
    </div>
  );
}
