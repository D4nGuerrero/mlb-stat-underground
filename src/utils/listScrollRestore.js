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

    let attempts = 0;
    const restore = () => {
      window.scrollTo(0, y);
      attempts += 1;
      if (attempts >= 12 || Math.abs(window.scrollY - y) <= 2) return;
      window.setTimeout(restore, 75);
    };

    requestAnimationFrame(restore);
  } catch {
    /* ignore */
  }
}
