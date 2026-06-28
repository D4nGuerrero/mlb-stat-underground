import { useEffect, useRef, useState } from 'react';
import { compareTimecodes } from '../utils/liveFeedMerge';

function formatTimecode(ts) {
  if (!ts) return null;
  if (/^\d{8}_\d{6}$/.test(ts)) return ts;

  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return (
      `${d.getUTCFullYear()}` +
      `${pad(d.getUTCMonth() + 1)}` +
      `${pad(d.getUTCDate())}` +
      '_' +
      `${pad(d.getUTCHours())}` +
      `${pad(d.getUTCMinutes())}` +
      `${pad(d.getUTCSeconds())}`
    );
  } catch {
    return null;
  }
}

export function useMLBWebSocket(gamePk, gameState, initialTimecode, reconnectKey = 0) {
  const [status, setStatus] = useState('disconnected');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);

  const currentTimecodeRef = useRef(null);

  useEffect(() => {
    const tc = formatTimecode(initialTimecode);
    if (tc) currentTimecodeRef.current = tc;
  }, [initialTimecode, gamePk]);

  useEffect(() => {
    if (!gamePk || gameState !== 'Live') return undefined;

    let ws = null;
    let keepAliveId = null;
    let reconnectTimeoutId = null;
    let reconnectAttempts = 0;
    let closed = false;
    const messageQueue = [];
    let processing = false;

    const cleanup = () => {
      closed = true;
      if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
      if (keepAliveId) clearInterval(keepAliveId);
      if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.close();
        ws = null;
      }
      setStatus('disconnected');
    };

    const processMessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { timeStamp, updateId } = msg;

        const startTc = currentTimecodeRef.current || formatTimecode(timeStamp);
        const endTc = formatTimecode(timeStamp);
        if (!startTc) {
          setLastUpdate({ data: null, msg, timestamp: Date.now() });
          return;
        }

        if (msg.changeEvent?.type === 'full_refresh') {
          if (endTc) currentTimecodeRef.current = endTc;
          setLastUpdate({ data: null, timecode: endTc, msg, timestamp: Date.now() });
          return;
        }

        let url = `https://ws.statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live/diffPatch?language=en&startTimecode=${startTc}`;
        if (endTc && compareTimecodes(endTc, startTc) > 0) url += `&endTimecode=${endTc}`;
        if (updateId) url += `&pushUpdateId=${updateId}`;

        const res = await fetch(url);
        if (res.status === 204 || closed) return;
        if (!res.ok) throw new Error(`diffPatch returned ${res.status}`);

        const data = await res.json();
        const hasPatchData = Boolean(
          data?.gameData ||
          data?.liveData ||
          data?.metaData ||
          (data && Object.keys(data).length > 0),
        );

        if (!hasPatchData) {
          setLastUpdate({ data: null, timecode: endTc, msg, timestamp: Date.now() });
          return;
        }

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

        if (formatted) currentTimecodeRef.current = formatted;
        setLastUpdate({ data, timecode: formatted, msg, timestamp: Date.now() });
      } catch (err) {
        if (!closed) {
          console.error('[MLB WS] Error processing message:', err);
          setError(err.message);
        }
      }
    };

    const drainQueue = async () => {
      if (processing || closed) return;
      processing = true;
      try {
        while (messageQueue.length > 0 && !closed) {
          const event = messageQueue.shift();
          await processMessage(event);
        }
      } finally {
        processing = false;
      }
    };

    const openSocket = () => {
      if (closed) return;

      setStatus(reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
      setError(null);

      ws = new WebSocket(`wss://ws.statsapi.mlb.com/api/v1/game/push/subscribe/${gamePk}`);

      ws.onopen = () => {
        if (closed) return;
        setStatus('connected');
        reconnectAttempts = 0;
        keepAliveId = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send('Gameday5');
          }
        }, 60_000);
      };

      ws.onmessage = (event) => {
        messageQueue.push(event);
        void drainQueue();
      };

      ws.onerror = () => {
        if (!closed) setError('WebSocket connection error');
        ws?.close();
      };

      ws.onclose = () => {
        if (keepAliveId) {
          clearInterval(keepAliveId);
          keepAliveId = null;
        }
        if (closed) return;

        setStatus('disconnected');
        if (reconnectAttempts >= 5) return;

        const delay = Math.min(1000 * 2 ** reconnectAttempts, 15_000);
        reconnectAttempts += 1;
        reconnectTimeoutId = setTimeout(openSocket, delay);
      };
    };

    openSocket();
    return cleanup;
  }, [gamePk, gameState, reconnectKey]);

  return {
    status,
    lastUpdate,
    error,
    isConnected: status === 'connected',
  };
}
