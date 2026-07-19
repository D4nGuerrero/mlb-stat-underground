import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { SegmentedControl } from '../../../components/ui';
import { playerHeadshotUrl } from '../../../utils/mlbHelpers';
import {
  formatUpdatedScore,
  getSummaryPlayIconKind,
} from '../../../utils/gamePlaySummary';
import {
  copyHighlightLink,
  getHighlightShareUrl,
  getHighlightVideoUrl,
  shareHighlightVideo,
} from '../../../utils/gameContent';

function getFullscreenElement() {
  if (typeof document === 'undefined') return null;
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement ||
    null
  );
}

async function requestElementFullscreen(el) {
  if (!el) return false;
  const req =
    el.requestFullscreen?.bind(el) ||
    el.webkitRequestFullscreen?.bind(el) ||
    el.msRequestFullscreen?.bind(el);
  if (!req) return false;
  try {
    await req();
    return true;
  } catch {
    return false;
  }
}

async function exitDocumentFullscreen() {
  if (typeof document === 'undefined' || !getFullscreenElement()) return;
  const exit =
    document.exitFullscreen?.bind(document) ||
    document.webkitExitFullscreen?.bind(document) ||
    document.msExitFullscreen?.bind(document);
  try {
    await exit?.();
  } catch {
    // ignore
  }
}

function currentScrollY() {
  if (typeof window === 'undefined') return 0;
  return window.scrollY || document.documentElement?.scrollTop || document.body?.scrollTop || 0;
}

function restoreScrollY(y) {
  if (typeof window === 'undefined') return;
  const top = Math.max(0, Number(y) || 0);
  const restore = () => window.scrollTo({ top, left: 0, behavior: 'auto' });
  restore();
  window.requestAnimationFrame(() => {
    restore();
    window.requestAnimationFrame(restore);
  });
  window.setTimeout(restore, 80);
}

/** Prefer landscape lock only on phone-sized / coarse-pointer viewports. */
function shouldLockLandscapeOnFullscreen() {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.matchMedia('(max-width: 900px)').matches ||
      window.matchMedia('(pointer: coarse) and (max-width: 1200px)').matches
    );
  } catch {
    return false;
  }
}

async function lockLandscapeOrientation() {
  if (typeof screen === 'undefined') return false;

  try {
    const orientation = screen.orientation;
    if (orientation?.lock) {
      await orientation.lock('landscape');
      return true;
    }
  } catch {
    // Not allowed outside fullscreen / unsupported type / user gesture expired.
  }

  // Legacy prefixes (older Android WebViews).
  try {
    const legacy =
      screen.lockOrientation?.bind(screen) ||
      screen.mozLockOrientation?.bind(screen) ||
      screen.msLockOrientation?.bind(screen);
    if (legacy) return Boolean(legacy('landscape'));
  } catch {
    // ignore
  }

  return false;
}

function unlockOrientation() {
  if (typeof screen === 'undefined') return;

  try {
    screen.orientation?.unlock?.();
  } catch {
    // ignore
  }

  try {
    screen.unlockOrientation?.();
    screen.mozUnlockOrientation?.();
    screen.msUnlockOrientation?.();
  } catch {
    // ignore
  }
}

