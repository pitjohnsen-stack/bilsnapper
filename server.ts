import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cron from 'node-cron';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  writeBatch,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';
import * as cheerio from 'cheerio';
import nodemailer from 'nodemailer';
import { initializeApp as initAdminApp, getApps, getApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';
import type { DocumentData, Firestore } from 'firebase-admin/firestore';

// Initialize Firebase in backend
const firebaseConfig = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(firebaseApp);

/** Når satt, brukes Admin SDK (omgår client Auth + Firestore-regler for skriving). */
let adminFirestore: Firestore | null = null;

function loadAdminServiceAccountCredential(): ReturnType<typeof cert> | ReturnType<typeof applicationDefault> | null {
  const jsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonRaw) {
    try {
      return cert(JSON.parse(jsonRaw));
    } catch (e) {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON er ugyldig:', e);
    }
  }
  const pathFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  const candidates = [...new Set([pathFromEnv, 'firebase-adminsdk.json', 'serviceAccountKey.json', 'service-account.json'])].filter(
    (x): x is string => Boolean(x),
  );
  for (const rel of candidates) {
    const abs = path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
    if (!fs.existsSync(abs)) continue;
    try {
      console.log(`📎 Firebase Admin: leser ${path.basename(abs)}`);
      return cert(JSON.parse(fs.readFileSync(abs, 'utf-8')));
    } catch (e) {
      console.error(`Kunne ikke lese service account fra ${abs}:`, e);
    }
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    try {
      return applicationDefault();
    } catch {
      /* ignorert */
    }
  }
  return null;
}

function tryInitFirebaseAdmin(): boolean {
  if (adminFirestore) return true;
  const credential = loadAdminServiceAccountCredential();
  if (!credential) return false;
  if (!getApps().length) {
    initAdminApp({ credential, projectId: firebaseConfig.projectId });
  }
  adminFirestore = getAdminFirestore(getApp(), firebaseConfig.firestoreDatabaseId);
  console.log('✅ Firebase Admin aktiv — scraper trenger ikke SCRAPER_EMAIL/SCRAPER_PASSWORD.');
  return true;
}

function firestoreBackendReady(): boolean {
  return adminFirestore != null || auth.currentUser != null;
}

let scanSecretWarned = false;

function scanRequestAuthorized(req: express.Request): boolean {
  const secret = process.env.SCAN_SECRET?.trim();
  if (!secret) {
    if (!scanSecretWarned) {
      scanSecretWarned = true;
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ SCAN_SECRET er ikke satt i produksjon — /scan avvises. Sett SCAN_SECRET i miljøet.');
      } else {
        console.warn('⚠️ SCAN_SECRET er ikke satt — POST /scan er åpen i dev. Sett SCAN_SECRET i produksjon.');
      }
    }
    // In production, deny when secret is missing. In dev, allow for convenience.
    return process.env.NODE_ENV !== 'production';
  }
  return req.headers['x-scan-secret'] === secret;
}

// Authenticate Backend: foretrekk Firebase Admin (service account). Ellers SCRAPER_EMAIL + SCRAPER_PASSWORD (client SDK).
async function authenticateBackend(): Promise<boolean> {
  if (tryInitFirebaseAdmin()) return true;

  const email = process.env.SCRAPER_EMAIL?.trim() ?? '';
  const password = process.env.SCRAPER_PASSWORD ?? '';
  if (!email || !password) {
    console.error(
      '❌ Ingen Firestore-skriving: legg inn service account ELLER SCRAPER_EMAIL + SCRAPER_PASSWORD.',
    );
    console.error(
      '   A) Enklest: Firebase Console → Prosjektinnstillinger → Service accounts → «Generer ny privat nøkkel». Lagre som firebase-adminsdk.json i prosjektmappa (allerede i .gitignore).',
    );
    console.error(
      '   B) Alternativt: opprett bruker under Authentication (e-post/passord) som matcher firestore.rules, og sett SCRAPER_EMAIL / SCRAPER_PASSWORD i .env.',
    );
    return false;
  }
  // firestore.rules krever at brukeren har custom claim admin==true
  // ELLER et dokument i admins/{uid}. Anbefalt: bruk service account (Admin SDK)
  // som uansett omgår rules. Ved client-SDK-auth: bootstrap admins/{uid} via Firebase Console.
  console.log(
    `ℹ️ Scraper logger inn som «${email}». Brukeren må ha et admins/{uid}-dokument eller custom claim admin==true for å kunne skrive til Firestore.`,
  );
  try {
    await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Backend authenticated successfully.');
    return true;
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: string }).code) : '';
    if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        console.log('✅ Backend user created and authenticated.');
        return true;
      } catch (createError) {
        console.error('❌ Failed to create backend user:', createError);
        return false;
      }
    } else {
      console.error('❌ Failed to authenticate backend:', error);
      return false;
    }
  }
}

// Setup Nodemailer Test Account
let transporter: nodemailer.Transporter | null = null;
nodemailer.createTestAccount().then(account => {
  transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass }
  });
  console.log('📧 Nodemailer test account ready. Emails will be logged with preview URLs.');
}).catch(err => console.error('Failed to create nodemailer test account:', err));

/** Brukte biler (alle merker). Override med FINN_CAR_SEARCH_URL for snevrere søk (f.eks. én merke). */
const DEFAULT_FINN_CAR_SEARCH =
  'https://www.finn.no/mobility/search/car?registration_class=1&sort=PUBLISHED_DESC';

const finnSearchUrl = () =>
  process.env.FINN_CAR_SEARCH_URL?.trim() || DEFAULT_FINN_CAR_SEARCH;

// --- Getaround eligibility constants ---
const GETAROUND_MAX_AGE_YEARS = 15;
const GETAROUND_MAX_KM = 200_000;
const GETAROUND_EXCLUDED_BRANDS = new Set([
  'Ferrari', 'Porsche', 'Lamborghini', 'Maserati', 'Bentley',
  'Rolls-Royce', 'Aston Martin', 'McLaren', 'Bugatti', 'Lotus',
]);
const GETAROUND_MIN_YEAR = new Date().getFullYear() - GETAROUND_MAX_AGE_YEARS;

