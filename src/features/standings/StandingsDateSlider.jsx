import { useMemo } from 'react';
import {
  daysBetween,
  formatSliderDate,
  isoFromIndex,
} from '../../utils/standings';

function monthTicks(startIso, endIso) {
  const total = Math.max(1, daysBetween(startIso, endIso));
  const ticks = [];
  const [sy, sm] = startIso.split('-').map(Number);
  const [ey, em] = endIso.split('-').map(Number);
  let year = sy;
  let month = sm;
  while (year < ey || (year === ey && month <= em)) {
    const iso = `${year}-${String(month).padStart(2, '0')}-01`;
    const clamped = iso < startIso ? startIso : iso;
    if (clamped <= endIso) {
      const pct = (daysBetween(startIso, clamped) / total) * 100;
      const previous = ticks[ticks.length - 1];
      if (!previous || pct - previous.pct >= 9) {
        ticks.push({
          key: iso,
          label: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short' }),
          pct,
        });
      }
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return ticks;
}

export default function StandingsDateSlider({
  startIso,
  endIso,
  fromIso,
  toIso,
  onChange,
}) {
  const maxIndex = Math.max(0, daysBetween(startIso, endIso));
  const fromIndex = Math.min(maxIndex, Math.max(0, daysBetween(startIso, fromIso)));
  const toIndex = Math.min(maxIndex, Math.max(fromIndex, daysBetween(startIso, toIso)));
  const ticks = useMemo(() => monthTicks(startIso, endIso), [startIso, endIso]);
  const fromPct = maxIndex === 0 ? 0 : (fromIndex / maxIndex) * 100;
  const toPct = maxIndex === 0 ? 100 : (toIndex / maxIndex) * 100;

  const emit = (nextFrom, nextTo) => {
    let from = Math.min(Math.max(0, nextFrom), maxIndex);
    let to = Math.min(Math.max(0, nextTo), maxIndex);
    if (from > to) from = to;
    onChange?.(isoFromIndex(startIso, from), isoFromIndex(startIso, to));
  };

  return (
    <div className="px-1">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">From</div>
          <div className="font-display text-xl leading-none text-white">{formatSliderDate(fromIso)}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Through</div>
          <div className="font-display text-xl leading-none text-white">{formatSliderDate(toIso)}</div>
        </div>
      </div>

      <div className="relative h-10 select-none">
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-700" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-accent-400"
          style={{ left: `${fromPct}%`, width: `${Math.max(0, toPct - fromPct)}%` }}
        />
        {ticks.map((tick) => (
          <div
            key={tick.key}
            className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-slate-500/80"
            style={{ left: `${tick.pct}%` }}
          />
        ))}
        <input
          type="range"
          min={0}
          max={maxIndex}
          step={1}
          value={fromIndex}
          aria-label="Standings start date"
          className="standings-date-slider standings-date-slider--from"
          onChange={(event) => emit(Number(event.target.value), toIndex)}
        />
        <input
          type="range"
          min={0}
          max={maxIndex}
          step={1}
          value={toIndex}
          aria-label="Standings end date"
          className="standings-date-slider standings-date-slider--to"
          onChange={(event) => emit(fromIndex, Number(event.target.value))}
        />
      </div>

      <div className="relative mt-1 h-4">
        {ticks.map((tick) => (
          <div
            key={`${tick.key}-label`}
            className="absolute -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider text-slate-500"
            style={{ left: `${tick.pct}%` }}
          >
            {tick.label}
          </div>
        ))}
      </div>
    </div>
  );
}
