import { useMemo } from 'react';
import {
  Moon,
  Sun,
  Smartphone,
  PanelTop,
  PanelBottom,
  Palette,
  Settings as SettingsIcon,
  Check,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { THEME_COLOR_LABELS } from '../theme/theme.js';

function SettingCard({ icon, title, description, children, isDark }) {
  return (
    <section
      className={[
        'rounded-2xl border p-4 sm:p-5 transition-colors',
        isDark
          ? 'border-slate-800 bg-slate-900/70'
          : 'border-slate-200 bg-white shadow-sm',
      ].join(' ')}
    >
      <div className="mb-4 flex items-start gap-3">
        <span
          className={[
            'mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl',
            isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700',
          ].join(' ')}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className={`text-sm font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              {description}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function ChoiceButton({ active, onClick, icon, label, hint, isDark }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'relative flex flex-col items-center gap-2 rounded-2xl border px-3 py-3.5 text-center transition-all active:scale-[0.98]',
        active
          ? 'border-accent-500/60 bg-accent-500/15 text-accent-200 ring-2 ring-accent-500/40'
          : isDark
            ? 'border-slate-700 bg-slate-950/60 text-slate-400 hover:border-slate-500 hover:text-slate-200'
            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:text-slate-900',
      ].join(' ')}
    >
      {active && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent-500 text-slate-950">
          <Check size={12} strokeWidth={3} aria-hidden />
        </span>
      )}
      <span className={active ? 'text-accent-300' : 'text-slate-500'}>{icon}</span>
      <span className={`text-xs font-black uppercase tracking-wider ${active && !isDark ? 'text-accent-600' : ''}`}>
        {label}
      </span>
      {hint && <span className="text-[10px] leading-snug text-slate-500">{hint}</span>}
    </button>
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

  const statusLine = useMemo(() => {
    const accentLabel = THEME_COLOR_LABELS[color] ?? color;
    const parts = [
      theme === 'dark' ? 'Dark mode' : 'Light mode',
      `${accentLabel} accent`,
      isBottomNav ? 'Bottom mobile nav' : 'Top nav',
    ];
    return parts.join(' · ');
  }, [theme, color, isBottomNav]);

  return (
    <div className="mx-auto max-w-lg px-3 py-6 sm:px-6 sm:py-8">
      <header className="mb-6">
        <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-accent-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-accent-300 ring-1 ring-accent-500/25">
          <SettingsIcon size={12} aria-hidden />
          Preferences
        </div>
        <h1
          className={[
            'font-display text-2xl font-black tracking-tight sm:text-3xl',
            isDark ? 'text-white' : 'text-slate-900',
          ].join(' ')}
        >
          Settings
        </h1>
        <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Appearance and mobile navigation. Changes save on this device.
        </p>
        <p
          className={[
            'mt-3 rounded-xl border px-3 py-2 text-xs font-semibold',
            isDark
              ? 'border-slate-800 bg-slate-900/80 text-slate-300'
              : 'border-slate-200 bg-white text-slate-700',
          ].join(' ')}
          aria-live="polite"
        >
          Active: <span className="text-accent-300">{statusLine}</span>
        </p>
      </header>

      <div className="space-y-4">
        <SettingCard
          isDark={isDark}
          icon={isDark ? <Moon size={18} /> : <Sun size={18} />}
          title="Appearance"
          description="Dark keeps the classic look. Light brightens shells, tables, and chrome."
        >
          <div className="grid grid-cols-2 gap-2">
            <ChoiceButton
              active={theme === 'dark'}
              onClick={() => setTheme('dark')}
              icon={<Moon size={20} />}
              label="Dark"
              hint="Night mode"
              isDark={isDark}
            />
            <ChoiceButton
              active={theme === 'light'}
              onClick={() => setTheme('light')}
              icon={<Sun size={20} />}
              label="Light"
              hint="Higher contrast"
              isDark={isDark}
            />
          </div>
        </SettingCard>

        <SettingCard
          isDark={isDark}
          icon={<Palette size={18} />}
          title="Accent color"
          description="Default is white in dark mode and black in light mode. Color accents use deeper tones on light backgrounds for contrast."
        >
          <div className="flex flex-wrap gap-2">
            {colorOptions.map((option) => {
              const active = color === option;
              const label = THEME_COLOR_LABELS[option] ?? option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setColor(option)}
                  aria-pressed={active}
                  className={[
                    'inline-flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-xs font-black uppercase tracking-wider transition-all active:scale-[0.98]',
                    active
                      ? 'border-accent-500/60 bg-accent-500/15 text-accent-200 ring-2 ring-accent-500/40'
                      : isDark
                        ? 'border-slate-700 bg-slate-950/60 text-slate-400 hover:border-slate-500'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'h-3.5 w-3.5 rounded-full ring-2',
                      option === 'default'
                        ? isDark
                          ? 'bg-white ring-slate-500'
                          : 'bg-slate-900 ring-slate-400'
                        : 'ring-white/10',
                    ].join(' ')}
                    style={
                      option === 'default'
                        ? undefined
                        : { backgroundColor: `var(--swatch-${option}, var(--accent-500-hex))` }
                    }
                  />
                  {label}
                  {active && <Check size={14} className="text-accent-300" aria-hidden />}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Live sample:{' '}
            <span className="font-bold text-accent-500">.312 AVG</span>
            {' · '}
            <span className="rounded-md bg-accent-500/15 px-1.5 py-0.5 font-semibold text-accent-300">accent chip</span>
            {' · '}
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent-500 align-middle" />
          </p>
        </SettingCard>

        <SettingCard
          isDark={isDark}
          icon={<Smartphone size={18} />}
          title="Mobile navigation"
          description="On phones, put main tabs at the bottom like a native app. Desktop always uses the top bar."
        >
          <div className="grid grid-cols-2 gap-2">
            <ChoiceButton
              active={navPosition === 'top'}
              onClick={() => setNavPosition('top')}
              icon={<PanelTop size={20} />}
              label="Top bar"
              hint="Classic header"
              isDark={isDark}
            />
            <ChoiceButton
              active={navPosition === 'bottom'}
              onClick={() => setNavPosition('bottom')}
              icon={<PanelBottom size={20} />}
              label="Bottom bar"
              hint="Thumb-friendly"
              isDark={isDark}
            />
          </div>

          {isBottomNav && (
            <label
              className={[
                'mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition-colors',
                isDark
                  ? 'border-slate-700 bg-slate-950/50 hover:border-slate-600'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300',
              ].join(' ')}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-500 accent-[var(--accent-500-hex,#3b82f6)]"
                checked={hideTopBar}
                onChange={(e) => setHideTopBar(e.target.checked)}
              />
              <span className="min-w-0">
                <span className={`block text-xs font-black uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  Hide top bar completely
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                  On phones with the bottom bar, remove the logo header so content starts at the top.
                  Desktop still uses the full top nav.
                </span>
              </span>
            </label>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            {isBottomNav ? (
              <>
                Bottom bar is <span className="font-semibold text-accent-300">on</span>
                {hideTopBar ? (
                  <> · top bar <span className="font-semibold text-accent-300">hidden</span> on mobile</>
                ) : (
                  <> · logo header still shows above content</>
                )}
                . Use a phone-width window (under sm) to see it.
              </>
            ) : (
              <>
                Bottom bar is <span className="font-semibold">off</span>. Tabs stay in the top header.
              </>
            )}
          </p>
        </SettingCard>
      </div>
    </div>
  );
}
