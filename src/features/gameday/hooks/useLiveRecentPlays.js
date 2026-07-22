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

function pitchEventIndexFromKey(rowKey) {
  const match = String(rowKey || '').match(/^live-pitch-(\d+)-(\d+)$/);
  return match ? Number(match[2]) : null;
}

function rowAtBatIndexFromKey(rowKey) {
  const match = String(rowKey || '').match(
    /^(?:live-pitch|pickoff-attempt|pickoff|mound|offensive-sub|defensive-sub|pitching|status|action|automatic-pitch|batter-timeout)-(\d+)-/,
  );
  if (match) return Number(match[1]);
  const compactMatch = String(rowKey || '').match(/^(?:atbat|score|runners)-(\d+)$/);
  return compactMatch ? Number(compactMatch[1]) : null;
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
  const resumeRevealUntilRef = useRef(0);
  const pitchRevealFallbackTimerRef = useRef(null);
  const hiddenPitchFirstSeenRef = useRef(new Map());
  const [revealedPitchRowKeys, setRevealedPitchRowKeys] = useState(() => new Set());

  const revealPitchRows = useCallback((rowKeys) => {
    if (!rowKeys?.length) return;
    setRevealedPitchRowKeys((prev) => {
      let changed = false;
      const next = new Set(prev);
      rowKeys.forEach((key) => {
        if (!next.has(key)) {
          next.add(key);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    const currentPitchRows = liveRecentRows.filter((row) => row.kind === 'live_pitch');
    const pitchRowKeys = currentPitchRows.map((row) => row.key);
    const currentPitchAtBatIndex = pitchAtBatIndexFromKey(currentPitchRows[0]?.key);
    if (currentPitchRows.length) {
      retainedAtBatPitchRowsRef.current = {
        atBatIndex: currentPitchAtBatIndex,
        rows: new Map(currentPitchRows.map((row) => [row.key, row])),
      };
    } else {
      const retained = retainedAtBatPitchRowsRef.current;
      if (
        retained.atBatIndex != null &&
        retained.rows.size &&
        liveRecentRows.some((row) => row.key === `atbat-${retained.atBatIndex}`)
      ) {
        revealPitchRows([...retained.rows.keys()]);
      }
    }

    if (knownPitchRowKeysRef.current == null) {
      knownPitchRowKeysRef.current = new Set(pitchRowKeys);
      setRevealedPitchRowKeys(new Set(pitchRowKeys));
      return;
    }

    const previousKnown = knownPitchRowKeysRef.current;
    knownPitchRowKeysRef.current = new Set(pitchRowKeys);
    setRevealedPitchRowKeys((prev) => {
      if (Date.now() < resumeRevealUntilRef.current && pitchRowKeys.length) {
        return new Set([...prev, ...pitchRowKeys]);
      }

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
  }, [liveRecentRows, revealPitchRows]);

  useEffect(() => {
    if (!isLive) {
      hiddenPitchFirstSeenRef.current.clear();
      return undefined;
    }

    const hiddenPitchRows = liveRecentRows
      .filter((row) => row.kind === 'live_pitch' && !revealedPitchRowKeys.has(row.key));
    const hiddenPitchRowKeys = hiddenPitchRows.map((row) => row.key);

    const now = Date.now();
    const visiblePitchKeys = new Set(
      liveRecentRows
        .filter((row) => row.kind === 'live_pitch')
        .map((row) => row.key),
    );
    hiddenPitchFirstSeenRef.current.forEach((_, key) => {
      if (!visiblePitchKeys.has(key) || revealedPitchRowKeys.has(key)) {
        hiddenPitchFirstSeenRef.current.delete(key);
      }
    });
    hiddenPitchRowKeys.forEach((key) => {
      if (!hiddenPitchFirstSeenRef.current.has(key)) {
        hiddenPitchFirstSeenRef.current.set(key, now);
      }
    });

    if (!hiddenPitchRowKeys.length) return undefined;

    const forcedRevealKeys = hiddenPitchRows
      .filter((row) => {
        const atBatIndex = rowAtBatIndexFromKey(row.key);
        if (atBatIndex == null) return false;
        const rowTime = row.sortTime ? new Date(row.sortTime).getTime() : 0;
        return liveRecentRows.some((other) => {
          if (other.kind === 'live_pitch') return false;
          if (rowAtBatIndexFromKey(other.key) !== atBatIndex) return false;
          const otherTime = other.sortTime ? new Date(other.sortTime).getTime() : 0;
          return otherTime >= rowTime;
        });
      })
      .map((row) => row.key);
    if (forcedRevealKeys.length) {
      revealPitchRows(forcedRevealKeys);
      forcedRevealKeys.forEach((key) => hiddenPitchFirstSeenRef.current.delete(key));
      return undefined;
    }

    // The preferred path is canvas landing -> toast exit -> reveal row. MLB
    // sometimes hydrates/batches pitch events though, so the canvas can render
    // a settled pitch without firing a fresh landing callback. This fallback
    // keeps the pitch sequence from getting permanently stuck hidden.
    const fallbackMs = 3200;
    const readyKeys = hiddenPitchRowKeys.filter((key) => (
      now - (hiddenPitchFirstSeenRef.current.get(key) ?? now) >= fallbackMs
    ));
    if (readyKeys.length) {
      revealPitchRows(readyKeys);
      readyKeys.forEach((key) => hiddenPitchFirstSeenRef.current.delete(key));
      return undefined;
    }

    const nextDelay = Math.max(
      0,
      Math.min(
        ...hiddenPitchRowKeys.map((key) => (
          fallbackMs - (now - (hiddenPitchFirstSeenRef.current.get(key) ?? now))
        )),
      ),
    );
    pitchRevealFallbackTimerRef.current = window.setTimeout(() => {
      const fireNow = Date.now();
      const keysToReveal = hiddenPitchRowKeys.filter((key) => (
        fireNow - (hiddenPitchFirstSeenRef.current.get(key) ?? fireNow) >= fallbackMs
      ));
      revealPitchRows(keysToReveal);
      keysToReveal.forEach((key) => hiddenPitchFirstSeenRef.current.delete(key));
      pitchRevealFallbackTimerRef.current = null;
    }, nextDelay);

    return () => {
      if (pitchRevealFallbackTimerRef.current) {
        window.clearTimeout(pitchRevealFallbackTimerRef.current);
        pitchRevealFallbackTimerRef.current = null;
      }
    };
  }, [isLive, liveRecentRows, revealedPitchRowKeys, revealPitchRows]);

  useEffect(() => {
    if (!isLive) return undefined;

    const revealCurrentPitchRowsAfterResume = () => {
      resumeRevealUntilRef.current = Date.now() + 10_000;
      const rowKeys = liveRecentRows
        .filter((row) => row.kind === 'live_pitch')
        .map((row) => row.key);
      revealPitchRows(rowKeys);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') revealCurrentPitchRowsAfterResume();
    };

    const onPageShow = () => revealCurrentPitchRowsAfterResume();

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', revealCurrentPitchRowsAfterResume);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', revealCurrentPitchRowsAfterResume);
    };
  }, [isLive, liveRecentRows, revealPitchRows]);

  const revealLiveRecentRow = useCallback((rowKey) => {
    if (!rowKey) return;
    const atBatIndex = pitchAtBatIndexFromKey(rowKey);
    const eventIndex = pitchEventIndexFromKey(rowKey);
    const rowKeysToReveal =
      atBatIndex != null && eventIndex != null
        ? liveRecentRows
            .filter((row) => {
              if (row.kind !== 'live_pitch') return false;
              if (pitchAtBatIndexFromKey(row.key) !== atBatIndex) return false;
              const rowEventIndex = pitchEventIndexFromKey(row.key);
              return rowEventIndex != null && rowEventIndex <= eventIndex;
            })
            .map((row) => row.key)
        : [rowKey];

    setRevealedPitchRowKeys((prev) => {
      if (rowKeysToReveal.every((key) => prev.has(key))) return prev;
      const next = new Set(prev);
      rowKeysToReveal.forEach((key) => next.add(key));
      return next;
    });
  }, [liveRecentRows]);

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
