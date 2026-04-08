import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, logout, loginWithGoogle, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Car, Bell, LogOut, HelpCircle, Settings } from 'lucide-react';
import Dashboard from './components/Dashboard';
import OnboardingModal from './components/OnboardingModal';
import SettingsModal from './components/SettingsModal';
import HelpLegalModal from './components/HelpLegalModal';
import type { UserSettings } from './types/userSettings';
import { mergeUserSettings } from './types/userSettings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [rawUserSettings, setRawUserSettings] = useState<Partial<UserSettings> | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<'faq' | 'privacy' | 'terms'>('faq');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    if (!user) {
      setRawUserSettings(undefined);
      return;
    }
    const ref = doc(db, 'user_settings', user.uid);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setRawUserSettings(snap.exists ? (snap.data() as Partial<UserSettings>) : {});
      },
      (err) => {
        console.error('user_settings lytting feilet:', err);
        // Unngå evig spinner ved permission/nettverk/feil database — bruk standardinnstillinger
        setRawUserSettings({});
      },
    );
    return () => unsubscribe();
  }, [user]);

  /** Om Firestore aldri svarer (sjeldent), ikke lås brukeren på spinner */
  useEffect(() => {
    if (!user || rawUserSettings !== undefined) return;
    const t = window.setTimeout(() => {
      setRawUserSettings((prev) => (prev === undefined ? {} : prev));
    }, 12000);
    return () => window.clearTimeout(t);
  }, [user, rawUserSettings]);

  const prefs = rawUserSettings !== undefined ? mergeUserSettings(rawUserSettings) : null;
  const showOnboarding = Boolean(user && prefs && !prefs.onboardingCompleted);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-teal-500/30 border-t-teal-400" />
        <p className="text-sm text-slate-400">Laster…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 p-4">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 20% 10%, rgb(13 148 136 / 0.35), transparent 55%), radial-gradient(ellipse 70% 50% at 85% 80%, rgb(217 119 6 / 0.2), transparent 50%), radial-gradient(ellipse 60% 40% at 50% 100%, rgb(15 118 110 / 0.25), transparent 45%)',
          }}
        />
        <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/70 p-8 text-center shadow-2xl shadow-teal-950/50 backdrop-blur-xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-700 text-white shadow-lg shadow-teal-900/40">
            <Car size={32} strokeWidth={1.75} />
          </div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-teal-400/90">Markedsintelligens</p>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Bruktbil-analytikeren</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Sanntidsdata, prismodell og «kupp» fra markedet — beskyttet med Google-innlogging.
          </p>
          <p className="mt-4 text-xs text-slate-500">
            Ved innlogging godtar du vilkår og personvernerklæring — se «Hjelp» etter innlogging.
          </p>
          {loginError ? (
            <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-left text-sm text-amber-200" role="alert">
              {loginError}
            </p>
          ) : null}
          <button
            type="button"
            onClick={async () => {
              setLoginError(null);
              try {
                await loginWithGoogle();
              } catch (err: unknown) {
                const code =
                  err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
                if (code === 'auth/popup-closed-by-user') return;
                setLoginError(
                  err instanceof Error
                    ? err.message
                    : 'Innlogging feilet. Sjekk Google Auth og godkjente domener i Firebase.',
                );
              }
            }}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white px-4 py-3.5 text-sm font-semibold text-slate-800 shadow-lg transition hover:bg-slate-100"
          >
            <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Logg inn med Google
          </button>
          <p className="mt-4 text-xs text-slate-500">
            Godkjenn domenet ditt under Firebase → Authentication → Settings → Authorized domains.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        isDarkMode ? 'flex min-h-screen flex-col bg-slate-950 text-slate-100' : 'flex min-h-screen flex-col bg-slate-50 text-slate-900'
      }
    >
      <nav
        className={
          isDarkMode
            ? 'sticky top-0 z-20 border-b border-white/5 bg-slate-900/85 backdrop-blur-md'
            : 'sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md'
        }
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-md shadow-teal-900/25">
              <Car size={22} strokeWidth={1.75} />
            </div>
            <div>
              <span className="block text-sm font-semibold leading-tight text-teal-600 dark:text-teal-400">
                Markedskart
              </span>
              <span className="hidden text-base font-bold tracking-tight text-slate-900 dark:text-white sm:block">
                Bruktbil-analytikeren
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setHelpTab('faq');
                setHelpOpen(true);
              }}
              className={
                isDarkMode
                  ? 'rounded-full p-2.5 text-slate-400 transition hover:bg-white/5 hover:text-white'
                  : 'rounded-full p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800'
              }
              aria-label="Hjelp"
            >
              <HelpCircle size={20} />
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className={
                isDarkMode
                  ? 'rounded-full p-2.5 text-slate-400 transition hover:bg-white/5 hover:text-white'
                  : 'rounded-full p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800'
              }
              aria-label="Innstillinger"
            >
              <Settings size={20} />
            </button>
            <button
              type="button"
              className={
                isDarkMode
                  ? 'rounded-full p-2.5 text-slate-400 transition hover:bg-white/5 hover:text-white'
                  : 'rounded-full p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800'
              }
              aria-label="Varsler (kommer)"
            >
              <Bell size={20} />
            </button>
            <div
              className={
                isDarkMode
                  ? 'ml-1 flex items-center gap-2 border-l border-white/10 pl-3'
                  : 'ml-1 flex items-center gap-2 border-l border-slate-200 pl-3'
              }
            >
              <img
                src={user.photoURL || ''}
                alt=""
                className="h-9 w-9 rounded-full ring-2 ring-teal-500/40"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() => logout()}
                className={
                  isDarkMode
                    ? 'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white'
                    : 'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900'
                }
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Logg ut</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {prefs ? (
          <Dashboard
            isDarkMode={isDarkMode}
            toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
            userId={user.uid}
            prefs={prefs}
          />
        ) : (
          <div className="flex justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal-500/30 border-t-teal-400" />
          </div>
        )}
      </main>

      <footer
        className={
          isDarkMode
            ? 'border-t border-white/5 bg-slate-900/80 py-6 text-center text-xs text-slate-500'
            : 'border-t border-slate-200 bg-white/80 py-6 text-center text-xs text-slate-500'
        }
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4">
          <button
            type="button"
            className="font-medium text-teal-600 hover:underline dark:text-teal-400"
            onClick={() => {
              setHelpTab('faq');
              setHelpOpen(true);
            }}
          >
            Hjelp & FAQ
          </button>
          <button
            type="button"
            className="font-medium text-teal-600 hover:underline dark:text-teal-400"
            onClick={() => {
              setHelpTab('privacy');
              setHelpOpen(true);
            }}
          >
            Personvern
          </button>
          <button
            type="button"
            className="font-medium text-teal-600 hover:underline dark:text-teal-400"
            onClick={() => {
              setHelpTab('terms');
              setHelpOpen(true);
            }}
          >
            Vilkår
          </button>
          <span className="text-slate-400">Data til veiledning — ikke finansråd.</span>
        </div>
      </footer>

      <OnboardingModal
        open={showOnboarding}
        userId={user.uid}
        isDarkMode={isDarkMode}
        onDone={() => {}}
      />
      <SettingsModal
        open={settingsOpen}
        userId={user.uid}
        isDarkMode={isDarkMode}
        remote={rawUserSettings ?? null}
        onClose={() => setSettingsOpen(false)}
      />
      <HelpLegalModal open={helpOpen} isDarkMode={isDarkMode} initialTab={helpTab} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
