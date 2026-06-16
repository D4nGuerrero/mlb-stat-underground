import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function PwaUpdateToast() {
  const [dismissed, setDismissed] = useState(false);
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (dismissed || (!offlineReady && !needRefresh)) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[90] w-[min(92vw,460px)] -translate-x-1/2 rounded-2xl border border-amber-400/30 bg-slate-950/92 px-4 py-3 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
          <i className={`fa-solid ${needRefresh ? 'fa-rotate' : 'fa-wifi'} text-sm`} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white">
            {needRefresh ? 'Update ready' : 'Offline ready'}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-300">
            {needRefresh
              ? 'A new version is available. Refresh so you do not get stale cached pages after deploys.'
              : 'This app is cached for quicker reloads when your connection gets spotty.'}
          </p>
          <div className="mt-3 flex gap-2">
            {needRefresh && (
              <button
                type="button"
                onClick={() => updateServiceWorker(true)}
                className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-300"
              >
                Refresh now
              </button>
            )}
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-500"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
