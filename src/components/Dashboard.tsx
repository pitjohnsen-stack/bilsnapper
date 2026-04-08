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

  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [colorFilter, setColorFilter] = useState<string>('all');
  const [ownersFilter, setOwnersFilter] = useState<string>('all');

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
      if (!snap.exists) {
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
    const base = (import.meta.env.VITE_SCANNER_URL || '').replace(/\/$/, '');
    try {
      if (base) {
        // Use dedicated scraper server if configured
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const secret = import.meta.env.VITE_SCAN_SECRET;
        if (secret) headers['x-scan-secret'] = secret;
        const res = await fetch(`${base}/scan`, { method: 'POST', headers, body: '{}' });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || `HTTP ${res.status}`);
        }
        alert('Scan er startet på serveren. Oppdatering i Firestore kan ta flere minutter.');
      } else {
        // Trigger GitHub Actions workflow dispatch
        const ghToken = import.meta.env.VITE_GITHUB_TOKEN;
        if (!ghToken) {
          alert('Ingen scrap-server konfigurert. Scraperen kjører automatisk hvert 2. time via GitHub Actions.');
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
          }
        );
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || `GitHub API HTTP ${res.status}`);
        }
        alert('Scan er startet via GitHub Actions. Resultater oppdateres i Firestore om ca. 5–15 minutter.');
      }
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Kunne ikke starte scan.');
    }
  };

  const uniqueBrands = useMemo(() => Array.from(new Set(deals.map((d) => d.brand))).sort(), [deals]);
  const uniqueRegions = useMemo(
    () => Array.from(new Set(deals.map((d) => d.region || d.location || ''))).filter(Boolean).sort(),
    [deals],
  );
  const uniqueColors = useMemo(
    () => Array.from(new Set(deals.map((d) => d.color))).filter((c) => c && c !== 'Ukjent').sort(),
    [deals],
  );

  const matchingDeals = useMemo(() => {
    return deals.filter((car) => {
      const matchBrand = brandFilter === 'all' || car.brand === brandFilter;
      const matchRegion =
        regionFilter === 'all' || car.region === regionFilter || car.location === regionFilter;
      const matchColor = colorFilter === 'all' || car.color === colorFilter;
      const matchOwners =
        ownersFilter === 'all' || (ownersFilter === '1' ? car.owners === 1 : car.owners > 1);
      if (!matchBrand || !matchRegion || !matchColor || !matchOwners || !(car.price > 0)) return false;

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
  }, [deals, brandFilter, regionFilter, colorFilter, ownersFilter, prefs]);

  const filteredDeals = useMemo(
    () => matchingDeals.slice(0, prefs.listLimit),
    [matchingDeals, prefs.listLimit],
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
            className="rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-900/25 transition hover:from-teal-500 hover:to-teal-600"
          >
            Kjør scan
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
            ? 'flex flex-wrap items-center gap-3 rounded-2xl border border-slate-700/60 bg-slate-800/40 p-4'
            : 'flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm'
        }
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          <Filter size={18} className="text-teal-600 dark:text-teal-400" />
          Filter
        </span>
        <select
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
          className={`min-w-[140px] flex-1 px-3 py-2.5 text-sm ${selectBase(isDarkMode)}`}
          value={ownersFilter}
          onChange={(e) => setOwnersFilter(e.target.value)}
        >
          <option value="all">Eiere</option>
          <option value="1">1 eier</option>
          <option value="2+">Flere eiere</option>
        </select>
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
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Treff i lista</h3>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-500/15 text-slate-600 dark:text-slate-300">
                  <TrendingDown size={22} />
                </div>
              </div>
              <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                {filteredDeals.length}
                {matchingDeals.length > filteredDeals.length ? (
                  <span className="text-lg font-semibold text-slate-500 dark:text-slate-400">
                    {' '}
                    / {matchingDeals.length}
                  </span>
                ) : null}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Vist opp til {prefs.listLimit} med gjeldende filter og innstillinger
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
                            ? 'relative flex h-36 items-center justify-center bg-slate-900/60'
                            : 'relative flex h-36 items-center justify-center bg-slate-100'
                        }
                      >
                        <Car size={44} className="text-slate-400 opacity-40" />
                        {(car.fairPrice && car.price < car.fairPrice) || car.confidence ? (
                          <span className="absolute right-3 top-3 rounded-md bg-amber-500 px-2 py-0.5 text-xs font-bold text-slate-900 shadow">
                            Mulig verdi
                          </span>
                        ) : null}
                      </div>
                      <div className="p-5">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h4 className="font-semibold leading-snug text-slate-900 dark:text-white">
                            {car.brand} {car.model}
                          </h4>
                          <span className="shrink-0 text-right text-lg font-bold tabular-nums text-teal-600 dark:text-teal-400">
                            {car.price.toLocaleString('no-NO')} kr
                          </span>
                        </div>
                        <div className="mb-4 grid grid-cols-2 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={14} className="text-teal-600 dark:text-teal-400" />
                            {car.year ?? '—'}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Gauge size={14} className="text-teal-600 dark:text-teal-400" />
                            {km != null ? `${Number(km).toLocaleString('no-NO')} km` : '—'}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Palette size={14} className="text-teal-600 dark:text-teal-400" />
                            {car.color ?? '—'}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users size={14} className="text-teal-600 dark:text-teal-400" />
                            {car.owners != null ? `${car.owners} eier(e)` : '—'}
                          </div>
                          <div className="col-span-2 flex items-center gap-1.5">
                            <CheckCircle size={14} className="text-teal-500" />
                            EU: {eu ?? 'Ukjent'}
                          </div>
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
                  <div
                    className={`col-span-2 py-16 text-center ${cardClass(isDarkMode)}`}
                  >
                    <p className="text-slate-500 dark:text-slate-400">Ingen treff med disse filtrene.</p>
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