function isGetaroundEligible(s: ListingSummary): boolean {
  if (s.year && s.year < GETAROUND_MIN_YEAR) return false;
  if (s.mileage != null && s.mileage >= GETAROUND_MAX_KM) return false;
  if (GETAROUND_EXCLUDED_BRANDS.has(s.brand)) return false;
  return true;
}

/**
 * Genererer årsbaserte shard-URLer for Getaround-egnede biler (2011+).
 * Hvert shard dekker et årsintervall slik at hvert søk har <2500 treff.
 */
function generateYearShardUrls(): string[] {
  const base = DEFAULT_FINN_CAR_SEARCH;
  const minYear = String(GETAROUND_MIN_YEAR);
  const shards: Array<{ year_from?: string; year_to?: string }> = [
    { year_from: minYear, year_to: String(GETAROUND_MIN_YEAR + 2) },
    { year_from: String(GETAROUND_MIN_YEAR + 3), year_to: String(GETAROUND_MIN_YEAR + 5) },
    { year_from: String(GETAROUND_MIN_YEAR + 6), year_to: String(GETAROUND_MIN_YEAR + 7) },
    { year_from: String(GETAROUND_MIN_YEAR + 8), year_to: String(GETAROUND_MIN_YEAR + 9) },
    { year_from: String(GETAROUND_MIN_YEAR + 10), year_to: String(GETAROUND_MIN_YEAR + 11) },
    { year_from: String(GETAROUND_MIN_YEAR + 12) },
  ];
  return shards.map(params => {
    const url = new URL(base);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v as string));
    return url.toString();
  });
}

const finnMaxSearchPages = () => {
  const n = parseInt(process.env.FINN_MAX_SEARCH_PAGES || '120', 10);
  return Number.isFinite(n) && n > 0 ? n : 120;
};

const finnPageDelayMs = () => {
  const n = parseInt(process.env.FINN_PAGE_DELAY_MS || '1500', 10);
  return Number.isFinite(n) && n >= 0 ? n : 1500;
};