function SummaryPlayAvatar({ item, onPlayerClick }) {
  const iconKind = getSummaryPlayIconKind(item);
  const sizeClass = 'w-16 h-16';
  const iconSize = 'text-xl';
  const iconShellClass = `${sizeClass} rounded-full bg-slate-800/80 border-2 border-slate-600 flex items-center justify-center flex-shrink-0`;
  const advisoryIcons = {
    field_delay: 'fa-person-digging',
    weather_delay: 'fa-cloud-showers-heavy',
    postponed: 'fa-ban',
    medical: 'fa-kit-medical',
    warning: 'fa-triangle-exclamation',
    delay: 'fa-clock',
    advisory: 'fa-circle-info',
  };
  const advisoryColors = {
    field_delay: 'text-lime-300',
    weather_delay: 'text-amber-400',
    postponed: 'text-red-400',
    medical: 'text-rose-300',
    warning: 'text-yellow-300',
    delay: 'text-orange-300',
    advisory: 'text-sky-300',
  };

  if (iconKind === 'baseball') {
    return (
      <div
        className={iconShellClass}
        aria-hidden
      >
        <i className={`fa-solid fa-baseball ${iconSize} text-orange-400`} />
      </div>
    );
  }

  if (advisoryIcons[iconKind]) {
    return (
      <div
        className={iconShellClass}
        aria-hidden
      >
        <i className={`fa-solid ${advisoryIcons[iconKind]} ${iconSize} ${advisoryColors[iconKind]}`} />
      </div>
    );
  }

  if (iconKind === 'pitching_sub') {
    return (
      <div
        className={iconShellClass}
        aria-hidden
      >
        <i className={`fa-solid fa-right-left ${iconSize} text-sky-400`} />
      </div>
    );
  }

  if (iconKind === 'shoe') {
    return (
      <div
        className={iconShellClass}
        aria-hidden
      >
        <i className={`fa-solid fa-shoe-prints ${iconSize} text-blue-400 -rotate-12`} />
      </div>
    );
  }

  if (iconKind === 'pitch') {
    return (
      <div
        className={iconShellClass}
        aria-hidden
      >
        <i className={`fa-solid fa-baseball ${iconSize} text-orange-400`} />
      </div>
    );
  }

  if (!item.batterId) {
    return (
      <div
        className={`${sizeClass} rounded-full bg-slate-800/80 border-2 border-slate-600 flex-shrink-0`}
        aria-hidden
      />
    );
  }

  return (
    <button type="button" onClick={onPlayerClick} className="flex-shrink-0 mt-0.5">
      <img src={playerHeadshotUrl(item.batterId, 2)} className={`${sizeClass} object-cover`} alt="" />
    </button>
  );
}

function SummaryFirstPitchRow({ item }) {
  return (
    <div className="flex items-start gap-2.5 p-2">
      <SummaryPlayAvatar item={item} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="font-semibold text-slate-100 text-base">{item.title}</div>
        <div className="text-slate-400 font-mono text-sm">{item.timeLine}</div>
        <div className="text-slate-500 text-sm">{item.venueLine}</div>
      </div>
    </div>
  );
}

function SummaryStatusChangeRow({ item, badge }) {
  return (
    <div className="flex items-start gap-2.5 p-2">
      <SummaryPlayAvatar item={item} />
      <div className="min-w-0 flex-1">
        <span className={`inline-block text-[14px] px-2 py-0.5 rounded-full border font-semibold mb-1 ${badge.cls}`}>
          {badge.label}
        </span>
        <p className="text-md text-slate-200 leading-snug">{item.description}</p>
        {item.timeLine && (
          <p className="text-slate-500 font-mono mt-0.5 text-xs">{item.timeLine}</p>
        )}
      </div>
    </div>
  );
}

function SummarySubstitutionRow({ item, badge }) {
  return (
    <div className="flex items-start gap-2.5 p-2">
      <SummaryPlayAvatar item={item} />
      <div className="min-w-0 flex-1">
        <span className={`inline-block text-[14px] px-2 py-0.5 rounded-full border font-semibold mb-1 ${badge.cls}`}>
          {badge.label}
        </span>
        <p className="text-md text-slate-200 leading-snug">{item.description}</p>
      </div>
    </div>
  );
}

function formatVideoTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function VideoShareMenu({ video, className = 'relative', buttonClassName }) {
  const videoUrl = getHighlightVideoUrl(video);
  const pageUrl = getHighlightShareUrl(video);
  const canNativeShare = typeof navigator !== 'undefined' && Boolean(navigator.share);
  const downloadName = `${(video?.headline || video?.id || 'mlb-highlight')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'mlb-highlight'}.mp4`;

  const handleNativeShare = async (e, close) => {
    e.preventDefault();
    e.stopPropagation();
    close?.();
    await shareHighlightVideo(video);
  };

  const handleCopy = (e, close) => {
    e.preventDefault();
    e.stopPropagation();
    close?.();
    if (videoUrl) copyHighlightLink(video);
  };

  const handleDownload = async (e, close) => {
    e.preventDefault();
    e.stopPropagation();
    close?.();
    if (!videoUrl || typeof document === 'undefined') return;

    try {
      const res = await fetch(videoUrl);
      if (!res.ok) return;

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = downloadName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Cross-origin video hosts may block blob downloads. Don't open a new tab.
    }
  };

  if (!videoUrl && !pageUrl && !canNativeShare) return null;

  const btnClass =
    buttonClassName ||
    'gameday-highlight-ctrl-btn';

  return (
    <Menu as="div" className={className}>
      <MenuButton
        type="button"
        onClick={(e) => e.stopPropagation()}
        className={btnClass}
        aria-label="Video options"
      >
        <i className="fa-solid fa-ellipsis-vertical text-sm" aria-hidden />
      </MenuButton>

      <MenuItems
        anchor="top end"
        transition
        className="z-[2147483646] mt-1 min-w-[10.5rem] rounded-xl bg-slate-900 border border-slate-700 py-1 shadow-xl focus:outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
      >
        {canNativeShare && (
          <MenuItem>
            {({ focus, close }) => (
              <button
                type="button"
                onClick={(e) => handleNativeShare(e, close)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${focus ? 'bg-slate-800 text-white' : 'text-slate-300'}`}
              >
                <i className="fa-solid fa-share-nodes text-xs w-4 text-center" aria-hidden />
                Share...
              </button>
            )}
          </MenuItem>
        )}
        {videoUrl && (
          <MenuItem>
            {({ focus, close }) => (
              <button
                type="button"
                onClick={(e) => handleCopy(e, close)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${focus ? 'bg-slate-800 text-white' : 'text-slate-300'}`}
              >
                <i className="fa-solid fa-link text-xs w-4 text-center" aria-hidden />
                Copy link
              </button>
            )}
          </MenuItem>
        )}
        {videoUrl && (
          <MenuItem>
            {({ focus, close }) => (
              <button
                type="button"
                onClick={(e) => handleDownload(e, close)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${focus ? 'bg-slate-800 text-white' : 'text-slate-300'}`}
              >
                <i className="fa-solid fa-download text-xs w-4 text-center" aria-hidden />
                Download video
              </button>
            )}
          </MenuItem>
        )}
        {pageUrl && (
          <MenuItem>
            {({ focus }) => (
              <a
                href={pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`block px-3 py-2 text-sm flex items-center gap-2 ${focus ? 'bg-slate-800 text-white' : 'text-slate-300'}`}
              >
                <i className="fa-solid fa-arrow-up-right-from-square text-xs w-4 text-center" aria-hidden />
                Open on {video?.provider || 'MLB.com'}
              </a>
            )}
          </MenuItem>
        )}
      </MenuItems>
    </Menu>
  );
}

function HighlightVideoControls({
  video,
  videoRef,
  isFullscreen,
  onToggleFullscreen,
  forceVisible = false,
}) {
  const [paused, setPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [hovering, setHovering] = useState(false);
  const hideTimerRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;

    const sync = () => {
      setPaused(el.paused);
      setCurrentTime(el.currentTime || 0);
      setDuration(Number.isFinite(el.duration) ? el.duration : 0);
      setMuted(el.muted);
      setVolume(el.volume);
    };

    const onTime = () => setCurrentTime(el.currentTime || 0);
    const onMeta = () => {
      setDuration(Number.isFinite(el.duration) ? el.duration : 0);
      sync();
    };

    sync();
    el.addEventListener('play', sync);
    el.addEventListener('pause', sync);
    el.addEventListener('ended', sync);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('durationchange', onMeta);
    el.addEventListener('volumechange', sync);
    return () => {
      el.removeEventListener('play', sync);
      el.removeEventListener('pause', sync);
      el.removeEventListener('ended', sync);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('durationchange', onMeta);
      el.removeEventListener('volumechange', sync);
    };
  }, [videoRef, isFullscreen]);

  useEffect(() => () => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
  }, []);

  const bumpActivity = useCallback(() => {
    setHovering(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (paused) return;
    hideTimerRef.current = window.setTimeout(() => setHovering(false), 2200);
  }, [paused]);

  const togglePlay = useCallback((e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
    bumpActivity();
  }, [videoRef, bumpActivity]);

  const toggleMute = useCallback((e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    if (!el.muted && el.volume === 0) el.volume = 0.6;
    bumpActivity();
  }, [videoRef, bumpActivity]);

  const onSeek = useCallback((e) => {
    const el = videoRef.current;
    if (!el) return;
    const next = Number(e.target.value);
    if (!Number.isFinite(next)) return;
    el.currentTime = next;
    setCurrentTime(next);
    bumpActivity();
  }, [videoRef, bumpActivity]);

  const onVolume = useCallback((e) => {
    const el = videoRef.current;
    if (!el) return;
    const next = Number(e.target.value);
    if (!Number.isFinite(next)) return;
    el.volume = next;
    el.muted = next === 0;
    setVolume(next);
    setMuted(next === 0);
    bumpActivity();
  }, [videoRef, bumpActivity]);

  const visible = forceVisible || hovering || paused;
  const progress = duration > 0 ? Math.min(currentTime, duration) : 0;

  return (
    <div
      className={`gameday-highlight-controls ${visible ? 'is-visible' : ''}`}
      onMouseEnter={() => {
        setHovering(true);
        if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      }}
      onMouseLeave={() => {
        if (paused) return;
        hideTimerRef.current = window.setTimeout(() => setHovering(false), 600);
      }}
      onMouseMove={bumpActivity}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <input
        type="range"
        className="gameday-highlight-seek"
        min={0}
        max={duration > 0 ? duration : 0}
        step={0.05}
        value={progress}
        onChange={onSeek}
        aria-label="Seek"
      />
      <div className="gameday-highlight-controls-row">
        <button type="button" className="gameday-highlight-ctrl-btn" onClick={togglePlay} aria-label={paused ? 'Play' : 'Pause'}>
          <i className={`fa-solid ${paused ? 'fa-play' : 'fa-pause'}`} aria-hidden />
        </button>
        <span className="gameday-highlight-time tabular-nums">
          {formatVideoTime(currentTime)}
          <span className="text-white/45"> / {formatVideoTime(duration)}</span>
        </span>
        <div className="flex-1" />
        <button type="button" className="gameday-highlight-ctrl-btn" onClick={toggleMute} aria-label={muted || volume === 0 ? 'Unmute' : 'Mute'}>
          <i
            className={`fa-solid ${muted || volume === 0 ? 'fa-volume-xmark' : volume < 0.45 ? 'fa-volume-low' : 'fa-volume-high'}`}
            aria-hidden
          />
        </button>
        <input
          type="range"
          className="gameday-highlight-volume"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={onVolume}
          aria-label="Volume"
        />
        <VideoShareMenu video={video} />
        <button
          type="button"
          className="gameday-highlight-ctrl-btn"
          onClick={onToggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`} aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function ScoringPlayVideo({ video, isExpanded, onToggle }) {
  const videoRef = useRef(null);
  const overlayRootRef = useRef(null);
  const playOnExpandRef = useRef(false);
  const resumeRef = useRef(null);
  const clickTimerRef = useRef(null);
  const fullscreenScrollYRef = useRef(0);
  const wasOverlayFullscreenRef = useRef(false);
  const [overlayFs, setOverlayFs] = useState(false);
  const src = video?.mp4Url || video?.hlsUrl;
  const externalUrl = !src ? getHighlightShareUrl(video) : null;

  const capturePlayback = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    resumeRef.current = {
      time: el.currentTime || 0,
      paused: el.paused,
      rate: el.playbackRate || 1,
      muted: el.muted,
      volume: el.volume,
    };
  }, []);

  const restorePlayback = useCallback(() => {
    const el = videoRef.current;
    const resume = resumeRef.current;
    if (!el || !resume) return;
    try {
      if (Math.abs((el.currentTime || 0) - resume.time) > 0.15) {
        el.currentTime = resume.time;
      }
      el.playbackRate = resume.rate || 1;
      if (typeof resume.volume === 'number') el.volume = resume.volume;
      if (typeof resume.muted === 'boolean') el.muted = resume.muted;
    } catch {
      // ignore seek errors
    }
    if (!resume.paused) el.play().catch(() => {});
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (isExpanded && playOnExpandRef.current && el) {
      el.play().catch(() => {});
      playOnExpandRef.current = false;
    }
  }, [isExpanded]);

  // If the scoring-play row collapses, drop fullscreen state (render-time adjust).
  if (!isExpanded && overlayFs) {
    setOverlayFs(false);
  }

  const showOverlayFs = Boolean(isExpanded && overlayFs);

  /**
   * Highlight videos live inside Gameday's nested overflow/scroll layout.
   * Custom controls + a body portal shell avoid native <video> fullscreen bugs
   * (especially from a half-snapped desktop window).
   * On mobile, lock landscape while fullscreen and unlock on exit.
   */
  useLayoutEffect(() => {
    if (!showOverlayFs) return undefined;

    wasOverlayFullscreenRef.current = true;
    restorePlayback();

    const overlayRoot = overlayRootRef.current;
    let cancelled = false;
    let didLockOrientation = false;

    const applyMobileLandscape = async () => {
      if (cancelled || !shouldLockLandscapeOnFullscreen()) return;
      const locked = await lockLandscapeOrientation();
      if (cancelled) return;
      didLockOrientation = locked;
      // iOS / some mobile browsers refuse orientation.lock without native FS.
      // Force a CSS landscape layout so the video is still watchable sideways.
      if (!locked && overlayRoot) {
        overlayRoot.classList.add('is-forced-landscape');
      }
    };

    if (overlayRoot) {
      requestElementFullscreen(overlayRoot).then(async (ok) => {
        if (cancelled) return;
        // Orientation lock generally requires an active fullscreen element.
        await applyMobileLandscape();
        if (!ok) {
          // CSS fixed overlay still covers the viewport without the Fullscreen API.
        }
      });
    } else {
      applyMobileLandscape();
    }

    const onFsChange = () => {
      if (cancelled) return;
      // User left native fullscreen (Esc / browser UI) — tear down portal.
      if (!getFullscreenElement()) {
        capturePlayback();
        setOverlayFs(false);
      }
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        capturePlayback();
        setOverlayFs(false);
      }
    };

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      cancelled = true;
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      overlayRoot?.classList.remove('is-forced-landscape');
      if (didLockOrientation || shouldLockLandscapeOnFullscreen()) {
        unlockOrientation();
      }
      if (getFullscreenElement()) exitDocumentFullscreen();
    };
  }, [showOverlayFs, restorePlayback, capturePlayback]);

  // After leaving overlay, restore time/play on the inline player.
  useLayoutEffect(() => {
    if (showOverlayFs || !isExpanded) return;
    restorePlayback();
    if (wasOverlayFullscreenRef.current) {
      wasOverlayFullscreenRef.current = false;
      restoreScrollY(fullscreenScrollYRef.current);
    }
  }, [showOverlayFs, isExpanded, restorePlayback]);

  const enterOverlayFullscreen = useCallback((e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    fullscreenScrollYRef.current = currentScrollY();
    capturePlayback();
    setOverlayFs(true);
  }, [capturePlayback]);

  const exitOverlayFullscreen = useCallback((e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    capturePlayback();
    setOverlayFs(false);
    restoreScrollY(fullscreenScrollYRef.current);
  }, [capturePlayback]);

  const toggleOverlayFullscreen = useCallback((e) => {
    if (showOverlayFs) exitOverlayFullscreen(e);
    else enterOverlayFullscreen(e);
  }, [showOverlayFs, enterOverlayFullscreen, exitOverlayFullscreen]);

  const handleExpand = () => {
    playOnExpandRef.current = true;
    onToggle();
  };

  const togglePlayFromVideo = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }, []);

  const handleVideoClick = useCallback((e) => {
    e?.stopPropagation?.();
    // Delay single-click play/pause so double-click can take fullscreen instead.
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      togglePlayFromVideo();
    }, 200);
  }, [togglePlayFromVideo]);

  const handleVideoDoubleClick = useCallback((e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    toggleOverlayFullscreen(e);
  }, [toggleOverlayFullscreen]);

  useEffect(() => () => {
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
  }, []);

  if (!video?.thumbnail && !src && !externalUrl) return null;

  if (externalUrl) {
    return (
      <div className="mt-3 max-w-md" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className="relative rounded-xl overflow-hidden border border-slate-700/60 bg-slate-950">
          <div className="absolute top-2 right-2 z-20">
            <VideoShareMenu
              video={video}
              buttonClassName="w-8 h-8 rounded-full bg-black/55 hover:bg-black/70 backdrop-blur border border-white/20 flex items-center justify-center text-white transition-colors"
            />
          </div>
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex aspect-video flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-900 via-slate-950 to-red-950/50 px-5 text-center transition-colors hover:from-slate-800 hover:to-red-900/60"
            aria-label={video.headline || 'Open video fallback'}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-950/40 transition-transform group-hover:scale-105">
              <i className="fa-brands fa-youtube text-2xl" aria-hidden />
            </span>
            <span className="text-sm font-black uppercase tracking-[0.22em] text-red-100">
              YouTube fallback
            </span>
            <span className="max-w-xs text-xs leading-snug text-slate-300">
              MLB archive video was not available. Search YouTube for this scoring play.
            </span>
          </a>
        </div>
      </div>
    );
  }

  const playerShell = (
    <div
      ref={showOverlayFs ? overlayRootRef : undefined}
      className={
        showOverlayFs
          ? 'gameday-highlight-fs-shell'
          : 'gameday-highlight-player relative w-full overflow-hidden rounded-xl bg-black'
      }
    >
      <video
        key={video.id ?? src}
        ref={videoRef}
        playsInline
        poster={video.thumbnail}
        className={
          showOverlayFs
            ? 'gameday-highlight-video gameday-highlight-video--overlay'
            : 'gameday-highlight-video w-full aspect-video bg-black'
        }
        src={src}
        onClick={handleVideoClick}
        onDoubleClick={handleVideoDoubleClick}
      >
        <track kind="captions" />
      </video>
      <HighlightVideoControls
        video={video}
        videoRef={videoRef}
        isFullscreen={showOverlayFs}
        onToggleFullscreen={toggleOverlayFullscreen}
        forceVisible={!showOverlayFs}
      />
    </div>
  );

  const overlayPortal =
    showOverlayFs &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        className="gameday-highlight-fs-portal"
        role="dialog"
        aria-modal="true"
        aria-label={video.headline || 'Highlight video fullscreen'}
      >
        {playerShell}
      </div>,
      document.body
    );

  return (
    <div className="mt-3 max-w-md" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {isExpanded && src ? (
        <div className="relative rounded-xl border border-slate-700/60 bg-black">
          <div className="gameday-highlight-home-slot relative">
            {showOverlayFs ? (
              <div className="aspect-video w-full rounded-xl bg-black" aria-hidden />
            ) : (
              playerShell
            )}
          </div>
          {video.headline && !showOverlayFs && (
            <div className="px-3 py-2 text-xs text-slate-400 border-t border-slate-800 rounded-b-xl">
              {video.headline}
            </div>
          )}
        </div>
      ) : (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-700/60">
          <div className="absolute top-2 right-2 z-20">
            <VideoShareMenu
              video={video}
              buttonClassName="w-8 h-8 rounded-full bg-black/55 hover:bg-black/70 backdrop-blur border border-white/20 flex items-center justify-center text-white transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={handleExpand}
            className="relative w-full h-full group"
            aria-label={video.headline ? `Play video: ${video.headline}` : 'Play highlight video'}
          >
            {video.thumbnail && (
              <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-colors group-hover:bg-black/50">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center border border-white/30">
                <i className="fa-solid fa-play text-white text-lg ml-0.5" aria-hidden />
              </div>
            </div>
          </button>
        </div>
      )}
      {overlayPortal}
    </div>
  );
}

function SummaryPlayItemRow({
  awayAbbr,
  expandedVideoKey,
  getPlayBadge,
  highlightByItemKey,
  homeAbbr,
  item,
  onOpenPlay,
  onPlayerClick,
  onToggleVideo,
  pinnedVideo,
  statusChangeBadge,
}) {
  if (item.kind === 'status_change') {
    return <SummaryStatusChangeRow item={item} badge={statusChangeBadge} />;
  }

  if (
    item.kind === 'pitching_change' ||
    item.kind === 'offensive_substitution' ||
    item.kind === 'defensive_substitution'
  ) {
    return <SummarySubstitutionRow item={item} badge={getPlayBadge(item.eventType, item)} />;
  }

  const badge = getPlayBadge(item.eventType, item);
  const scoreLine = item.isScoring
    ? formatUpdatedScore(awayAbbr, homeAbbr, item.awayScore, item.homeScore)
    : null;
  const video =
    expandedVideoKey === item.key && pinnedVideo
      ? pinnedVideo
      : highlightByItemKey[item.key];

  return (
    <div
      onClick={() => item.play && onOpenPlay(item.play)}
      className={`flex items-start gap-2.5 p-2 transition-all ${item.play ? 'cursor-pointer hover:bg-slate-800/50' : ''}`}
    >
      <SummaryPlayAvatar item={item} onPlayerClick={onPlayerClick} />
      <div className="min-w-0 flex-1">
        <span className={`inline-block text-[14px] px-2 py-0.5 rounded-full border font-semibold mb-1 ${badge.cls}`}>
          {badge.label}
        </span>
        <p className="text-md text-slate-200 leading-snug">
          {item.description}
          {item.outsLabel && (
            <>
              {' '}
              <span className="whitespace-nowrap font-bold text-slate-100">{item.outsLabel}</span>
            </>
          )}
        </p>
        {scoreLine && (
          <p className="text-xl text-white-500 mt-1 font-bold">{scoreLine}</p>
        )}
        {video && (
          <ScoringPlayVideo
            video={video}
            isExpanded={expandedVideoKey === item.key}
            onToggle={() => onToggleVideo(item.key, video)}
          />
        )}
      </div>
    </div>
  );
}

export default function SummarySection({
  awayAbbr,
  expandedVideoKey,
  getPlayBadge,
  highlightByItemKey,
  homeAbbr,
  onOpenPlay,
  onPlayerClick,
  onToggleVideo,
  pinnedVideo,
  statusChangeBadge,
  summaryFilter,
  summaryItemGroups,
  summaryLeadIn,
  onSummaryFilterChange,
}) {
  return (
    <div className="bg-slate-900 border-slate-700/60 p-3 sm:p-5 lg:rounded-xl">
      <SegmentedControl
        value={summaryFilter}
        onChange={onSummaryFilterChange}
        variant="pill"
        size="sm"
        className="mb-4"
        options={[
          { value: 'all', label: 'All Plays' },
          { value: 'scoring', label: 'Scoring Only' },
        ]}
      />

      <div className="space-y-5">
        {summaryFilter === 'all' && (
          <div className="pb-2 border-b border-slate-800/60">
            <SummaryFirstPitchRow item={summaryLeadIn} />
          </div>
        )}
        {summaryItemGroups.map(({ key, items: groupItems }) => (
          <div key={key}>
            <div className="text-2xl font-bold text-slate-300 mb-2">{key}</div>
            <div className="space-y-1.5">
              {groupItems.map((item) => (
                <div key={item.key}>
                  <SummaryPlayItemRow
                    item={item}
                    awayAbbr={awayAbbr}
                    homeAbbr={homeAbbr}
                    getPlayBadge={getPlayBadge}
                    highlightByItemKey={highlightByItemKey}
                    expandedVideoKey={expandedVideoKey}
                    pinnedVideo={pinnedVideo}
                    onPlayerClick={(e) => onPlayerClick(e, item.batterId)}
                    onOpenPlay={onOpenPlay}
                    onToggleVideo={onToggleVideo}
                    statusChangeBadge={statusChangeBadge}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        {summaryItemGroups.length === 0 && (
          <div className="text-xs text-slate-600 italic text-center pt-4">No plays yet</div>
        )}
      </div>
    </div>
  );
}
