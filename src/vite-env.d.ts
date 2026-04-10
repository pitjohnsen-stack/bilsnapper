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
  /** Optional GitHub token for fetching scanner workflow status */
  readonly VITE_GITHUB_TOKEN?: string;
  /** Set by Vite: 'development' | 'production' | 'test' */
  readonly MODE: string;
  /** True when running in development mode */
  readonly DEV: boolean;
  /** True when running in production mode */
  readonly PROD: boolean;
  /** True when running in SSR mode */
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
