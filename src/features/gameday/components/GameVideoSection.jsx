import { useMemo, useState } from 'react';
import { classifyGameVideo } from '../../../utils/gameContent';
import { ScoringPlayVideo } from './SummarySection';

const CATEGORY_ORDER = ['All', 'Game Recap', 'Condensed Game', 'Interview', 'Moment', 'Highlight', 'Video'];

function categoryTone(category) {
  if (category === 'Game Recap') return 'border-sky-400/35 bg-sky-500/10 text-sky-100';
  if (category === 'Condensed Game') return 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100';
  if (category === 'Interview') return 'border-amber-400/35 bg-amber-500/10 text-amber-100';
  if (category === 'Moment') return 'border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-100';
  if (category === 'Highlight') return 'border-blue-400/35 bg-blue-500/10 text-blue-100';
  return 'border-slate-600 bg-slate-800/70 text-slate-200';
}

function videoKey(video) {
  return `video:${video.id ?? video.headline}`;
}

function GameVideoCard({
  video,
  expandedVideoKey,
  onToggleVideo,
  compact = false,
}) {
  const category = classifyGameVideo(video);
  const key = videoKey(video);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/45">
      <div className={compact ? 'p-3' : 'p-3 sm:p-4'}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${categoryTone(category)}`}>
            {category}
          </span>
          {video.provider && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              {video.provider}
            </span>
          )}
        </div>
        <h3 className={`${compact ? 'text-sm' : 'text-sm sm:text-base'} font-black leading-snug text-white`}>
          {video.headline || 'Game video'}
        </h3>
        {video.description && !compact && (
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-500">
            {video.description}
          </p>
        )}
        <ScoringPlayVideo
          video={video}
          isExpanded={expandedVideoKey === key}
          onToggle={() => onToggleVideo(key, video)}
        />
      </div>
    </article>
  );
}

export default function GameVideoSection({
  videos = [],
  expandedVideoKey,
  onToggleVideo,
  compact = false,
}) {
  const [category, setCategory] = useState('All');
  const categories = useMemo(() => {
    const available = new Set(videos.map((video) => classifyGameVideo(video)));
    return CATEGORY_ORDER.filter((item) => item === 'All' || available.has(item));
  }, [videos]);

  const visibleVideos = useMemo(() => {
    if (category === 'All') return videos;
    return videos.filter((video) => classifyGameVideo(video) === category);
  }, [category, videos]);

  return (
    <section className="bg-slate-900 sm:rounded-2xl">
      <div className="border-b border-slate-800 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Game Videos
            </div>
            <div className="mt-1 text-lg font-black text-white">
              Highlights, recaps, condensed game
            </div>
          </div>
          <div className="text-xs font-semibold text-slate-500">
            {videos.length} clips
          </div>
        </div>
        {categories.length > 2 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-black transition-colors ${
                  category === item
                    ? 'border-white bg-white text-slate-950'
                    : 'border-slate-700 bg-slate-950/35 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={compact ? 'p-3' : 'p-3 sm:p-5'}>
        {visibleVideos.length ? (
          <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
            {visibleVideos.map((video) => (
              <GameVideoCard
                key={video.id ?? video.headline}
                video={video}
                expandedVideoKey={expandedVideoKey}
                onToggleVideo={onToggleVideo}
                compact={compact}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-700/70 bg-slate-950/35 px-4 py-10 text-center">
            <div className="text-sm font-black text-slate-200">No videos yet</div>
            <div className="mt-1 text-xs text-slate-500">
              MLB usually adds recaps, condensed games, and interviews after clips finish processing.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
