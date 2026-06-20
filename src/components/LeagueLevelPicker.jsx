import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { THEME_COLOR } from '../theme/theme.js';
import { LEAGUE_LEVEL_BY_VALUE, LEAGUE_LEVEL_OPTIONS } from '../constants/leagueLevels.js';

export function LeagueLevelPicker({
  value,
  onChange,
  ariaLabel = 'Change league level',
  triggerClassName = 'group flex items-center gap-2 text-right outline-none transition-opacity hover:opacity-90 active:scale-[0.985]',
  textClassName = 'font-sans font-bold text-2xl sm:text-sm tracking-tight text-white',
  logoClassName = 'h-20 w-20 sm:h-9 sm:w-9 object-contain',
  menuClassName = 'z-50 -mt-2 sm:m-2 w-52 rounded-2xl border border-slate-700 bg-slate-900/95 p-1 shadow-2xl shadow-black/40 backdrop-blur focus:outline-none transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0',
}) {
  const league = LEAGUE_LEVEL_BY_VALUE[value] ?? LEAGUE_LEVEL_BY_VALUE.mlb;

  return (
    <Menu as="div" className="relative">
      <MenuButton
        type="button"
        className={triggerClassName}
        aria-label={ariaLabel}
      >
        <span className={textClassName}>
          {league.shortLabel}
        </span>
        <img src={league.logo} alt="" className={logoClassName} draggable={false} />
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        transition
        className={menuClassName}
      >
        {LEAGUE_LEVEL_OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <MenuItem key={option.value}>
              {({ focus, close }) => (
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    close();
                  }}
                  className={[
                    'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                    focus ? 'bg-slate-800 text-white' : 'text-slate-300',
                    selected ? `text-${THEME_COLOR}-300` : '',
                  ].join(' ')}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <img src={option.logo} alt="" className="h-6 w-6 flex-shrink-0 object-contain" draggable={false} />
                    <span className="truncate font-bold">{option.label}</span>
                  </span>
                  {selected && <i className={`fa-solid fa-check text-xs text-${THEME_COLOR}-300`} aria-hidden />}
                </button>
              )}
            </MenuItem>
          );
        })}
      </MenuItems>
    </Menu>
  );
}
