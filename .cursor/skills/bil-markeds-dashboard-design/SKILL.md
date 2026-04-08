---
name: bil-markeds-dashboard-design
description: >-
  Visuell retning og mønstre for norske bil-/markedsdashboard (Finn-data, kupp,
  statistikk). Bruk når du designer eller refaktorerer Bruktbil-analytikeren eller
  lignende produkter.
---

# Bil markeds-dashboard (designskill)

## Produktforståelse

- **Domene:** Bruktbilmarked i Norge, typisk data fra Finn.no eller egen scanner.
- **Brukerforventning:** Seriøs, **tall- og faktaorientert** flate — ikke spill eller «crypto»-estetikk.
- **Jobb som skal gjøres:** Hjelpe brukeren å se **marked, avvik og mulige kupp** uten støy.

## Stemme og tone

- Kort, presist språk (bokmål).
- Unngå falske eller hardkodede KPI-er (f.eks. «+12 % siste uke») med mindre de beregnes fra data.
- Forklar usikkerhet der modellen er svak (lav `confidence` / liten `sampleSize`).

## Fargepalett (semantikk)

| Rolle | Bruk | Hensikt |
|--------|------|---------|
| **Slate** (`slate-50`–`slate-950`) | Flater, tekst, grid | Nøytral, «fintech»-ro |
| **Teal / brand** (`teal-600`, `teal-700`) | Primærknapper, lenker, positive serier | Tillit, handling |
| **Amber / value** (`amber-500`, `amber-600`) | Kupp, avvik, varsler | **Verdi** (underpris), oppmerksomhet uten rød alarm |
| **Rød** | Kun feil / blokkerende tilstand | Sparing |

Unngå «generisk blå grå-knapp overalt» — behold blå kun som sekundær hvis nødvendig.

## Typografi og layout

- **Skrift:** `DM Sans` (allerede i prosjektet) — god lesbarhet for tall og tabeller.
- **Hierarchy:** Tittel → ingress (muted) → tall (store, tydelige) → hjelpetekst (liten, muted).
- **Kort:** Myke hjørner (`rounded-xl` / `rounded-2xl`), tynn kant `border-slate-200/80`, lett skygge eller `ring-1 ring-slate-900/5`.
- **Mørk modus:** Samme semantikk; mørk slate-bakgrunn, lys tekst, ikke helt svart.

## Diagrammer (Recharts)

- Bruk **teal** og **amber** som hovedserier; grid `stroke-slate-200` / `stroke-slate-700`.
- Tooltip: samme bakgrunn som «elevated surface», god kontrast.
- Unngå for mange serier samtidig — maks 2–3 uten forklaring.

## Tilgjengelighet

- Kontrasttekst mot merket amber på lys bakgrunn (bruk mørk amber/teal for små etiketter).
- Fokustilstand på knapper og `select`.
- Ikke bare farge for status — kombiner med ikon eller label.

## Når du endrer UI

1. Behold **semantiske farger** (ikke tilfeldig palett per skjerm).
2. **Fjern eller beregn** trender som ikke finnes i Firestore.
3. Align felter med backend (`km` vs `mileage`, `url` vs `finnId`, manglende `sellerType`).

## Prisanbefaling (produkt — veiledende, Norge 2026)

Dette er **markedsspill**, ikke garanti. Typisk for personlig «deal radar»:

| Modell | Pris/mnd (NOK) | Merknad |
|--------|----------------|--------|
| **Hobby / enkel varsling** | 79–149 | Få regioner, enkel e-post/push |
| **Standard (nåværende produkt)** | 149–249 | Full dashboard, filtere, flere regioner |
| **Aktiv kjøper / «pro»** | 299–449 | Hyppigere scan, flere varsler, prioritering |
| **Livstid tidlig kunde** | 999–1999 engangs | Kun ved begrenset antall plasser |

B2B (forhandler / import): egen pris (5 000–25 000+ / mnd avhengig av seter og data).

Ved **Stripe + Firebase** og lav support-last: start **199 kr/mnd** eller **149 kr/mnd** årlig rabatt for å få volum.
