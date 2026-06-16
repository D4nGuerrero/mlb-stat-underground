import { useCallback } from 'react';
import { useLocalStorageState } from './useStorageState';

const FAVORITE_TEAMS_KEY = 'mlbFavoriteTeams';

export function useFavoriteTeams() {
  const [favoriteTeams, setFavoriteTeams] = useLocalStorageState(FAVORITE_TEAMS_KEY, []);

  const toggleFavoriteTeam = useCallback((teamId) => {
    const normalizedId = Number(teamId);
    if (!normalizedId) return;

    setFavoriteTeams((prev) => (
      prev.includes(normalizedId)
        ? prev.filter((id) => id !== normalizedId)
        : [normalizedId, ...prev]
    ));
  }, [setFavoriteTeams]);

  const isFavoriteTeam = useCallback((teamId) => {
    const normalizedId = Number(teamId);
    return favoriteTeams.includes(normalizedId);
  }, [favoriteTeams]);

  return {
    favoriteTeams,
    setFavoriteTeams,
    toggleFavoriteTeam,
    isFavoriteTeam,
  };
}
