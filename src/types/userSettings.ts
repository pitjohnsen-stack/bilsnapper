/** Brukerpreferanser lagret i Firestore: user_settings/{uid} */
export interface UserSettings {
  onboardingCompleted?: boolean;
  /** Maks pris for annonser som vises i listen */
  maxListPrice?: number;
  /** Min besparelse i kr mot fairPrice (hvis modellen har tall) */
  minSavingKr?: number | null;
  /** Kun annonser under estimert fairPrice */
  onlyBelowFair?: boolean;
  /** Minimum confidence 0–1 fra prismodell */
  minConfidence?: number | null;
  /** Antall kort i listen (1–100) */
  listLimit?: number;
  /** Interesse for fremtidige e-postoppsummeringer (ingen utsending i MVP) */
  emailDigestInterest?: boolean;
  updatedAt?: string;
}

export function mergeUserSettings(raw: Partial<UserSettings> | null | undefined): {
  onboardingCompleted: boolean;
  maxListPrice: number;
  minSavingKr: number | null;
  onlyBelowFair: boolean;
  minConfidence: number | null;
  listLimit: number;
  emailDigestInterest: boolean;
} {
  return {
    onboardingCompleted: raw?.onboardingCompleted === true,
    maxListPrice: typeof raw?.maxListPrice === 'number' && raw.maxListPrice > 0 ? raw.maxListPrice : 750_000,
    minSavingKr: typeof raw?.minSavingKr === 'number' ? raw.minSavingKr : null,
    onlyBelowFair: raw?.onlyBelowFair === true,
    minConfidence: typeof raw?.minConfidence === 'number' ? Math.min(1, Math.max(0, raw.minConfidence)) : null,
    listLimit: (() => {
      const n = raw?.listLimit;
      if (typeof n !== 'number' || Number.isNaN(n)) return 24;
      return Math.min(100, Math.max(1, Math.round(n)));
    })(),
    emailDigestInterest: raw?.emailDigestInterest === true,
  };
}
