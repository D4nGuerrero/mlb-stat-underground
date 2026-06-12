import { useState, useEffect, useRef, useCallback } from 'react';
import { compareTimecodes } from '../utils/liveFeedMerge';

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

export function useMLBWebSocket(gamePk, gameState, initialTimecode) {
  const [status, setStatus] = useState('disconnected');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const keepAliveRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const currentTimecodeRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const messageQueueRef = useRef([]);
  const processingRef = useRef(false);

  const isLiveGame = gameState === 'Live';

  useEffect(() => {
    const tc = formatTimecode(initialTimecode);
    if (tc) currentTimecodeRef.current = tc;
  }, [initialTimecode, gamePk]);

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
    messageQueueRef.current = [];
    processingRef.current = false;
    setStatus('disconnected');
    reconnectAttemptsRef.current = 0;
  }, []);

  const connect = useCallback(() => {
    if (!gamePk || !isLiveGame) return;

    disconnect();
    setStatus('connecting');
    setError(null);

    const wsUrl = `wss://ws.statsapi.mlb.com/api/v1/game/push/subscribe/${gamePk}`;
    wsRef.current = new WebSocket(wsUrl);

    const processMessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { timeStamp, updateId } = msg;

        const startTc = currentTimecodeRef.current || formatTimecode(timeStamp);
        if (!startTc) {
          setLastUpdate({ data: null, msg, timestamp: Date.now() });
          return;
        }

        let url = `https://ws.statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live/diffPatch?language=en&startTimecode=${startTc}`;
        if (updateId) url += `&pushUpdateId=${updateId}`;

        const res = await fetch(url);
        if (res.status === 204) return;
        if (!res.ok) throw new Error(`diffPatch returned ${res.status}`);

        const data = await res.json();

        const nextTs =
          data?.metaData?.timeStamp ||
          data?.gameData?.metaData?.timeStamp ||
          timeStamp;
        const formatted = formatTimecode(nextTs);

        if (
          formatted &&
          currentTimecodeRef.current &&
          compareTimecodes(formatted, currentTimecodeRef.current) < 0
        ) {
          return;
        }

        if (formatted) {
          currentTimecodeRef.current = formatted;
        }

        setLastUpdate({ data, timecode: formatted, msg, timestamp: Date.now() });
      } catch (err) {
        console.error('[MLB WS] Error processing message:', err);
        setError(err.message);
      }
    };

    const drainQueue = async () => {
      if (processingRef.current) return;
      processingRef.current = true;
      try {
        while (messageQueueRef.current.length > 0) {
          const event = messageQueueRef.current.shift();
          await processMessage(event);
        }
      } finally {
        processingRef.current = false;
      }
    };

    wsRef.current.onopen = () => {
      setStatus('connected');
      reconnectAttemptsRef.current = 0;

      keepAliveRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send('Gameday5');
        }
      }, 60000);
    };

    wsRef.current.onmessage = (event) => {
      messageQueueRef.current.push(event);
      drainQueue();
    };

    wsRef.current.onclose = (e) => {
      setStatus('disconnected');
      if (keepAliveRef.current) {
        clearInterval(keepAliveRef.current);
        keepAliveRef.current = null;
      }
      if (isLiveGame && reconnectAttemptsRef.current < 5 && gamePk) {
        setStatus('reconnecting');
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 15000);
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => connect(), delay);
      }
    };

    wsRef.current.onerror = () => {
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