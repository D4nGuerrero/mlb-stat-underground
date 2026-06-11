const SCROLL_PREFIX = 'list-scroll:';

export function saveListScroll(key) {
  try {
    sessionStorage.setItem(`${SCROLL_PREFIX}${key}`, String(window.scrollY));
  } catch {
    /* ignore quota / private mode */
  }
}

export function restoreListScroll(key) {
  try {
    const raw = sessionStorage.getItem(`${SCROLL_PREFIX}${key}`);
    if (raw == null) return;
    sessionStorage.removeItem(`${SCROLL_PREFIX}${key}`);
    const y = parseInt(raw, 10);
    if (Number.isNaN(y)) return;
    requestAnimationFrame(() => window.scrollTo(0, y));
  } catch {
    /* ignore */
  }
}