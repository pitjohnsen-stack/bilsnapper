import { useEffect, useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { X } from 'lucide-react';
import type { UserSettings } from '../types/userSettings';
import { mergeUserSettings } from '../types/userSettings';

type Props = {
  open: boolean;
  userId: string;
  isDarkMode: boolean;
  remote: Partial<UserSettings> | null;
  onClose: () => void;
};

export default function SettingsModal({ open, userId, isDarkMode, remote, onClose }: Props) {
  const m = mergeUserSettings(remote);
  const [maxListPrice, setMaxListPrice] = useState(m.maxListPrice);
  const [minSavingKr, setMinSavingKr] = useState(m.minSavingKr?.toString() ?? '');
  const [onlyBelowFair, setOnlyBelowFair] = useState(m.onlyBelowFair);
  const [minConfidence, setMinConfidence] = useState(m.minConfidence?.toString() ?? '');
  const [listLimit, setListLimit] = useState(m.listLimit);
  const [emailDigestInterest, setEmailDigestInterest] = useState(m.emailDigestInterest);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const x = mergeUserSettings(remote);
    setMaxListPrice(x.maxListPrice);
    setMinSavingKr(x.minSavingKr?.toString() ?? '');
    setOnlyBelowFair(x.onlyBelowFair);
    setMinConfidence(x.minConfidence?.toString() ?? '');
    setListLimit(x.listLimit);
    setEmailDigestInterest(x.emailDigestInterest);
  }, [open, remote]);

  if (!open) return null;

  const panel = isDarkMode
    ? 'max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 p-6 text-slate-100 shadow-2xl'
    : 'max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl';

  const input = isDarkMode
    ? 'mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white'
    : 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2';

  const save = async () => {
    setSaving(true);
    try {
      const minS = minSavingKr.trim() === '' ? null : Math.max(0, parseInt(minSavingKr, 10) || 0);
      const minC = minConfidence.trim() === '' ? null : Math.min(1, Math.max(0, parseFloat(minConfidence) || 0));
      await setDoc(
        doc(db, 'user_settings', userId),
        {
          maxListPrice,
          minSavingKr: minS,
          onlyBelowFair,
          minConfidence: minC,
          listLimit: Math.min(100, Math.max(1, listLimit)),
          emailDigestInterest,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className={panel} role="dialog" aria-labelledby="settings-title">
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
          Gjelder utvalget i annonselisten og eksportert CSV. Statistikk og grupper følger fortsatt
          datafilteret over listen.
        </p>

        <label className="mt-4 block text-sm font-medium">
          Maks pris i listen (kr)
          <input type="number" className={input} min={10000} step={1000} value={maxListPrice} onChange={(e) => setMaxListPrice(Number(e.target.value))} />
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
          Kun vis der pris er under estimert «fair» pris (krever at modellen har beregnet verdi)
        </label>

        <label className="mt-4 block text-sm font-medium">
          Min. besparelse mot fair price (kr, valgfritt)
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
          Min. modelconfidence 0–1 (valgfritt)
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
          Varsle meg når e-post / varsler lanseres
        </label>

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
            {saving ? 'Lagrer…' : 'Lagre'}
          </button>
        </div>
      </div>
    </div>
  );
}
