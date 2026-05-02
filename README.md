# Bilsnapper

Frontend og lokal server for innlogging, dashboard, scan-triggering og Finn/Firestore-integrasjon.

## Lokalt oppsett

1. Installer avhengigheter med `npm install`
2. Sørg for at `firebase-applet-config.json` peker til riktig Firebase-prosjekt og database
3. Sett eventuelle `VITE_*`-variabler og `SCAN_SECRET` i miljøet hvis du trenger egen scanner-URL eller beskyttet scan-endepunkt

## Kommandoer

- `npm run dev`
  Starter appen via `server.ts`
- `npm run dev:quiet`
  Starter appen via `server.ts` uten å kjøre scraper automatisk ved oppstart
- `npm run scrape`
  Kjører bare scraperen én gang
- `npm run build`
  Bygger frontend for produksjon
- `npm run preview`
  Vite preview av bare frontend-bygget
- `npm run preview:server`
  Kjører produksjonsserveren lokalt mot `dist/` uten auto-scan
- `npm run lint`
  Typecheck med `tsc --noEmit`

## Viktig om scan-knappen

- Same-origin scan virker når appen kjøres gjennom `server.ts`
- Hvis du kun kjører `vite preview`, finnes ikke scan-rutene
- Hvis scan-backenden ligger et annet sted, sett `VITE_SCANNER_URL`
- Hvis du kjører ren Vite-dev på port 5173, proxier Vite nå `/scan` og `/api` til `localhost:3000`

## Viktig om Firestore

- Dashboard, onboarding og settings leser fra `user_settings`, `cars`, `market_statistics` og `scans/latest`
- Ved Firestore-feil degraderer appen til lokale innstillinger i nettleseren
- Hvis du får `permission-denied`, sjekk både `firestore.rules` og at riktig `firestoreDatabaseId` er valgt
