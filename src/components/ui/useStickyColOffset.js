import { useEffect } from 'react';

export const STICKY_COL_1_ATTR = 'data-sticky-col-1';

/** Spread onto the 1st pinned column cells (year, date, etc.) */
export function stickyCol1Props() {
  return { [STICKY_COL_1_ATTR]: '' };
}

/**
 * Measures the widest 1st pinned column cell and sets --sticky-col-1-width on the table
 * so the 2nd pinned column (team) can use left-[var(--sticky-col-1-width)].
 */
export function useStickyColOffset(tableRef, deps = []) {
  useEffect(() => {
    const table = tableRef.current;
    if (!table) return;

    const measure = () => {
      const cells = table.querySelectorAll(`[${STICKY_COL_1_ATTR}]`);
      let max = 0;
      cells.forEach((el) => {
        max = Math.max(max, el.getBoundingClientRect().width);
      });
      if (max > 0) {
        table.style.setProperty('--sticky-col-1-width bg-red-500', `${max}px`);
      }
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(table);
    table.querySelectorAll(`[${STICKY_COL_1_ATTR}]`).forEach((el) => ro.observe(el));

    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}