const finnDeepScrapeMax = () => {
  const n = parseInt(process.env.FINN_DEEP_SCRAPE_MAX || '0', 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

function mobilityFinnIdFromUrl(url: string): string | null {
  const m = url.match(/\/mobility\/item\/(\d+)/);
  return m ? m[1] : null;
}

type ListingSummary = {
  finnId: string;
  adUrl: string;
  brand: string;
  model: string;
  price: number;
  /** Første bilde-URL fra JSON-LD (images.finncdn.no) når tilgjengelig */
  imageUrl?: string;
  /** Årsmodell fra JSON-LD vehicleModelDate */
  year?: number;
  /** Kilometerstand fra JSON-LD mileageFromOdometer */
  mileage?: number;
  /** Drivstoff fra JSON-LD fuelType */
  fuel?: string;
  /** Farge fra JSON-LD color */
  color?: string;
  /** Girkasse fra JSON-LD vehicleTransmission */
  gearbox?: string;
  /** Antall tidligere eiere fra JSON-LD numberOfPreviousOwners */
  owners?: number;
  /** Sted/region fra JSON-LD availableAtOrFrom eller seller.address */
  region?: string;
  /** Selgertype: 'privat' | 'forhandler' */
  sellerType?: string;
};

/** Trekker ut første bilde-URL fra schema.org image (streng, liste, eller ImageObject). */
function firstImageUrlFromJsonLd(image: unknown): string | undefined {
  if (typeof image === 'string' && image.startsWith('http')) return image.trim();
  if (Array.isArray(image)) {
    for (const x of image) {
      if (typeof x === 'string' && x.startsWith('http')) return x.trim();
      if (x && typeof x === 'object' && 'url' in x) {
        const u = (x as { url?: unknown }).url;
        if (typeof u === 'string' && u.startsWith('http')) return u.trim();
      }
    }
  }
  if (image && typeof image === 'object' && 'url' in image) {
    const u = (image as { url?: unknown }).url;
    if (typeof u === 'string' && u.startsWith('http')) return u.trim();
  }
  return undefined;
}

/** Hjelper: parse år fra vehicleModelDate-streng (f.eks. "2019" eller "2019-01-01") */
function parseYear(raw: unknown): number | undefined {
  if (typeof raw === 'number' && raw > 1980 && raw < 2100) return raw;
  if (typeof raw === 'string') {
    const m = raw.match(/\b(19\d{2}|20\d{2})\b/);
    const y = m ? parseInt(m[1], 10) : NaN;
    if (!Number.isNaN(y) && y > 1980 && y < 2100) return y;
  }
  return undefined;
}

/** Hjelper: parse km fra mileageFromOdometer (QuantitativeValue eller tall) */
function parseMileage(raw: unknown): number | undefined {
  if (typeof raw === 'number' && raw >= 0) return raw;
  if (raw && typeof raw === 'object') {
    const qv = raw as Record<string, unknown>;
    const val = qv.value ?? qv.unitValue;
    if (typeof val === 'number' && val >= 0) return val;
    if (typeof val === 'string') {
      const n = parseInt(val.replace(/\D/g, ''), 10);
      if (!Number.isNaN(n) && n >= 0) return n;
    }
  }
  return undefined;
}

/** Hjelper: hent region/sted fra seller.address eller availableAtOrFrom */
function parseRegion(item: Record<string, unknown>): string | undefined {
  // availableAtOrFrom → { address: { addressLocality, addressRegion } }
  const avail = item.availableAtOrFrom as Record<string, unknown> | undefined;
  const addr = (avail?.address ?? (item.seller as Record<string, unknown>)?.address) as Record<string, unknown> | undefined;
  if (addr) {
    const loc = addr.addressLocality ?? addr.addressRegion;
    if (typeof loc === 'string' && loc.trim()) return loc.trim();
  }
  // Direkte address-felt på item
  const itemAddr = item.address as Record<string, unknown> | undefined;
  if (itemAddr) {
    const loc = itemAddr.addressLocality ?? itemAddr.addressRegion;
    if (typeof loc === 'string' && loc.trim()) return loc.trim();
  }
  return undefined;
}

/** Hjelper: selgertype fra seller['@type'] */
function parseSellerType(item: Record<string, unknown>): string {
  const seller = item.seller as Record<string, unknown> | undefined;
  const t = seller?.['@type'];
  if (typeof t === 'string') {
    if (t === 'Person') return 'privat';
    if (t === 'LocalBusiness' || t === 'Organization' || t === 'AutoDealer') return 'forhandler';
  }
  return 'forhandler';
}

/** Product cards from søkeresultat (JSON-LD) — henter alle tilgjengelige felt uten ekstra HTTP per annonse. */
function extractListingSummariesFromSeoHtml(html: string): ListingSummary[] {
  const $ = cheerio.load(html);
  const raw = $('script#seoStructuredData').first().html();
  if (!raw?.trim()) {
    return extractListingSummariesFromHtmlFallback(html);
  }
  try {
    const data = JSON.parse(raw.trim()) as {
      mainEntity?: {
        itemListElement?: Array<{
          item?: Record<string, unknown>;
        }>;
      };
    };
    const elements = data?.mainEntity?.itemListElement;
    if (!Array.isArray(elements)) {
      return extractListingSummariesFromHtmlFallback(html);
    }
    const out: ListingSummary[] = [];
    for (const el of elements) {
      const item = el?.item;
      if (!item) continue;
      const url = item.url;
      if (typeof url !== 'string') continue;
      const finnId = mobilityFinnIdFromUrl(url);
      if (!finnId) continue;

      const priceRaw = (item.offers as Record<string, unknown> | undefined)?.price;
      const price =
        typeof priceRaw === 'number'
          ? priceRaw
          : parseInt(String(priceRaw ?? '').replace(/\D/g, ''), 10);
      if (!price || Number.isNaN(price)) continue;

      const brandRaw = item.brand as Record<string, unknown> | undefined;
      const brand = typeof brandRaw?.name === 'string' && brandRaw.name.trim() ? brandRaw.name.trim() : 'Ukjent';
      const model = typeof item.model === 'string' && item.model.trim() ? item.model.trim() : 'Ukjent';
      const imageUrl = firstImageUrlFromJsonLd(item.image);

      // Ekstra felt fra schema.org Vehicle
      const year = parseYear(item.vehicleModelDate ?? item.modelDate ?? item.datePublished);
      const mileage = parseMileage(item.mileageFromOdometer ?? item.mileage);
      const fuel = typeof item.fuelType === 'string' && item.fuelType.trim() ? item.fuelType.trim() : undefined;
      const color = typeof item.color === 'string' && item.color.trim() && item.color !== 'Ukjent' ? item.color.trim() : undefined;
      const gearbox = typeof item.vehicleTransmission === 'string' && item.vehicleTransmission.trim() ? item.vehicleTransmission.trim() : undefined;
      const ownersRaw = item.numberOfPreviousOwners;
      const owners = typeof ownersRaw === 'number' ? ownersRaw + 1 : (typeof ownersRaw === 'string' ? parseInt(ownersRaw, 10) + 1 : undefined);
      const region = parseRegion(item);
      const sellerType = parseSellerType(item);

      out.push({
        finnId,
        adUrl: url.startsWith('http') ? url : `https://www.finn.no${url}`,
        brand,
        model,
        price,
        ...(imageUrl ? { imageUrl } : {}),
        ...(year ? { year } : {}),
        ...(mileage != null ? { mileage } : {}),
        ...(fuel ? { fuel } : {}),
        ...(color ? { color } : {}),
        ...(gearbox ? { gearbox } : {}),
        ...(owners && owners > 0 && owners < 20 ? { owners } : {}),
        ...(region ? { region } : {}),
        sellerType,
      });
    }
    if (out.length > 0) return out;
    return extractListingSummariesFromHtmlFallback(html);
  } catch (e) {
    console.warn('Failed to parse listing summaries from seoStructuredData:', e);
    return extractListingSummariesFromHtmlFallback(html);
  }
}

/**
 * Reserve når Finn endrer / mangler script#seoStructuredData: finn lenker til annonser + pris i kort.
 */
function extractListingSummariesFromHtmlFallback(html: string): ListingSummary[] {
  const $ = cheerio.load(html);
  const byId = new Map<string, ListingSummary>();

  $('a[href*="/mobility/item/"], a[href*="finnkode="]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    if (!href) return;
    const absolute = href.startsWith('http')
      ? href
      : `https://www.finn.no${href.startsWith('/') ? href : `/${href}`}`;

    let finnId = mobilityFinnIdFromUrl(absolute);
    if (!finnId) {
      const m = href.match(/[?&]finnkode=(\d+)/i) || absolute.match(/[?&]finnkode=(\d+)/i);
      finnId = m ? m[1] : null;
    }
    if (!finnId || byId.has(finnId)) return;

    const card = $(el).closest('article, [data-testid], li').first();
    const scope = card.length ? card : $(el).parents().eq(4);
    const text = scope.text().replace(/\u00a0/g, ' ');
    const priceMatch =
      text.match(/(\d{1,3}(?:\s\d{3})+)\s*,?\s*(?:kr|,-)/i) ||
      text.match(/(\d{4,})\s*(?:kr|,-)/i);
    const price = priceMatch ? parseInt(priceMatch[1].replace(/\s/g, ''), 10) : 0;
    if (!price || price < 5000) return;

    const rawTitle =
      $(el).attr('title')?.trim() ||
      $(el).closest('article').find('h2, h3').first().text().trim() ||
      $(el).text().trim();
    const title = rawTitle.replace(/\s+/g, ' ').trim();
    let brand = 'Ukjent';
    let model = 'Ukjent';
    if (title.length > 1) {
      const bits = title.split(/\s+/).filter(Boolean);
      if (bits.length >= 2) {
        brand = bits[0];
        model = bits.slice(1).join(' ');
      } else {
        model = title;
      }
    }

    const adUrl = `https://www.finn.no/mobility/item/${finnId}`;

    // Prøv å hente år og km fra kortets tekst
    const yearMatch = text.match(/\b(199\d|200\d|201\d|202\d)\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;

    const kmMatch =
      text.match(/(\d{1,3}(?:\s\d{3})*)\s*km\b/i) ||
      text.match(/(\d{1,3}(?:\s\d{3})*)\s*mil\b/i);
    let mileage: number | undefined;
    if (kmMatch) {
      const n = parseInt(kmMatch[1].replace(/\s/g, ''), 10);
      const isMil = /mil\b/i.test(kmMatch[0]);
      mileage = isMil ? n * 10 : n;
    }

    byId.set(finnId, {
      finnId, adUrl, brand, model, price,
      ...(year ? { year } : {}),
      ...(mileage != null ? { mileage } : {}),
    });
  });

  if (byId.size === 0) {
    console.warn('Fallback-parser fant ingen annonser (Finn kan ha endret HTML).');
  } else {
    console.log(`Fallback-parser: ${byId.size} annonser fra lenker/tekst.`);
  }
  return [...byId.values()];
}

function summaryToCarRecord(s: ListingSummary) {
  const now = new Date().toISOString();
  return {
    finnId: s.finnId,
    brand: s.brand,
    model: s.model,
    year: s.year ?? 0,
    price: s.price,
    mileage: s.mileage ?? 0,
    engineVolume: 'Ukjent',
    gearbox: s.gearbox ?? 'Ukjent',
    fuel: s.fuel ?? 'Ukjent',
    color: s.color ?? 'Ukjent',
    equipmentLevel: 'Standard',
    owners: s.owners ?? null,
    euApprovedUntil: 'Ukjent',
    sellerType: s.sellerType ?? 'forhandler',
    sellerName: 'Ukjent',
    region: s.region ?? 'Ukjent',
    municipality: 'Ukjent',
    adDate: now,
    lastSeen: now,
    ...(s.imageUrl ? { imageUrl: s.imageUrl, imageCount: 1 } : { imageCount: 0 }),
    status: 'active',
    isComplete: false,
    isAuction: false,
  };
}

const BROWSER_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15',
];

function randomUserAgent(): string {
  return BROWSER_USER_AGENTS[Math.floor(Math.random() * BROWSER_USER_AGENTS.length)];
}

function jitter(baseMs: number): number {
  return baseMs + Math.floor(Math.random() * baseMs * 0.5);
}

async function fetchFinnSearchHtml(url: string, referer?: string): Promise<string> {
  const headers: Record<string, string> = {
    'User-Agent': randomUserAgent(),
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'nb-NO,nb;q=0.9,no;q=0.8,en-US;q=0.7,en;q=0.6',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };
  if (referer) headers['Referer'] = referer;

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { headers });
      if (response.status === 429) {
        const wait = jitter(15_000 * attempt);
        console.warn(`429 Rate limited — venter ${Math.round(wait / 1000)}s (forsøk ${attempt}/${MAX_RETRIES})…`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!response.ok) throw new Error(`Finn.no svarte ${response.status}`);
      return response.text();
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      const wait = jitter(3_000 * attempt);
      console.warn(`Fetch feilet (forsøk ${attempt}/${MAX_RETRIES}), venter ${Math.round(wait / 1000)}s: ${err}`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw new Error('fetchFinnSearchHtml: alle forsøk feilet');
}

/** Henter alle unike treff ved å bla `page=` til ingen nye annonser kommer. */
async function collectAllListingSummaries(baseSearchUrl: string): Promise<ListingSummary[]> {
  const maxPages = finnMaxSearchPages();
  const delayMs = finnPageDelayMs();
  const seen = new Set<string>();
  const all: ListingSummary[] = [];

  let consecutiveNoNew = 0;
  const maxConsecutiveNoNew = Math.max(3, parseInt(process.env.FINN_MAX_EMPTY_PAGES || '6', 10) || 6);

  let prevPageUrl: string | undefined;

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = new URL(baseSearchUrl);
    if (page > 1) pageUrl.searchParams.set('page', String(page));
    const pageUrlStr = pageUrl.toString();

    console.log(`Søkeside ${page}/${maxPages}…`);

    let summaries: ListingSummary[] = [];
    try {
      const html = await fetchFinnSearchHtml(pageUrlStr, prevPageUrl);
      summaries = extractListingSummariesFromSeoHtml(html);
    } catch (err) {
      console.warn(`Side ${page} feilet etter alle retries: ${err}. Hopper over.`);
      consecutiveNoNew++;
      if (consecutiveNoNew >= maxConsecutiveNoNew) break;
      if (delayMs > 0) await new Promise(r => setTimeout(r, jitter(delayMs)));
      continue;
    }

    prevPageUrl = pageUrlStr;

    let added = 0;
    for (const s of summaries) {
      if (seen.has(s.finnId)) continue;
      seen.add(s.finnId);
      all.push(s);
      added++;
    }

    if (summaries.length === 0) {
      // Finn returnerte ingen parsbar data — mulig bot-blokkering eller siste side
      consecutiveNoNew++;
      console.log(`Side ${page}: 0 parsbare treff (${consecutiveNoNew}/${maxConsecutiveNoNew} på rad).`);
    } else {
      console.log(`  +${added} nye (total ${all.length} unike)`);
      if (added === 0) {
        consecutiveNoNew++;
      } else {
        consecutiveNoNew = 0;
      }
    }

    if (consecutiveNoNew >= maxConsecutiveNoNew) {
      console.log(`${maxConsecutiveNoNew} sider på rad uten nye annonser — stopper shard.`);
      break;
    }

    if (page < maxPages && delayMs > 0) {
      await new Promise(r => setTimeout(r, jitter(delayMs)));
    }
  }

  return all;
}

async function commitCarsInBatches(cars: Record<string, unknown>[]) {
  const BATCH = 400;
  try {
    if (adminFirestore) {
      for (let i = 0; i < cars.length; i += BATCH) {
        const chunk = cars.slice(i, i + BATCH);
        const batch = adminFirestore.batch();
        for (const car of chunk) {
          const finnId = car.finnId as string;
          batch.set(adminFirestore.collection('cars').doc(finnId), car as Record<string, unknown>, { merge: true });
        }
        await batch.commit();
        console.log(`Firestore (Admin): lagret batch ${Math.floor(i / BATCH) + 1} (${chunk.length} biler)`);
      }
      return;
    }
    for (let i = 0; i < cars.length; i += BATCH) {
      const chunk = cars.slice(i, i + BATCH);
      const batch = writeBatch(db);
      for (const car of chunk) {
        const finnId = car.finnId as string;
        batch.set(doc(db, 'cars', finnId), car, { merge: true });
      }
      await batch.commit();
      console.log(`Firestore: lagret batch ${Math.floor(i / BATCH) + 1} (${chunk.length} biler)`);
    }
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
    console.error('Firestore batch feilet:', e);
    if (code === 'permission-denied') {
      console.error(
        '→ permission-denied: bruk Firebase Admin-nøkkel, eller SCRAPER_EMAIL/PASSWORD + isAdmin i firestore.rules.',
      );
    }
    throw e;
  }
}

const fetchHeadersAd = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'nb-NO,nb;q=0.9',
};

