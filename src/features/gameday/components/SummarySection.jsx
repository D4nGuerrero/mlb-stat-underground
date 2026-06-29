import { useEffect, useRef } from 'react';
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

function VideoShareMenu({ video }) {
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

  return (
    <Menu as="div" className="absolute top-2 right-2 z-20">
      <MenuButton
        type="button"
        onClick={(e) => e.stopPropagation()}
        className="w-8 h-8 rounded-full bg-black/55 hover:bg-black/70 backdrop-blur border border-white/20 flex items-center justify-center text-white transition-colors"
        aria-label="Video options"
      >
        <i className="fa-solid fa-ellipsis-vertical text-sm" aria-hidden />
      </MenuButton>

      <MenuItems
        anchor="bottom end"
        transition
        className="z-50 mt-1 min-w-[10.5rem] rounded-xl bg-slate-900 border border-slate-700 py-1 shadow-xl focus:outline-none transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
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
                Open on MLB.com
              </a>
            )}
          </MenuItem>
        )}
      </MenuItems>
    </Menu>
  );
}

export function ScoringPlayVideo({ video, isExpanded, onToggle }) {
  const videoRef = useRef(null);
  const playOnExpandRef = useRef(false);
  const src = video?.mp4Url || video?.hlsUrl;

  useEffect(() => {
    const el = videoRef.current;
    if (isExpanded && playOnExpandRef.current && el) {
      el.play().catch(() => {});
      playOnExpandRef.current = false;
    }
  }, [isExpanded]);

  const handleExpand = () => {
    playOnExpandRef.current = true;
    onToggle();
  };

  if (!video?.thumbnail && !src) return null;

  return (
    <div className="mt-3 max-w-md" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {isExpanded && src ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-700/60 bg-black">
          <VideoShareMenu video={video} />
          <video
            key={video.id ?? src}
            ref={videoRef}
            controls
            playsInline
            poster={video.thumbnail}
            className="w-full aspect-video"
            src={src}
          >
            <track kind="captions" />
          </video>
          {video.headline && (
            <div className="px-3 py-2 text-xs text-slate-400 border-t border-slate-800">{video.headline}</div>
          )}
        </div>
      ) : (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-700/60">
          <VideoShareMenu video={video} />
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
        {item.isScoring && video && (
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
