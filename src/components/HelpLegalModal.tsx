import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

type Tab = 'faq' | 'privacy' | 'terms';

const FAQ = [
  {
    q: 'Hvor kommer dataene fra?',
    a: 'Annonser hentes via vår egen skannetjeneste mot Finn.no. Prismodellen bygges fra observerte annonser — ikke offisiell prisliste.',
  },
  {
    q: 'Hva betyr «mulig verdi» og fair price?',
    a: 'Det er modellbaserte estimater fra historikk i databasen. Lav confidence eller få sammenlignbare biler betyr usikkerhet. Bruk alltid eget skjønn og takst.',
  },
  {
    q: 'Hvor ofte oppdateres markedet?',
    a: 'Avhengig av hvor ofte skanneren kjører (f.eks. Cloud Scheduler). Sjekk «Siste fullførte scan» på dashboardet.',
  },
  {
    q: 'Får jeg e-postvarsler?',
    a: 'Varsler er under utvikling. Du kan melde interesse under Innstillinger — ingen e-post sendes før funksjonen er lansert og du har godkjent det.',
  },
  {
    q: 'Kontakt',
    a: 'Ta kontakt med eier av tjenesten for support. (Sett inn din e-postadresse her i produksjon.)',
  },
];

const PRIVACY = `Personvernerklæring (utkast)

1. Behandlingsansvarlig er den som drifter denne tjenesten (oppdater med firmanavn og org.nr).

2. Vi behandler innloggingsidentitet via Google (Firebase Authentication), og i noen tilfeller
lagres brukerpreferanser i Firestore (filtre, grenser for listen).

3. Formål: å levere dashbordet du ber om, og forberede eventuelle varsler du uttrykkelig samtykker til senere.

4. Grunnlag: avtale / berettiget interesse for å drive tjenesten; samtykke der det kreves for markedsføring/nyhetsbrev.

5. Lagring: så lenge kontoen er aktiv. Be om sletting ved å kontakte oss — vi sletter brukerinnstillinger og kan koble bort identitet der det er teknisk mulig.

6. Underleverandører: Google (Firebase, Cloud), ev. Vercel. Data kan behandles i EU/USA i henhold til leverandørenes databehandleravtaler.

Dette dokumentet er ikke juridisk gjennomgått — få bistand før kommersiell lansering.`;

const TERMS = `Vilkår for bruk (utkast)

1. Tjenesten leveres «som den er». Vi prøver å holde data oppdatert, men garanterer ikke fullstendighet eller riktighet.

2. Du bruker markedssyn kun som hjelp til egen vurdering. Ingenting her er kjøpsråd, finansråd eller mekanisk garanti.

3. Du skal ikke misbruke tjenesten (bl.a. forsøk på å overbelaste systemer eller omgå tilgangskontroll).

4. Vi kan endre eller avslutte tjenesten med varsel der det er rimelig.

5. Tvister reguleres av norsk lov; verneting Oslo dersom ikke annet er lovfestet.

Juridisk gjennomgang anbefales før betalende kunder.`;

type Props = {
  open: boolean;
  isDarkMode: boolean;
  initialTab?: Tab;
  onClose: () => void;
};

export default function HelpLegalModal({ open, isDarkMode, initialTab = 'faq', onClose }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const panel = isDarkMode
    ? 'flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-600 bg-slate-900 text-slate-100 shadow-2xl'
    : 'flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl';

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      key={t}
      onClick={() => setTab(t)}
      className={
        tab === t
          ? 'border-b-2 border-teal-500 px-3 py-2 text-sm font-semibold text-teal-600 dark:text-teal-400'
          : 'border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
      }
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className={panel} role="dialog" aria-labelledby="help-title">
        <div
          className={
            isDarkMode
              ? 'flex items-center justify-between border-b border-slate-700 px-4 py-3'
              : 'flex items-center justify-between border-b border-slate-200 px-4 py-3'
          }
        >
          <h2 id="help-title" className="font-bold">
            Hjelp og juridisk
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
        <div className="flex border-b border-slate-200 dark:border-slate-700 px-2">
          {tabBtn('faq', 'FAQ')}
          {tabBtn('privacy', 'Personvern')}
          {tabBtn('terms', 'Vilkår')}
        </div>
        <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed">
          {tab === 'faq' && (
            <ul className="space-y-4">
              {FAQ.map((item) => (
                <li key={item.q}>
                  <p className="font-semibold text-slate-900 dark:text-white">{item.q}</p>
                  <p className="mt-1 text-slate-600 dark:text-slate-400">{item.a}</p>
                </li>
              ))}
            </ul>
          )}
          {tab === 'privacy' && (
            <pre className="whitespace-pre-wrap font-sans text-slate-600 dark:text-slate-400">{PRIVACY}</pre>
          )}
          {tab === 'terms' && (
            <pre className="whitespace-pre-wrap font-sans text-slate-600 dark:text-slate-400">{TERMS}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
