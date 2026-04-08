import type { UserSettings } from '../types/userSettings';

const key = (uid: string) => `bilsnapper_settings_local_v1_${uid}`;

/** Midlertidig lagring når Firestore ikke tillater skriving (samme nettleser). */
export function readLocalUserSettingsPatch(uid: string): Partial<UserSettings> | null {
  try {
    const raw = localStorage.getItem(key(uid));
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<UserSettings>;
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}

export function writeLocalUserSettingsPatch(uid: string, patch: Partial<UserSettings>) {
  try {
    const prev = readLocalUserSettingsPatch(uid) || {};
    localStorage.setItem(key(uid), JSON.stringify({ ...prev, ...patch }));
  } catch {
    /* private mode / full disk */
  }
}
