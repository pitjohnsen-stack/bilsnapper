import { useEffect, useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { X } from 'lucide-react';
import { db } from '../firebase';
import { writeLocalUserSettingsPatch } from '../lib/localUserSettings';
import type { UserSettings } from '../types/userSettings';
import { mergeUserSettings } from '../types/userSettings';

type Props = {
  open: boolean;
  userId: string;
  isDarkMode: boolean;
  remote: Partial<UserSettings> | null;
  onClose: () => void;
  onAppliedLocally: () => void;
  onCloudSaveError: (message: string) => void;
};

export default function SettingsModal({
  open,
  userId,
  isDarkMode,
  remote,
  onClose,
  onAppliedLocally,
  onCloudSaveError,
}: Props) {
  const merged = mergeUserSettings(remote);
  const [maxListPrice, setMaxListPrice] = useState(merged.maxListPrice);
  const [minSavingKr, setMinSavingKr] = useState(merged.minSavingKr?.toString() ?? '');
  const [onlyBelowFair, setOnlyBelowFair] = useState(merged.onlyBelowFair);
  const [minConfidence, setMinConfidence] = useState(merged.minConfidence?.toString() ?? '');
  const [listLimit, setListLimit] = useState(merged.listLimit);
  const [emailDigestInterest, setEmailDigestInterest] = useState(merged.emailDigestInterest);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedLocally, setSavedLocally] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = mergeUserSettings(remote);
    setMaxListPrice(next.maxListPrice);
    setMinSavingKr(next.minSavingKr?.toString() ?? '');
    setOnlyBelowFair(next.onlyBelowFair);
    setMinConfidence(next.minConfidence?.toString() ?? '');
    setListLimit(next.listLimit);
    setEmailDigestInterest(next.emailDigestInterest);
    setSaveError(null);
    setSavedLocally(false);
  }, [open, remote]);

  if (!open) return null;

  const panel = isDarkMode
    ? 'max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 p-6 text-slate-100 shadow-2xl'
    : 'max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl';

  const input = isDarkMode
    ? 'mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white'
    : 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2';

  const buildPatch = (): Partial<UserSettings> => ({
    maxListPrice: Math.max(10_000, Number(maxListPrice) || merged.maxListPrice),
    minSavingKr: minSavingKr.trim() === '' ? null : Math.max(0, parseInt(minSavingKr, 10) || 0),
    onlyBelowFair,
    minConfidence:
      minConfidence.trim() === '' ? null : Math.min(1, Math.max(0, parseFloat(minConfidence) || 0)),
    listLimit: Math.min(100, Math.max(1, Number(listLimit) || merged.listLimit)),
    emailDigestInterest,
  });

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    setSavedLocally(false);
    const patch = buildPatch();
    try {
      await setDoc(
        doc(db, 'user_settings', userId),
        {
          ...patch,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      writeLocalUserSettingsPatch(userId, patch);
      onAppliedLocally();
      onClose();
    } catch (err) {
      const saved = writeLocalUserSettingsPatch(userId, patch);
      if (saved) {
        setSavedLocally(true);
        onAppliedLocally();
        onCloudSaveError(
          'Skyinnstillinger kunne ikke lagres akkurat nå. Endringene dine er lagret lokalt i denne nettleseren.',
        );
        setSaveError('Skyinnstillinger kunne ikke lagres. Endringene er lagret lokalt i denne nettleseren.');
      } else {
        setSaveError(err instanceof Error ? err.message : 'Lagring feilet. Prøv igjen.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className={panel} role="dialog" aria-labelledby="settings-title" aria-modal="true">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="settings-title" className="text-lg font-bold">
            Innstillinger
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Lukk"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400">
          Gjelder annonselisten og eksportert CSV. Markedsstatistikk bruker egne datasett og kan derfor
          avvike fra listen under.
        </p>

        <label className="mt-4 block text-sm font-medium">
          Maks pris i listen (kr)
          <input
            type="number"
            className={input}
            min={10000}
            step={1000}
            value={maxListPrice}
            onChange={(e) => setMaxListPrice(Number(e.target.value))}
          />
        </label>

        <label className="mt-4 block text-sm font-medium">
          Maks antall annonser vist
          <input
            type="number"
            className={input}
            min={1}
            max={100}
            value={listLimit}
            onChange={(e) => setListLimit(Number(e.target.value))}
          />
        </label>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded text-teal-600"
            checked={onlyBelowFair}
            onChange={(e) => setOnlyBelowFair(e.target.checked)}
          />
          Vis bare biler som ligger under estimert fair pris
        </label>

        <label className="mt-4 block text-sm font-medium">
          Min. besparelse mot fair pris (kr, valgfritt)
          <input
            type="number"
            className={input}
            min={0}
            step={1000}
            placeholder="f.eks. 5000"
            value={minSavingKr}
            onChange={(e) => setMinSavingKr(e.target.value)}
          />
        </label>

        <label className="mt-4 block text-sm font-medium">
          Min. modellscore 0-1 (valgfritt)
          <input
            type="number"
            step="0.05"
            min={0}
            max={1}
            className={input}
            placeholder="f.eks. 0.4"
            value={minConfidence}
            onChange={(e) => setMinConfidence(e.target.value)}
          />
        </label>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded text-teal-600"
            checked={emailDigestInterest}
            onChange={(e) => setEmailDigestInterest(e.target.checked)}
          />
          Varsle meg når e-post og varsler lanseres
        </label>

        {saveError && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-300">
            {saveError}
          </p>
        )}

        {savedLocally && (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
            Endringene er lagret lokalt i nettleseren og synkroniseres til skyen når Firestore er
            tilgjengelig igjen.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Avbryt
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-60"
          >
            {saving ? 'Lagrer...' : 'Lagre'}
          </button>
        </div>
      </div>
    </div>
  );
}
