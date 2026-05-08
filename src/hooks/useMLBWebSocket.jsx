import { useState, useEffect, useRef, useCallback } from 'react';

export function useMLBWebSocket(gamePk, gameState) {
  const [status, setStatus] = useState('disconnected'); // disconnected | connecting | connected | reconnecting
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const keepAliveRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const currentTimecodeRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  // Only connect for live games
  const isLiveGame = gameState === 'Live';

  const disconnect = useCallback(() => {
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
    if (!gamePk || !isLiveGame) return;

    disconnect();
    setStatus('connecting');
    setError(null);

    const wsUrl = `wss://ws.statsapi.mlb.com/api/v1/game/push/subscribe/gameday/${gamePk}`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log(`[WS] Connected to game ${gamePk}`);
      setStatus('connected');
      reconnectAttemptsRef.current = 0;

      // Start keep-alive every 60 seconds
      keepAliveRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send('Gameday5');
        }
      }, 60000);
    };

    wsRef.current.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { timeStamp, updateId } = msg;

        const startTc = currentTimecodeRef.current || timeStamp;
        const diffUrl = `https://ws.statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live/diffPatch?language=en&startTimecode=${startTc}&pushUpdateId=${updateId}`;

        const res = await fetch(diffUrl);
        if (!res.ok) throw new Error(`diffPatch failed: ${res.status}`);

        const data = await res.json();

        // Update timecode for next request
        if (data?.metaData?.timeStamp) {
          currentTimecodeRef.current = data.metaData.timeStamp;
        } else if (data?.gameData?.metaData?.timeStamp) {
          currentTimecodeRef.current = data.gameData.metaData.timeStamp;
        } else {
          currentTimecodeRef.current = timeStamp;
        }

        setLastUpdate({
          data,
          msg,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error('[WS] diffPatch error:', err);
        setError(err.message);
      }
    };

    wsRef.current.onclose = () => {
      console.log('[WS] Connection closed');
      setStatus('disconnected');

      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }

      // Only auto-reconnect for live games, with exponential backoff (max 5 attempts)
      if (isLiveGame && reconnectAttemptsRef.current < 5 && gamePk) {
        setStatus('reconnecting');
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttemptsRef.current),
          15000,
        );
        reconnectAttemptsRef.current++;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };

    wsRef.current.onerror = (err) => {
      console.error('[WS] Error:', err);
      setError('WebSocket connection error');
      wsRef.current?.close();
    };
  }, [gamePk, isLiveGame, disconnect]);

  // Connect when gamePk changes, but only for live games
  useEffect(() => {
    if (gamePk && isLiveGame) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
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
