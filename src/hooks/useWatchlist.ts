import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Per-user watchlist persisted to `users/{uid}/watchlist/{finnId}`.
 *
 * We keep the *set of ids* in React state (cheap membership checks) and
 * expose toggle/remove; the actual car doc is still read from `cars`.
 */
export function useWatchlist(userId: string): {
  watchedIds: Set<string>;
  isWatched: (finnId: string) => boolean;
  toggleWatch: (finnId: string, payload?: Record<string, unknown>) => Promise<void>;
} {
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    const ref = collection(db, 'users', userId, 'watchlist');
    return onSnapshot(ref, (snap) => {
      setWatchedIds(new Set(snap.docs.map((d) => d.id)));
    });
  }, [userId]);

  const isWatched = useCallback((finnId: string) => watchedIds.has(finnId), [watchedIds]);

  const toggleWatch = useCallback(
    async (finnId: string, payload: Record<string, unknown> = {}) => {
      if (!userId || !finnId) return;
      const ref = doc(db, 'users', userId, 'watchlist', finnId);
      if (watchedIds.has(finnId)) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, { ...payload, addedAt: serverTimestamp() }, { merge: true });
      }
    },
    [userId, watchedIds],
  );

  return { watchedIds, isWatched, toggleWatch };
}
