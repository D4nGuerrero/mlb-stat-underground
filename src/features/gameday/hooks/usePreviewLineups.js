import { useEffect, useState } from 'react';
import { fetchGameLineups, lineupsAvailable } from '../../../utils/gameLineups';

export function usePreviewLineups(gamePk, gameState) {
  const [previewLineups, setPreviewLineups] = useState(null);
  const [previewLineupsLoading, setPreviewLineupsLoading] = useState(false);
  const isPreview = Boolean(gamePk) && gameState === 'Preview';

  useEffect(() => {
    if (!isPreview) return undefined;

    let cancelled = false;

    const loadLineups = () => {
      setPreviewLineupsLoading(true);
      return fetchGameLineups(gamePk)
        .then((data) => {
          if (!cancelled) setPreviewLineups(data);
          return data;
        })
        .catch(() => {
          if (!cancelled) setPreviewLineups(null);
          return null;
        })
        .finally(() => {
          if (!cancelled) setPreviewLineupsLoading(false);
        });
    };

    loadLineups();
    const interval = setInterval(() => {
      if (cancelled) return;
      loadLineups().then((data) => {
        if (lineupsAvailable(data)) clearInterval(interval);
      });
    }, 90_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [gamePk, isPreview]);

  return {
    previewLineups: isPreview ? previewLineups : null,
    previewLineupsLoading: isPreview ? previewLineupsLoading : false,
  };
}
