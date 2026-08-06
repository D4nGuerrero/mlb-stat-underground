import { Link } from 'react-router-dom';
import {
  Moon,
  Sun,
  PanelTop,
  PanelBottom,
  Check,
  Bug,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { THEME_COLOR_LABELS } from '../theme/theme.js';

function Section({ title, isDark, children }) {
  return (
    <section
      className={[
        'rounded-2xl border overflow-hidden',
        isDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white shadow-sm',
      ].join(' ')}
    >
      <div className={`px-4 pt-3.5 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {title}
      </div>
      <div className="px-3 pb-3 space-y-2">{children}</div>
    </section>
  );
}

function Segment({ options, value, onChange, isDark }) {
  return (
    <div
      className={[
        'grid grid-cols-2 gap-1 rounded-xl p-1',
        isDark ? 'bg-slate-950/70' : 'bg-slate-100',
      ].join(' ')}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={[
              'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-bold transition-all',
              active
                ? isDark
                  ? 'bg-slate-800 text-slate-100 shadow-sm'
                  : 'bg-white text-slate-900 shadow-sm'
                : isDark
                  ? 'text-slate-500 hover:text-slate-300'
                  : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Settings() {
  const {
    theme,
    setTheme,
    isDark,
    color,
    setColor,
    colorOptions,
    navPosition,
    setNavPosition,
    isBottomNav,
    hideTopBar,
    setHideTopBar,
  } = useTheme();

  return (
    <div className="mx-auto max-w-lg px-3 py-6 sm:px-6 sm:py-8">
      <h1
        className={[
          'font-display text-2xl font-black tracking-tight sm:text-3xl mb-5',
          isDark ? 'text-white' : 'text-slate-900',
        ].join(' ')}
      >
        Settings
      </h1>

      <div className="space-y-3">
        <Section title="Appearance" isDark={isDark}>
          <Segment
            isDark={isDark}
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
              { value: 'light', label: 'Light', icon: <Sun size={14} /> },
            ]}
          />
        </Section>

        <Section title="Accent" isDark={isDark}>
          <div className="flex flex-wrap gap-2 px-0.5">
            {colorOptions.map((option) => {
              const active = color === option;
              const label = THEME_COLOR_LABELS[option] ?? option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setColor(option)}
                  aria-pressed={active}
                  title={label}
                  className={[
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                    active
                      ? 'border-accent-500/50 bg-accent-500/15 text-accent-200 ring-1 ring-accent-500/30'
                      : isDark
                        ? 'border-slate-700 text-slate-400 hover:border-slate-500'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'h-3 w-3 rounded-full',
                      option === 'default'
                        ? isDark
                          ? 'bg-white ring-1 ring-slate-500'
                          : 'bg-slate-900 ring-1 ring-slate-400'
                        : '',
                    ].join(' ')}
                    style={
                      option === 'default'
                        ? undefined
                        : { backgroundColor: `var(--swatch-${option}, var(--accent-500-hex))` }
                    }
                  />
                  {label}
                  {active && <Check size={12} className="text-accent-300" aria-hidden />}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Mobile navigation" isDark={isDark}>
          <Segment
            isDark={isDark}
            value={navPosition}
            onChange={setNavPosition}
            options={[
              { value: 'top', label: 'Top bar', icon: <PanelTop size={14} /> },
              { value: 'bottom', label: 'Bottom bar', icon: <PanelBottom size={14} /> },
            ]}
          />

          {isBottomNav && (
            <label
              className={[
                'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5',
                isDark
                  ? 'border-slate-700/80 bg-slate-950/40'
                  : 'border-slate-200 bg-slate-50',
              ].join(' ')}
            >
              <input
                type="checkbox"
                className="h-4 w-4 flex-shrink-0 rounded border-slate-500 accent-[var(--accent-500-hex,#3b82f6)]"
                checked={hideTopBar}
                onChange={(e) => setHideTopBar(e.target.checked)}
              />
              <span className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Hide top bar on mobile
              </span>
            </label>
          )}
        </Section>

        <Section title="Developer" isDark={isDark}>
          <Link
            to="/debug"
            className={[
              'flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors',
              isDark
                ? 'border-slate-700/80 bg-slate-950/40 text-slate-200 hover:border-slate-600'
                : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300',
            ].join(' ')}
          >
            <span
              className={[
                'flex h-9 w-9 items-center justify-center rounded-xl',
                isDark ? 'bg-slate-800 text-slate-300' : 'bg-white text-slate-600 ring-1 ring-slate-200',
              ].join(' ')}
            >
              <Bug size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Debug</span>
              <span className="block text-[11px] text-slate-500">Dev utilities</span>
            </span>
            <ChevronRight size={16} className="text-slate-500" aria-hidden />
          </Link>
        </Section>
      </div>
    </div>
  );
}
