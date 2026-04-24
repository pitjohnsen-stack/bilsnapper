import { Calendar, Car as CarIcon, CheckCircle, Gauge, MapPin, Palette, Sparkles, Users } from 'lucide-react';
import type { Car } from '../../types/car';

export interface DealCardProps {
  car: Car;
  isDarkMode: boolean;
}

function buildFinnUrl(car: Car): string {
  if (car.url) return car.url;
  const id = car.finnId || car.id;
  return id ? `https://www.finn.no/car/used/ad.html?finnkode=${id}` : '#';
}

export function DealCard({ car, isDarkMode }: DealCardProps) {
  const km = car.mileage ?? car.km;
  const fair = typeof car.fairPrice === 'number' ? car.fairPrice : null;
  const savings = fair != null ? fair - car.price : null;
  const isGoodDeal = savings != null && savings > 0;
  const region = car.region || car.location;
  const eu = car.euApprovedUntil || car.euControl;
  const finnUrl = buildFinnUrl(car);

  return (
    <article
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
          <CarIcon size={44} className="text-slate-400 opacity-40" />
        )}
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
}
