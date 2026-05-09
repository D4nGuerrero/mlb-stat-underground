import { useState, useEffect, useRef, useCallback } from 'react';

/** Convert any date string → "YYYYMMDD_HHmmss" (MLB timecode format) */
function formatTimecode(ts) {
  if (!ts) return null;
  if (/^\d{8}_\d{6}$/.test(ts)) return ts;
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return (
      `${d.getUTCFullYear()}` +
      `${pad(d.getUTCMonth() + 1)}` +
      `${pad(d.getUTCDate())}` +
      `_` +
      `${pad(d.getUTCHours())}` +
      `${pad(d.getUTCMinutes())}` +
      `${pad(d.getUTCSeconds())}`
    );
  } catch {
    return null;
  }
}

export function useMLBWebSocket(gamePk, gameState) {
  const [status, setStatus] = useState('disconnected');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const keepAliveRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const currentTimecodeRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  const isLiveGame = gameState === 'Live';

  const disconnect = useCallback(() => {
    console.log('[MLB WS] Disconnecting...');
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setStatus('disconnected');
    reconnectAttemptsRef.current = 0;
  }, []);

  const connect = useCallback(() => {
    if (!gamePk || !isLiveGame) {
      console.log('[MLB WS] Connect skipped - no gamePk or not live game');
      return;
    }

    disconnect();
    console.log(`[MLB WS] 🔌 Connecting to gamePk: ${gamePk}`);
    setStatus('connecting');
    setError(null);

    const wsUrl = `wss://ws.statsapi.mlb.com/api/v1/game/push/subscribe/${gamePk}`;
    console.log('[MLB WS] WS URL:', wsUrl);

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log(`[MLB WS] ✅ WebSocket OPEN for game ${gamePk}`);
      setStatus('connected');
      reconnectAttemptsRef.current = 0;

      keepAliveRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send('Gameday5');
          console.log('[MLB WS] 💓 Keep-alive "Gameday5" sent');
        }
      }, 60000);
    };

    wsRef.current.onmessage = async (event) => {
      const ts = new Date().toISOString();
      console.log(`[MLB WS] 🚀 [${ts}] WS Message received`);

      try {
        console.log('[MLB WS] Raw message length:', event.data.length + ' chars');
        const msg = JSON.parse(event.data);
        console.log('[MLB WS] Parsed msg:', msg);

        const { timeStamp, updateId } = msg;

        const startTc = currentTimecodeRef.current || formatTimecode(timeStamp);
        console.log('[MLB WS] Start timecode:', startTc || 'NONE - full fetch');

        if (!startTc) {
          console.log('[MLB WS] ⚠️ No timecode - signaling full refetch');
          setLastUpdate({ data: null, msg, timestamp: Date.now() });
          return;
        }

        let url = `https://ws.statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live/diffPatch?language=en&startTimecode=${startTc}`;
        if (updateId) url += `&pushUpdateId=${updateId}`;
        console.log('[MLB WS] Fetching diffPatch:', url);

        const res = await fetch(url);
        console.log('[MLB WS] diffPatch status:', res.status);

        if (res.status === 204) {
          console.log('[MLB WS] No changes (204)');
          return;
        }
        if (!res.ok) throw new Error(`diffPatch returned ${res.status}`);

        const data = await res.json();

        const nextTs =
          data?.metaData?.timeStamp ||
          data?.gameData?.metaData?.timeStamp ||
          timeStamp;
        const formatted = formatTimecode(nextTs);
        if (formatted) {
          currentTimecodeRef.current = formatted;
          console.log('[MLB WS] Updated timecode →', formatted);
        }

        console.log('[MLB WS] ✅ Full data received - top level keys:', Object.keys(data));

        const preview = {
          abstractState: data?.gameData?.status?.abstractGameState,
          detailedState: data?.gameData?.status?.detailedState,
          inning: data?.liveData?.linescore?.currentInning,
          isTopInning: data?.liveData?.linescore?.isTopInning,
          playCount: data?.liveData?.plays?.allPlays?.length ?? 0,
        };
        console.log('[MLB WS] Game state preview:', preview);

        setLastUpdate({ data, msg, timestamp: Date.now() });
      } catch (err) {
        console.error('[MLB WS] ❌ Error processing message:', err);
        setError(err.message);
      }
    };

    wsRef.current.onclose = (e) => {
      console.log(`[MLB WS] 🔴 WebSocket closed. Code: ${e.code}, Reason: ${e.reason || 'none'}`);
      setStatus('disconnected');
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
      if (isLiveGame && reconnectAttemptsRef.current < 5 && gamePk) {
        setStatus('reconnecting');
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 15000);
        reconnectAttemptsRef.current++;
        console.log(`[MLB WS] 🔄 Scheduling reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
        reconnectTimeoutRef.current = setTimeout(() => connect(), delay);
      }
    };

    wsRef.current.onerror = (e) => {
      console.log('[MLB WS] ❌ WebSocket error event:', e);
      setError('WebSocket connection error');
      wsRef.current?.close();
    };
  }, [gamePk, isLiveGame, disconnect]);

  useEffect(() => {
    if (gamePk && isLiveGame) {
      connect();
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [gamePk, isLiveGame, connect, disconnect]);

  return {
    status,
    lastUpdate,
    error,
    connect,
    disconnect,
    isConnected: status === 'connected',
  };
}