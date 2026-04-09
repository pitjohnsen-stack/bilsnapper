import { useState, useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Car, ChevronRight, Sparkles } from 'lucide-react';
import type { UserSettings } from '../types/userSettings';
import { writeLocalUserSettingsPatch } from '../lib/localUserSettings';

type Props = {
  open: boolean;
  userId: string;
  isDarkMode: boolean;
  /** Kall etter at valg er skrevet til localStorage — oppdaterer App slik at onboarding skjules med en gang */
  onAppliedLocally: () => void;
  /** Firestore skriving feilet etter at modal allerede er lukket lokalt */
  onCloudSaveError: (message: string) => void;
};

const TOTAL_STEPS = 3;

export default function OnboardingModal({
  open,
  userId,
  isDarkMode,
  onAppliedLocally,
  onCloudSaveError,
}: Props) {
  const [step, setStep] = useState(0);
  const [maxPrice, setMaxPrice] = useState(350000);
  const [listLimit, setListLimit] = useState(24);
  const [digest, setDigest] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || saving) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step < TOTAL_STEPS - 1) setStep((s) => Math.max(0, s - 1));
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, saving, step]);

  if (!open) return null;

  const panel = isDarkMode
    ? 'rounded-2xl border border-slate-600 bg-slate-900 p-6 text-slate-100 shadow-2xl'
    : 'rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl';

  const syncToCloud = async (patch: Partial<UserSettings>) => {
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'user_settings', userId),
        {
          ...patch,
          onboardingCompleted: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'code' in e
          ? String((e as { code: string }).code)
          : e instanceof Error
            ? e.message
            : 'Kunne ikke lagre';
      const friendly =
        msg.includes('permission') || msg === 'permission-denied'
          ? 'Skyinnstillinger er ikke tilgjengelige (Firestore). Valgene dine er lagret i denne nettleseren til admin har deployet regler til riktig database.'
          : `${msg}. Du kan prøve igjen under Innstillinger.`;
      onCloudSaveError(friendly);
    } finally {
      setSaving(false);
    }
  };

  const finish = () => {
    const patch: Partial<UserSettings> = {
      maxListPrice: maxPrice,
      listLimit,
      emailDigestInterest: digest,
      onboardingCompleted: true,
    };
    writeLocalUserSettingsPatch(userId, patch);
    onAppliedLocally();
    void syncToCloud(patch);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onb-title"
    >
      <div className={`w-full max-w-lg ${panel}`}>
        <div className="mb-4 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
          <span>Steg {step + 1} av {TOTAL_STEPS}</span>
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-6 rounded-full transition-colors ${i <= step ? 'bg-teal-500' : isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        </div>
        {step === 0 && (
          <>
            <div className="mb-4 flex items-center gap-2 text-teal-500">
              <Sparkles size={22} />
              <span className="text-xs font-semibold uppercase tracking-wider">Kom i gang</span>
            </div>
            <h2 id="onb-title" className="text-xl font-bold">
              Velkommen til Bruktbil-analytikeren
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Du får oversikt over aktive annonser, prisnivå fra scanneren og en enkel «mulig verdi» der
              modellen tillater det. Dette er et beslutningsverktøy, ikke finansråd — sjekk alltid bilen og
              selger på Finn.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500"
              >
                Neste <ChevronRight size={18} />
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600">
              <Car size={24} />
            </div>
            <h2 className="text-xl font-bold">Dine standardgrenser</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Vi filtrerer listen til deg. Du kan endre alt senere under innstillinger.
            </p>
            <label className="mt-6 block text-sm font-medium">
              Maks pris i listen (kr)
              <input
                type="number"
                min={10000}
                step={1000}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value) || 0)}
                className={
                  isDarkMode
                    ? 'mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white'
                    : 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2'
                }
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Antall annonser i listen: {listLimit}
              <input
                type="range"
                min={6}
                max={60}
                value={listLimit}
                onChange={(e) => setListLimit(Number(e.target.value))}
                className="mt-2 w-full accent-teal-600"
              />
            </label>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={digest}
                onChange={(e) => setDigest(e.target.checked)}
                className="h-4 w-4 rounded border-slate-400 text-teal-600"
              />
              Jeg vil vite når e-postoppsummering lanseres (ingen e-post sendes ennå).
            </label>
            <div className="mt-6 flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Tilbake
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500"
              >
                Neste
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-xl font-bold">Alt klart</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Du kan kjøre en ny scan fra dashboardet når som helst (hvis administrator har satt opp
              server-URL). Data friskes når scan siste gang ble fullført — se banner øverst.
            </p>
            <div className="mt-6 flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Tilbake
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={finish}
                className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-60"
              >
                {saving ? 'Synkroniserer…' : 'Åpne dashboard'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