async function deepScrapeSingleAd(adUrl: string): Promise<Record<string, unknown> | null> {
  const finnId = mobilityFinnIdFromUrl(adUrl) || adUrl.split('finnkode=')[1]?.split('&')[0];
  if (!finnId) return null;

  await new Promise(r => setTimeout(r, 1000));
  const adRes = await fetch(adUrl, { headers: fetchHeadersAd });
  if (!adRes.ok) return null;
  const adHtml = await adRes.text();
  const $ad = cheerio.load(adHtml);

  const productLd = parseProductJsonLd(adHtml);
  const title =
    productLd?.name?.trim() ||
    $ad('h1').not('.sr-only').first().text().trim() ||
    $ad('h1').first().text().trim();

  let brand = productLd?.brand || 'Ukjent';
  let model = productLd?.model || 'Ukjent';
  if (brand === 'Ukjent' || model === 'Ukjent') {
    const parts = title.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      if (brand === 'Ukjent') brand = parts[0];
      if (model === 'Ukjent') model = parts.slice(1).join(' ');
    }
  }

  let price = productLd?.price ?? NaN;
  if (!price || Number.isNaN(price)) {
    const priceText = $ad('.text-2xl.font-bold, .text-3xl.font-bold')
      .first()
      .text()
      .replace(/[^0-9]/g, '');
    price = parseInt(priceText, 10);
  }

  let mileage = 0;
  let year = 0;
  let euApprovedUntil = 'Ukjent';
  let gearbox = 'Ukjent';
  let fuel = 'Ukjent';
  let color = 'Ukjent';
  let owners: number | null = null;

  let region = 'Ukjent';
  let municipality = 'Ukjent';
  let sellerType = 'forhandler';

  $ad('dt').each((_, el) => {
    const label = $ad(el).text().trim();
    const value = $ad(el).next('dd').text().trim();

    if (label === 'Kilometerstand') mileage = parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
    // Finn.no uses 'Modellår' (not 'Årsmodell') on most pages
    if (label === 'Modellår' || label === 'Årsmodell' || label === 'Registreringsår') {
      year = parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
    }
    if (label === 'Neste frist for EU-kontroll' || label === 'EU-godkjent til' || label === 'Sist EU-godkjent') {
      euApprovedUntil = value;
    }
    if (label === 'Girkasse') gearbox = value;
    if (label === 'Drivstoff') fuel = value;
    if (label === 'Farge') color = value;
    if (label === 'Eiere' || label === 'Antall eiere' || label === 'Antall tidligere eiere') {
      const n = parseInt(value.replace(/[^0-9]/g, ''), 10);
      if (!Number.isNaN(n) && n > 0) owners = n;
    }
    if (label === 'Bilen står i' || label === 'Fylke' || label === 'Region') region = value;
    if (label === 'Kommune' || label === 'Sted') municipality = value;
  });

  // Selgertype: se etter "Selger" i dl, eller sjekk sidetekst
  const sellerText = $ad('dt').filter((_, el) => $ad(el).text().trim() === 'Selgertype').next('dd').text().trim();
  if (sellerText) {
    sellerType = /privat/i.test(sellerText) ? 'privat' : 'forhandler';
  } else if ($ad('[data-testid="object-page-owner"]').length || $ad('.u-caption:contains("Privat")').length) {
    sellerType = 'privat';
  }

  if (!price || Number.isNaN(price)) return null;

  const ogImage = $ad('meta[property="og:image"]').attr('content')?.trim();
  const imageUrl =
    productLd?.imageUrl ||
    (ogImage && ogImage.startsWith('http') ? ogImage : undefined);

  const now = new Date().toISOString();
  return {
    finnId,
    brand,
    model,
    year,
    price,
    mileage,
    engineVolume: 'Ukjent',
    gearbox,
    fuel,
    color,
    equipmentLevel: 'Standard',
    owners,
    euApprovedUntil,
    sellerType,
    sellerName: 'Ukjent',
    region,
    municipality,
    adDate: now,
    lastSeen: now,
    ...(imageUrl ? { imageUrl, imageCount: 1 } : {}),
    status: 'active',
    isComplete: true,
    isAuction: false,
  };
}

