import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildLiveRecentPlaysFeed,
  dueUpFromOffense,
  groupLiveRecentRows,
} from '../../../utils/liveRecentPlays';
import { isValidLiveFeed } from '../../../utils/liveFeedMerge';

function pitchAtBatIndexFromKey(rowKey) {
  const match = String(rowKey || '').match(/^live-pitch-(\d+)-/);
  return match ? Number(match[1]) : null;
}

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
  const retainedAtBatPitchRowsRef = useRef({ atBatIndex: null, rows: new Map() });
  const [revealedPitchRowKeys, setRevealedPitchRowKeys] = useState(() => new Set());

  useEffect(() => {
    const currentPitchRows = liveRecentRows.filter((row) => row.kind === 'live_pitch');
    const pitchRowKeys = currentPitchRows.map((row) => row.key);
    const currentPitchAtBatIndex = pitchAtBatIndexFromKey(currentPitchRows[0]?.key);
    if (currentPitchRows.length) {
      retainedAtBatPitchRowsRef.current = {
        atBatIndex: currentPitchAtBatIndex,
        rows: new Map(currentPitchRows.map((row) => [row.key, row])),
      };
    }

    if (knownPitchRowKeysRef.current == null) {
      knownPitchRowKeysRef.current = new Set(pitchRowKeys);
      setRevealedPitchRowKeys(new Set(pitchRowKeys));
      return;
    }

    const previousKnown = knownPitchRowKeysRef.current;
    knownPitchRowKeysRef.current = new Set(pitchRowKeys);
    setRevealedPitchRowKeys((prev) => {
      // Page refresh / first live-feed hydration: if we previously had no known
      // live pitch rows and no revealed rows, show the current pitch list
      // immediately. These rows already existed before this browser session, so
      // they should not wait on a toast handoff that already happened.
      if (!previousKnown.size && !prev.size && pitchRowKeys.length) {
        return new Set(pitchRowKeys);
      }

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
    () => {
      const currentPitchRows = liveRecentRows.filter((row) => row.kind === 'live_pitch');
      const currentPitchAtBatIndex = pitchAtBatIndexFromKey(currentPitchRows[0]?.key);
      const currentRowKeySet = new Set(liveRecentRows.map((row) => row.key));
      const retained = retainedAtBatPitchRowsRef.current;

      const rows = liveRecentRows.filter((row) => (
        row.kind !== 'live_pitch' || revealedPitchRowKeys.has(row.key)
      ));

      // If MLB advances currentPlay before the final toast finishes, keep the
      // just-finished at-bat pitch rows available long enough for the handoff
      // to complete. Once a new at-bat actually has its own pitch row, the
      // retained rows naturally drop away.
      if (
        retained.atBatIndex != null &&
        currentPitchAtBatIndex == null &&
        liveRecentRows.some((row) => row.key === `atbat-${retained.atBatIndex}`)
      ) {
        retained.rows.forEach((row, rowKey) => {
          if (!revealedPitchRowKeys.has(rowKey) || currentRowKeySet.has(rowKey)) return;
          rows.push(row);
        });
      }

      rows.sort((a, b) => {
        const ta = a.sortTime ? new Date(a.sortTime).getTime() : 0;
        const tb = b.sortTime ? new Date(b.sortTime).getTime() : 0;
        return tb - ta;
      });
      return rows;
    },
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
