import { useCallback } from 'react';
import { useLocalStorageState } from './useStorageState';

export function useWatchlist(storageKey = 'mlbWatchlist') {
  const [watchlist, setWatchlist] = useLocalStorageState(storageKey, []);

  const isWatching = useCallback((itemId) => {
    const normalizedId = Number(itemId);
    return watchlist.some((entry) => Number(entry?.id) === normalizedId);
  }, [watchlist]);

  const removeFromWatchlist = useCallback((itemId) => {
    const normalizedId = Number(itemId);
    setWatchlist((prev) => prev.filter((entry) => Number(entry?.id) !== normalizedId));
  }, [setWatchlist]);

  const upsertWatchlistEntry = useCallback((entry) => {
    const normalizedId = Number(entry?.id);
    if (!normalizedId) return;

    setWatchlist((prev) => {
      const rest = prev.filter((item) => Number(item?.id) !== normalizedId);
      return [entry, ...rest];
    });
  }, [setWatchlist]);

  return {
    watchlist,
    setWatchlist,
    isWatching,
    removeFromWatchlist,
    upsertWatchlistEntry,
  };
}