type ProductLd = {
  brand?: string;
  model?: string;
  price?: number;
  name?: string;
  imageUrl?: string;
};

function parseProductJsonLd(html: string): ProductLd | null {
  const $ = cheerio.load(html);
  let parsed: ProductLd | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw?.trim()) return;
    try {
      const j = JSON.parse(raw.trim()) as Record<string, unknown> | Record<string, unknown>[];
      const arr = Array.isArray(j) ? j : [j];
      for (const node of arr) {
        if (!node || node['@type'] !== 'Product') continue;
        const offer = node.offers as Record<string, unknown> | undefined;
        const priceRaw = offer?.price;
        const price =
          typeof priceRaw === 'number'
            ? priceRaw
            : parseInt(String(priceRaw ?? '').replace(/\D/g, ''), 10);
        if (!price || Number.isNaN(price)) continue;
        const b = node.brand as { name?: string } | string | undefined;
        const brandName = typeof b === 'object' && b?.name ? b.name : undefined;
        const imageUrl = firstImageUrlFromJsonLd(node.image);
        parsed = {
          price,
          brand: typeof brandName === 'string' ? brandName : undefined,
          model: typeof node.model === 'string' ? node.model : undefined,
          name: typeof node.name === 'string' ? node.name : undefined,
          ...(imageUrl ? { imageUrl } : {}),
        };
      }
    } catch {
      /* skip */
    }
  });
  return parsed;
}

