import { useEffect, useState } from 'react';
import { resolvePostseasonEventLogo, sportsLogosEventSrc } from '../utils/postseasonLogos';

export function usePostseasonEventLogo(series, year) {
  const [src, setSrc] = useState(() => sportsLogosEventSrc(series, year, { darkOnly: true }));

  useEffect(() => {
    const darkSrc = sportsLogosEventSrc(series, year, { darkOnly: true });
    if (darkSrc) {
      setSrc(darkSrc);
      return undefined;
    }
    if (!series || !year) {
      setSrc(null);
      return undefined;
    }

    const controller = new AbortController();
    let active = true;
    setSrc(null);

    resolvePostseasonEventLogo(series, year, controller.signal)
      .then((next) => {
        if (active) setSrc(next);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        if (active) setSrc(null);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [series, year, series?.gameType, series?.league, series?.id]);

  return src;
}
