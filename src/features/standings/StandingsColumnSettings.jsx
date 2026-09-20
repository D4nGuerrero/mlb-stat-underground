import { useEffect, useRef, useState } from 'react';
import { GripVertical, RotateCcw, Settings } from 'lucide-react';
import { BottomSheetModal } from '../../components/ui';
import {
  DEFAULT_STANDINGS_COLUMN_PREFS,
  STANDINGS_COLUMN_CATALOG,
  moveColumnKey,
  normalizeStandingsColumnPrefs,
} from './standingsColumns';

function Toggle({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      className={[
        'relative h-6 w-10 flex-shrink-0 rounded-full transition-colors',
        disabled ? 'cursor-not-allowed opacity-50' : '',
        checked ? 'bg-accent-500' : 'bg-slate-700',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
          checked ? 'left-[1.15rem]' : 'left-0.5',
        ].join(' ')}
      />
    </button>
  );
}

export default function StandingsColumnSettings({ open, onClose, prefs, onChange }) {
  const normalized = normalizeStandingsColumnPrefs(prefs);
  const visibleSet = new Set(normalized.visible);
  const listRef = useRef(null);
  const draggingKeyRef = useRef(null);
  const prefsRef = useRef(normalized);
  const [draggingKey, setDraggingKey] = useState(null);
  const [overKey, setOverKey] = useState(null);

  useEffect(() => {
    prefsRef.current = normalized;
  }, [normalized]);

  const catalogByKey = Object.fromEntries(STANDINGS_COLUMN_CATALOG.map((col) => [col.key, col]));

  const setPrefs = (next) => onChange(normalizeStandingsColumnPrefs(next));

  const toggleVisible = (key, nextVisible) => {
    const col = catalogByKey[key];
    if (col?.required) return;
    const visible = new Set(normalized.visible);
    if (nextVisible) visible.add(key);
    else visible.delete(key);
    setPrefs({ order: normalized.order, visible: [...visible] });
  };

  const handlePointerDown = (key, event) => {
    event.preventDefault();
    draggingKeyRef.current = key;
    setDraggingKey(key);
    setOverKey(key);
    try {
      listRef.current?.setPointerCapture(event.pointerId);
    } catch {
      // Capture is best-effort; move/up still fire on the list while the pointer is down.
    }
  };

  const handlePointerMove = (event) => {
    const dragKey = draggingKeyRef.current;
    if (!dragKey || !listRef.current) return;
    const y = event.clientY;
    const rows = [...listRef.current.querySelectorAll('[data-col-key]')];
    let nextOver = dragKey;
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) {
        nextOver = row.dataset.colKey;
        break;
      }
    }
    setOverKey(nextOver);
    if (!nextOver || nextOver === dragKey) return;
    const current = prefsRef.current;
    const nextOrder = moveColumnKey(current.order, dragKey, nextOver);
    if (nextOrder.join() === current.order.join()) return;
    setPrefs({ order: nextOrder, visible: current.visible });
  };

  const handlePointerUp = (event) => {
    if (listRef.current?.hasPointerCapture?.(event.pointerId)) {
      listRef.current.releasePointerCapture(event.pointerId);
    }
    draggingKeyRef.current = null;
    setDraggingKey(null);
    setOverKey(null);
  };

  return (
    <BottomSheetModal
      open={open}
      onClose={onClose}
      historyKey="standingsColumns"
      title="Standings columns"
    >
      <div className="p-4 sm:p-5 space-y-4">
        <p className="text-xs text-slate-400">
          Choose which stats appear on the Standings tab, then drag to reorder. Team is always shown.
        </p>

        <div
          ref={listRef}
          className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {normalized.order.map((key) => {
            const col = catalogByKey[key];
            if (!col) return null;
            const checked = visibleSet.has(key);
            const isDragging = draggingKey === key;
            const isOver = overKey === key && draggingKey && overKey !== draggingKey;
            return (
              <div
                key={key}
                data-col-key={key}
                className={[
                  'flex items-center gap-2 px-2 py-2.5 sm:px-3',
                  isDragging ? 'bg-slate-800/80' : 'bg-transparent',
                  isOver ? 'shadow-[inset_0_2px_0_0_rgb(var(--accent-400))]' : '',
                ].join(' ')}
              >
                <button
                  type="button"
                  aria-label={`Reorder ${col.name}`}
                  className="flex h-9 w-8 flex-shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-slate-500 active:cursor-grabbing hover:text-slate-300"
                  onPointerDown={(event) => handlePointerDown(key, event)}
                >
                  <GripVertical size={16} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white">{col.label}</div>
                  <div className="text-[11px] text-slate-500">{col.name}</div>
                </div>
                <Toggle
                  checked={checked}
                  disabled={Boolean(col.required)}
                  label={`${checked ? 'Hide' : 'Show'} ${col.name}`}
                  onChange={(next) => toggleVisible(key, next)}
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => setPrefs(DEFAULT_STANDINGS_COLUMN_PREFS)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white"
          >
            <RotateCcw size={13} />
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent-500/15 px-3 py-2 text-xs font-semibold text-accent-200 hover:bg-accent-500/25"
          >
            <Settings size={13} />
            Done
          </button>
        </div>
      </div>
    </BottomSheetModal>
  );
}
