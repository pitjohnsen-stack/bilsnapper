import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import raw from '../firebase-applet-config.json';

/** Vercel/prod: sett VITE_* i prosjektinnstillinger. Lokalt: brukes fallback fra JSON. */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || raw.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || raw.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || raw.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || raw.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || raw.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || raw.appId,
  measurementId: raw.measurementId || undefined,
};

const firestoreDatabaseId =
  import.meta.env.VITE_FIRESTORE_DATABASE_ID || raw.firestoreDatabaseId;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function loginWithGoogle() {
  await signInWithPopup(auth, googleProvider);
}

export const logout = () => signOut(auth);
