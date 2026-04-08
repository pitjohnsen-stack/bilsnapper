/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIRESTORE_DATABASE_ID?: string;
  /** Cloud Run base URL, e.g. https://bilsnapper-scanner-xxxxx-uw.a.run.app (no trailing slash) */
  readonly VITE_SCANNER_URL?: string;
  /** Optional; must match SCAN_SECRET on Cloud Run if set */
  readonly VITE_SCAN_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
