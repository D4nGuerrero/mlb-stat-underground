import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildLiveRecentPlaysFeed,
  dueUpFromOffense,
  groupLiveRecentRows,
} from '../../../utils/liveRecentPlays';
import { isValidLiveFeed } from '../../../utils/liveFeedMerge';

export function useLiveRecentPlays({ feed, ordinals, isLive, linescore }) {
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
  const knownPitchRowKeysRef = useRef(null);
  const [revealedPitchRowKeys, setRevealedPitchRowKeys] = useState(() => new Set());

  useEffect(() => {
    const pitchRowKeys = liveRecentRows
      .filter((row) => row.kind === 'live_pitch')
      .map((row) => row.key);

    if (knownPitchRowKeysRef.current == null) {
      knownPitchRowKeysRef.current = new Set(pitchRowKeys);
      setRevealedPitchRowKeys(new Set(pitchRowKeys));
      return;
    }

    knownPitchRowKeysRef.current = new Set(pitchRowKeys);
    setRevealedPitchRowKeys((prev) => {
      const next = new Set();
      pitchRowKeys.forEach((key) => {
        if (prev.has(key)) next.add(key);
      });
      return next;
    });
  }, [liveRecentRows]);

  const revealLiveRecentRow = useCallback((rowKey) => {
    if (!rowKey) return;
    setRevealedPitchRowKeys((prev) => {
      if (prev.has(rowKey)) return prev;
      const next = new Set(prev);
      next.add(rowKey);
      return next;
    });
  }, []);

  const visibleLiveRecentRows = useMemo(
    () =>
      liveRecentRows.filter((row) => (
        row.kind !== 'live_pitch' || revealedPitchRowKeys.has(row.key)
      )),
    [liveRecentRows, revealedPitchRowKeys],
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
    liveRecentRows: visibleLiveRecentRows,
    revealLiveRecentRow,
    showDueUpMatchup,
  };
}
