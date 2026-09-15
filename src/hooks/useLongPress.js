import { useCallback, useRef } from 'react';

const DEFAULT_MS = 480;
const DEFAULT_MOVE_PX = 10;

/**
 * Long-press / right-click handlers for a clickable target.
 * Short tap still fires the element's normal click handler.
 * After a long-press, the following click is swallowed.
 */
export function useLongPress({
  onClick,
  onLongPress,
  ms = DEFAULT_MS,
  moveThreshold = DEFAULT_MOVE_PX,
  enabled = true,
} = {}) {
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const suppressClickRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const fire = useCallback(() => {
    if (!enabled || !onLongPress) return;
    suppressClickRef.current = true;
    onLongPress();
  }, [enabled, onLongPress]);

  const onPointerDown = useCallback((event) => {
    if (!enabled || !onLongPress) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    suppressClickRef.current = false;
    startRef.current = { x: event.clientX, y: event.clientY };
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      fire();
    }, ms);
  }, [clearTimer, enabled, fire, ms, onLongPress]);

  const onPointerMove = useCallback((event) => {
    if (!startRef.current || timerRef.current == null) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    if (Math.hypot(dx, dy) > moveThreshold) clearTimer();
  }, [clearTimer, moveThreshold]);

  const onPointerUp = useCallback(() => {
    clearTimer();
    startRef.current = null;
  }, [clearTimer]);

  const onPointerCancel = useCallback(() => {
    clearTimer();
    startRef.current = null;
  }, [clearTimer]);

  const handleClick = useCallback((event) => {
    if (suppressClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
      return;
    }
    onClick?.(event);
  }, [onClick]);

  const onContextMenu = useCallback((event) => {
    if (!enabled || !onLongPress) return;
    event.preventDefault();
    clearTimer();
    fire();
  }, [clearTimer, enabled, fire, onLongPress]);

  if (!enabled || !onLongPress) {
    return onClick ? { onClick } : {};
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onClick: handleClick,
    onContextMenu,
    style: {
      touchAction: 'manipulation',
      WebkitTouchCallout: 'none',
      WebkitUserSelect: 'none',
      userSelect: 'none',
    },
  };
}