// Scraper & Analyzer Logic
async function runScraper() {
  if (!firestoreBackendReady()) {
    console.error(
      '❌ Scanner stoppet: ingen Firestore-backend. Start serveren etter vellykket auth, legg inn firebase-adminsdk.json, eller sett SCRAPER_EMAIL/SCRAPER_PASSWORD.',
    );
    return;
  }

  const shardMode = (process.env.FINN_SHARD_MODE || '').toLowerCase();
  const searchUrls = shardMode === 'year'
    ? generateYearShardUrls()
    : [finnSearchUrl()];

  console.log(`Starting Finn.no scraper… ${searchUrls.length} shard(s), modus: ${shardMode || 'single'}`);

  const byId = new Map<string, Record<string, unknown>>();

  try {
    for (let shardIdx = 0; shardIdx < searchUrls.length; shardIdx++) {
      const searchUrl = searchUrls[shardIdx];
      console.log(`\n--- Shard ${shardIdx + 1}/${searchUrls.length}: ${searchUrl} ---`);
      try {
        const summaries = await collectAllListingSummaries(searchUrl);
        const eligible = summaries.filter(isGetaroundEligible);
        console.log(`Shard ${shardIdx + 1}: ${summaries.length} annonser, ${eligible.length} Getaround-egnede`);
        for (const s of eligible) {
          if (!byId.has(s.finnId)) byId.set(s.finnId, summaryToCarRecord(s));
        }
      } catch (shardErr) {
        console.error(`Shard ${shardIdx + 1} feilet:`, shardErr);
      }
      if (shardIdx < searchUrls.length - 1) {
        console.log('Venter 5s mellom shards…');
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    console.log(`\nTotalt ${byId.size} unike annonser fra alle shards.`);

    const deepMax = finnDeepScrapeMax();
    if (deepMax > 0) {
      // Prioriter biler som IKKE allerede er i Firestore med komplett data (isComplete=true)
      // Hent eksisterende finnIds med isComplete=true fra Firestore
      let alreadyComplete = new Set<string>();
      try {
        if (adminFirestore) {
          const snap = await adminFirestore.collection('cars').where('isComplete', '==', true).select('finnId').get();
          snap.docs.forEach(d => { const fid = d.data().finnId; if (fid) alreadyComplete.add(String(fid)); });
        } else {
          const snap = await getDocs(query(collection(db, 'cars'), where('isComplete', '==', true)));
          snap.docs.forEach(d => { const fid = d.data().finnId; if (fid) alreadyComplete.add(String(fid)); });
        }
        console.log(`${alreadyComplete.size} biler er allerede dybdeskrapet — hopper over disse.`);
      } catch (e) {
        console.warn('Kunne ikke hente isComplete-liste, deep-scraper alle:', e);
      }

      // Prioriter nye biler (ikke i alreadyComplete), ta opp til deepMax
      const allCars = [...byId.values()];
      const newCars = allCars.filter(c => !alreadyComplete.has(String(c.finnId)));
      const urls = newCars
        .slice(0, deepMax)
        .map(c => (c.adUrl as string) || (c.finnId ? `https://www.finn.no/mobility/item/${c.finnId}` : ''))
        .filter(Boolean);
      console.log(`Dybdeskraping ${urls.length} NYE annonser av ${newCars.length} totalt nye (FINN_DEEP_SCRAPE_MAX=${deepMax})…`);
      for (const adUrl of urls) {
        try {
          const detailed = await deepScrapeSingleAd(adUrl);
          if (!detailed?.finnId) continue;
          const finnId = String(detailed.finnId);
          const base = byId.get(finnId) || { finnId };
          byId.set(finnId, { ...base, ...detailed, isComplete: true });
        } catch (err) {
          console.error(`Deep scrape feilet ${adUrl}:`, err);
        }
      }
    }

    const newCars = [...byId.values()];
    console.log(`Skriver ${newCars.length} biler til Firestore…`);
    await commitCarsInBatches(newCars);
    console.log(`Delta sync fullført. Oppdatert ${newCars.length} biler.`);

    // Record completion BEFORE analyzer (analyzer can take long and drop connection)
    await recordScanCompleted();
    await runAnalyzer();
  } catch (error) {
    console.error('Scraper error:', error);
  }
}

async function recordScanCompleted() {
  try {
    const updatedAt = new Date().toISOString();
    if (adminFirestore) {
      await adminFirestore.collection('scans').doc('latest').set(
        {
          scanTime: FieldValue.serverTimestamp(),
          completedAt: FieldValue.serverTimestamp(),
          updatedAt,
        },
        { merge: true },
      );
    } else {
      await setDoc(
        doc(db, 'scans', 'latest'),
        {
          scanTime: serverTimestamp(),
          completedAt: serverTimestamp(),
          updatedAt,
        },
        { merge: true },
      );
    }
  } catch (e) {
    console.error('Kunne ikke skrive scans/latest:', e);
  }
}

/**
 * Marker aktive biler som «archived» når `lastSeen` er eldre enn terskelen.
 * Scraperen kjører hver 2. time og oppdaterer lastSeen — manglende oppdatering
 * i X dager tyder på at annonsen er fjernet/solgt.
 * Konfigureres med ARCHIVE_STALE_DAYS (default 7).
 */
async function runWeeklyArchiveSync() {
  console.log('Starting Weekly Archive Sync...');
  if (!firestoreBackendReady()) {
    console.warn('Archive sync hoppet over: ingen Firestore-backend tilgjengelig.');
    return;
  }
  const staleDays = Math.max(1, parseInt(process.env.ARCHIVE_STALE_DAYS || '7', 10) || 7);
  const cutoffMs = Date.now() - staleDays * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();
  const nowIso = new Date().toISOString();

  try {
    type ArchiveCandidate = { id: string; lastSeen: unknown };
    const candidates: ArchiveCandidate[] = [];

    if (adminFirestore) {
      const snap = await adminFirestore
        .collection('cars')
        .where('status', '==', 'active')
        .select('lastSeen')
        .get();
      snap.docs.forEach(d => candidates.push({ id: d.id, lastSeen: d.data().lastSeen }));
    } else {
      const snap = await getDocs(query(collection(db, 'cars'), where('status', '==', 'active')));
      snap.docs.forEach(d => candidates.push({ id: d.id, lastSeen: d.data().lastSeen }));
    }

    const stale = candidates.filter(c => {
      if (typeof c.lastSeen !== 'string' || !c.lastSeen) return false;
      const t = Date.parse(c.lastSeen);
      return Number.isFinite(t) && t < cutoffMs;
    });

    console.log(
      `Archive sync: ${candidates.length} aktive biler, ${stale.length} ikke sett siden ${cutoffIso} (${staleDays} dager).`,
    );
    if (stale.length === 0) {
      console.log('Archive sync complete.');
      return;
    }

    const BATCH = 400;
    if (adminFirestore) {
      for (let i = 0; i < stale.length; i += BATCH) {
        const chunk = stale.slice(i, i + BATCH);
        const batch = adminFirestore.batch();
        for (const c of chunk) {
          batch.set(
            adminFirestore.collection('cars').doc(c.id),
            { status: 'archived', archivedAt: nowIso },
            { merge: true },
          );
        }
        await batch.commit();
        console.log(`Archive (Admin): batch ${Math.floor(i / BATCH) + 1} (${chunk.length} biler)`);
      }
    } else {
      for (let i = 0; i < stale.length; i += BATCH) {
        const chunk = stale.slice(i, i + BATCH);
        const batch = writeBatch(db);
        for (const c of chunk) {
          batch.set(
            doc(db, 'cars', c.id),
            { status: 'archived', archivedAt: nowIso },
            { merge: true },
          );
        }
        await batch.commit();
        console.log(`Archive: batch ${Math.floor(i / BATCH) + 1} (${chunk.length} biler)`);
      }
    }
    console.log(`Archive sync complete. ${stale.length} biler markert som archived.`);
  } catch (e) {
    console.error('Archive sync feilet:', e);
  }
}

async function runAnalyzer() {
  console.log('Starting Market Analyzer (Weighted)...');
  try {
    let cars: DocumentData[];
    if (adminFirestore) {
      const snap = await adminFirestore.collection('cars').where('isAuction', '==', false).get();
      cars = snap.docs.map(d => d.data());
    } else {
      const carsSnapshot = await getDocs(query(collection(db, 'cars'), where('isAuction', '==', false)));
      cars = carsSnapshot.docs.map(d => d.data());
    }
    
    // Group by model and year — year=0 betyr manglende data, hopp over for fairPrice
    const groups: Record<string, any[]> = {};
    cars.forEach(car => {
      if (!car.year || car.year === 0) return; // Ikke grupper biler uten årsdata
      const key = `${car.brand}_${car.model}_${car.year}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(car);
    });

    for (const [key, group] of Object.entries(groups)) {
      if (group.length < 3) continue; // Minst 3 biler for meningsfull statistikk
      
      // Sort by price to remove top/bottom 2% (simplified for prototype)
      group.sort((a, b) => a.price - b.price);
      
      // WEIGHTED AVERAGE CALCULATION
      // Archived (Sold) cars get weight 2, Active cars get weight 1
      let totalPrivatePrice = 0, totalPrivateWeight = 0;
      let totalDealerPrice = 0, totalDealerWeight = 0;

      group.forEach(c => {
        const weight = c.status === 'archived' ? 2 : 1;
        if (c.sellerType === 'privat') {
          totalPrivatePrice += c.price * weight;
          totalPrivateWeight += weight;
        } else {
          totalDealerPrice += c.price * weight;
          totalDealerWeight += weight;
        }
      });
      
      const avgPrivate = totalPrivateWeight > 0 ? totalPrivatePrice / totalPrivateWeight : 0;
      const avgDealer = totalDealerWeight > 0 ? totalDealerPrice / totalDealerWeight : 0;
      const mid = Math.floor(group.length / 2);
      const median = group.length % 2 === 1
        ? group[mid].price
        : (group[mid - 1].price + group[mid].price) / 2;
      const avgPrice =
        avgPrivate > 0 && avgDealer > 0
          ? (avgPrivate + avgDealer) / 2
          : avgPrivate > 0
            ? avgPrivate
            : avgDealer > 0
              ? avgDealer
              : median;

      const statPayload = {
        model: group[0].model,
        brand: group[0].brand,
        year: group[0].year,
        avgPricePrivate: avgPrivate,
        avgPriceDealer: avgDealer,
        avgPrice,
        medianPrice: median,
        sampleSize: group.length,
        calculatedAt: new Date().toISOString(),
      };
      if (adminFirestore) {
        await adminFirestore.collection('market_statistics').doc(key).set(statPayload);
      } else {
        await setDoc(doc(db, 'market_statistics', key), statPayload);
      }

      const confidence = Math.min(1, Math.max(0.2, group.length / 25));
      if (adminFirestore) {
        let carBatch = adminFirestore.batch();
        let carBatchOps = 0;
        for (const car of group.filter((c) => c.status === 'active')) {
          const fid = car.finnId ?? car.id;
          if (fid == null || fid === '') continue;
          carBatch.set(
            adminFirestore.collection('cars').doc(String(fid)),
            { fairPrice: median, confidence },
            { merge: true },
          );
          carBatchOps++;
          if (carBatchOps >= 400) {
            await carBatch.commit();
            carBatch = adminFirestore.batch();
            carBatchOps = 0;
          }
        }
        if (carBatchOps > 0) await carBatch.commit();
      } else {
        let carBatch = writeBatch(db);
        let carBatchOps = 0;
        for (const car of group.filter((c) => c.status === 'active')) {
          const fid = car.finnId ?? car.id;
          if (fid == null || fid === '') continue;
          carBatch.set(
            doc(db, 'cars', String(fid)),
            { fairPrice: median, confidence },
            { merge: true },
          );
          carBatchOps++;
          if (carBatchOps >= 400) {
            await carBatch.commit();
            carBatch = writeBatch(db);
            carBatchOps = 0;
          }
        }
        if (carBatchOps > 0) {
          await carBatch.commit();
        }
      }

      // Check for deals (Kupp) ONLY on active cars
      const threshold = 0.85; // 15% below median
      for (const car of group.filter(c => c.status === 'active')) {
        if (car.price < median * threshold) {
          console.log(`🚨 KUPP FUNNET! ${car.brand} ${car.model} (${car.year}) til ${car.price} kr! (Median: ${median} kr)`);
          
          const alertTo = process.env.ALERT_EMAIL?.trim();
          if (transporter && alertTo) {
            try {
              const km = car.mileage ?? car.km ?? 0;
              const info = await transporter.sendMail({
                from: '"Bruktbil Analytikeren" <varsel@bruktbil.no>',
                to: alertTo,
                subject: `🚨 KUPP: ${car.brand} ${car.model} til ${car.price.toLocaleString('no-NO')} kr!`,
                html: `
                  <h2>Kupp oppdaget på Finn.no!</h2>
                  <p>Vi har funnet en bil som ligger <b>${Math.round((1 - car.price / median) * 100)}% under</b> den vektede markedsmedianen.</p>
                  <ul>
                    <li><b>Bil:</b> ${car.brand} ${car.model} (${car.year})</li>
                    <li><b>Pris:</b> ${car.price.toLocaleString('no-NO')} kr</li>
                    <li><b>Medianpris i markedet:</b> ${Math.round(median).toLocaleString('no-NO')} kr</li>
                    <li><b>Kilometerstand:</b> ${Number(km).toLocaleString('no-NO')} km</li>
                    <li><b>EU-godkjent til:</b> ${car.euApprovedUntil ?? '—'}</li>
                  </ul>
                  <a href="https://www.finn.no/mobility/item/${car.finnId}" style="display:inline-block;padding:10px 20px;background:#0066ff;color:white;text-decoration:none;border-radius:5px;">Se annonsen på Finn.no</a>
                `,
              });
              console.log(`📧 E-post sendt! Se forhåndsvisning her: ${nodemailer.getTestMessageUrl(info)}`);
            } catch (emailErr) {
              console.error('Failed to send email:', emailErr);
            }
          }
        }
      }
    }
    console.log('Analyzer finished.');
  } catch (error) {
    console.error('Analyzer error:', error);
  }
}

const isScrapeCli =
  process.argv.includes('--scrape-only') || process.env.SCRAPE_ONCE === '1';

/** Én gang: `npm run scrape` eller `SCRAPE_ONCE=1 tsx server.ts` — auth + Finn → Firestore, deretter avslutt. */
async function runScrapeCliAndExit(): Promise<void> {
  const authOk = await authenticateBackend();
  if (!authOk) {
    console.error('Avbrutt: legg firebase-adminsdk.json i prosjektmappa, eller sett SCRAPER_EMAIL + SCRAPER_PASSWORD i .env.');
    process.exit(1);
  }
  await runScraper();
  console.log('✅ Scrape-kjøring ferdig.');
  process.exit(0);
}

if (!isScrapeCli) {
  // Schedule cron job every 2 hours for Delta Sync
  cron.schedule('0 */2 * * *', () => {
    runScraper();
  });

  // Schedule cron job every Sunday at 03:00 for Archive Sync
  cron.schedule('0 3 * * 0', () => {
    runWeeklyArchiveSync();
  });
}

async function startServer() {
  const authOk = await authenticateBackend();
  if (!authOk) {
    console.error(
      '⚠️ Server starter uten gyldig backend-auth — skanner lagrer ikke til Firestore før .env er satt.',
    );
  }
  const expressApp = express();
  const PORT = Number(process.env.PORT) || 3000;

  expressApp.use(express.json({ limit: '1mb' }));

  expressApp.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const triggerScraperHandler: express.RequestHandler = async (req, res) => {
    if (!scanRequestAuthorized(req)) {
      res.status(401).json({ error: 'Ugyldig eller manglende x-scan-secret.' });
      return;
    }
    try {
      await runScraper();
      res.json({ ok: true, status: 'Scraper triggered' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Scan feilet' });
    }
  };

  /** Frontend (VITE_SCANNER_URL) forventer POST /scan — samme som /api/trigger-scraper */
  expressApp.post('/scan', triggerScraperHandler);
  expressApp.post('/api/trigger-scraper', triggerScraperHandler);

  /**
   * Proxy for GitHub Actions workflow_dispatch. Holder GITHUB_TOKEN server-side
   * i stedet for å eksponere VITE_GITHUB_TOKEN i frontend-bundlen.
   * Krever samme x-scan-secret som /scan.
   */
  expressApp.post('/api/trigger-github-scrape', async (req, res) => {
    if (!scanRequestAuthorized(req)) {
      res.status(401).json({ error: 'Ugyldig eller manglende x-scan-secret.' });
      return;
    }
    const token = process.env.GITHUB_TOKEN?.trim();
    if (!token) {
      res.status(503).json({ error: 'GITHUB_TOKEN er ikke satt på serveren.' });
      return;
    }
    const repo = process.env.GITHUB_REPO?.trim() || 'pitjohnsen-stack/bilsnapper';
    const workflow = process.env.GITHUB_WORKFLOW_FILE?.trim() || 'scraper.yml';
    const ref = process.env.GITHUB_WORKFLOW_REF?.trim() || 'main';
    try {
      const ghRes = await fetch(
        `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'bilsnapper-server',
          },
          body: JSON.stringify({ ref }),
        },
      );
      if (!ghRes.ok) {
        const text = await ghRes.text();
        res.status(502).json({ error: `GitHub API ${ghRes.status}: ${text.slice(0, 300)}` });
        return;
      }
      res.json({ ok: true });
    } catch (e) {
      console.error('GitHub dispatch feilet:', e);
      res.status(500).json({ error: 'Kunne ikke kalle GitHub API.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    expressApp.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    expressApp.use(express.static(distPath));
    expressApp.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  expressApp.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    if (process.env.RUN_SCRAPER_ON_START !== 'false') {
      void runScraper();
    }
  });
}

if (isScrapeCli) {
  void runScrapeCliAndExit();
} else {
  void startServer();
}
