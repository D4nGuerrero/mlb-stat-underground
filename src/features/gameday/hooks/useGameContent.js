import { useEffect, useRef, useState } from 'react';
import { fetchGameContent } from '../../../utils/gameContent';

export function useGameContent(gamePk, scoringCount) {
  const [gameContent, setGameContent] = useState(null);
  const scoringPlaysCountRef = useRef(-1);

  useEffect(() => {
    if (!gamePk) return undefined;

    let cancelled = false;
    fetchGameContent(gamePk)
      .then((content) => {
        if (!cancelled) setGameContent(content);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [gamePk]);

  useEffect(() => {
    if (!gamePk || scoringCount == null) return;
    if (scoringCount === scoringPlaysCountRef.current) return;

    scoringPlaysCountRef.current = scoringCount;
    let cancelled = false;
    fetchGameContent(gamePk)
      .then((content) => {
        if (!cancelled) setGameContent(content);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [gamePk, scoringCount]);

  return { gameContent, setGameContent };
}
