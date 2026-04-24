import { Timestamp } from 'firebase/firestore';

/**
 * Normalise the wildly inconsistent scan-timestamp shapes Firestore returns
 * (Timestamp instance, raw `{seconds}` object, ISO string, epoch ms).
 *
 * Returns a Norwegian-locale string or `null` if the value is unparseable.
 */
export function formatScanTime(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Timestamp) return value.toDate().toLocaleString('no-NO');
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const s = (value as { seconds: number }).seconds;
    if (typeof s === 'number') return new Date(s * 1000).toLocaleString('no-NO');
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString('no-NO');
  }
  return null;
}

export function formatKr(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('no-NO')} kr`;
}
