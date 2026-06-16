import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildLiveRecentPlaysFeed,
  dueUpFromOffense,
  groupLiveRecentRows,
} from '../../../utils/liveRecentPlays';
import { isValidLiveFeed } from '../../../utils/liveFeedMerge';

export function useLiveRecentPlays({ feed, ordinals, isLive, linescore }) {
  const liveRecentSeenKeysRef = useRef(null);
  const liveRecentRevealTimersRef = useRef(new Map());
  const [liveRecentSeenKeys, setLiveRecentSeenKeys] = useState(() => new Set());
  const [deferredLiveRecentKeys, setDeferredLiveRecentKeys] = useState(() => new Set());

  const liveRecentFeed = useMemo(() => {
    if (!feed || !isValidLiveFeed(feed)) {
      return { displayRows: [], firstPitch: null };
    }

    const gameData = feed.gameData;
    const liveData = feed.liveData;

    return buildLiveRecentPlaysFeed({
      allPlays: liveData?.plays?.allPlays || [],
      gameData,
      boxscore: liveData?.boxscore,
      linescore: liveData?.linescore,
      currentPlay: liveData?.plays?.currentPlay,
      isLive: gameData?.status?.abstractGameState === 'Live',
      ordinals,
    });
  }, [feed, ordinals]);

  const liveRecentRows = liveRecentFeed.displayRows;
  const liveFirstPitch = liveRecentFeed.firstPitch;

  const revealLiveRecentRow = useCallback((rowKey) => {
    if (!rowKey) return;

    const timer = liveRecentRevealTimersRef.current.get(rowKey);
    if (timer) {
      clearTimeout(timer);
      liveRecentRevealTimersRef.current.delete(rowKey);
    }

    setDeferredLiveRecentKeys((prev) => {
      if (!prev.has(rowKey)) return prev;
      const next = new Set(prev);
      next.delete(rowKey);
      return next;
    });
  }, []);

  useEffect(() => {
    const keys = liveRecentRows.map((row) => row.key);
    if (liveRecentSeenKeysRef.current == null) {
      liveRecentSeenKeysRef.current = new Set(keys);
      return undefined;
    }

    const previous = liveRecentSeenKeysRef.current;
    const newlyAddedRows = liveRecentRows.filter(
      (row) => !previous.has(row.key) && row.kind === 'live_pitch',
    );
    const nextSeen = new Set(keys);
    liveRecentSeenKeysRef.current = nextSeen;
    setLiveRecentSeenKeys(nextSeen);
    if (!newlyAddedRows.length) return undefined;

    setDeferredLiveRecentKeys((prev) => {
      const next = new Set(prev);
      newlyAddedRows.forEach((row) => next.add(row.key));
      return next;
    });

    newlyAddedRows.forEach((row) => {
      if (liveRecentRevealTimersRef.current.has(row.key)) return;
      const timer = setTimeout(() => {
        liveRecentRevealTimersRef.current.delete(row.key);
        revealLiveRecentRow(row.key);
      }, 5000);
      liveRecentRevealTimersRef.current.set(row.key, timer);
    });

    return undefined;
  }, [liveRecentRows, revealLiveRecentRow]);

  useEffect(
    () => () => {
      liveRecentRevealTimersRef.current.forEach((timer) => clearTimeout(timer));
      liveRecentRevealTimersRef.current.clear();
    },
    [],
  );

  const visibleLiveRecentRows = useMemo(
    () =>
      liveRecentRows.filter((row) => {
        if (deferredLiveRecentKeys.has(row.key)) return false;
        if (
          liveRecentSeenKeys.size > 0 &&
          row.kind === 'live_pitch' &&
          !liveRecentSeenKeys.has(row.key)
        ) {
          return false;
        }
        return true;
      }),
    [deferredLiveRecentKeys, liveRecentRows, liveRecentSeenKeys],
  );

  const liveRecentGroups = useMemo(
    () =>
      groupLiveRecentRows(visibleLiveRecentRows, {
        isLive,
        currentInning: linescore?.currentInning,
        currentHalf: linescore?.inningHalf === 'Top' ? 'top' : 'bottom',
      }),
    [visibleLiveRecentRows, isLive, linescore?.currentInning, linescore?.inningHalf],
  );

  const isBetweenHalfInnings =
    linescore?.inningState === 'Middle' || linescore?.inningState === 'End';
  const dueUpBatters = isLive && isBetweenHalfInnings ? dueUpFromOffense(linescore?.offense) : [];
  const showDueUpMatchup = dueUpBatters.length > 0;
  const dueUpInning =
    linescore?.inningState === 'End'
      ? (linescore?.currentInning ?? 0) + 1
      : linescore?.currentInning;
  const dueUpInningOrdinal = ordinals[dueUpInning] || dueUpInning;
  const dueUpHalfLabel = linescore?.inningState === 'End' ? 'Top' : 'Bottom';

  return {
    dueUpBatters,
    dueUpHalfLabel,
    dueUpInningOrdinal,
    liveFirstPitch,
    liveRecentGroups,
    liveRecentRows,
    revealLiveRecentRow,
    showDueUpMatchup,
  };
}
