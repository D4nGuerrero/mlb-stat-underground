import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import { ChevronDown, Check } from 'lucide-react';

export default function Select({
  value,
  onChange,
  options,
  className = '',
  buttonClassName = '',
  size = 'md',
  placeholder = 'Select…',
}) {
  const selected = options.find((o) => o.value === value);
  const padding = size === 'sm' ? 'px-2 py-1' : size === 'lg' ? 'px-4 py-3' : 'px-4 py-2';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <Listbox value={value} onChange={onChange}>
      <div className={`relative ${className}`}>
        <ListboxButton
          className={[
            'relative w-full text-left bg-slate-800 border border-slate-700 rounded-2xl',
            `focus:outline-none focus:border-accent-500 transition-colors`,
            'flex items-center justify-between gap-2',
            padding,
            textSize,
            buttonClassName,
          ].join(' ')}
        >
          <span className="flex items-center gap-2 min-w-0">
            {selected?.icon && (
              <img
                src={selected.icon}
                alt=""
                className="w-4 h-4 object-contain flex-shrink-0"
                onError={(e) => (e.target.style.display = 'none')}
              />
            )}
            <span className="truncate">{selected?.label ?? placeholder}</span>
          </span>
          <ChevronDown size={14} className="text-slate-500 flex-shrink-0" aria-hidden />
        </ListboxButton>

        <ListboxOptions
          anchor="bottom start"
          transition
          className={[
            'z-50 mt-1 max-h-60 overflow-auto rounded-2xl',
            'bg-slate-900 border border-slate-700 py-1 shadow-xl',
            'focus:outline-none',
            'transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0',
            'w-[var(--button-width)]',
          ].join(' ')}
        >
          {options.map((opt) => (
            <ListboxOption
              key={opt.value}
              value={opt.value}
              disabled={opt.disabled}
              className={({ focus, selected }) =>
                [
                  'relative cursor-pointer select-none px-4 py-2.5 text-sm',
                  focus ? 'bg-slate-800 text-white' : 'text-slate-300',
                  selected ? `text-accent-400` : '',
                  opt.disabled ? 'opacity-40 cursor-not-allowed' : '',
                ].join(' ')
              }
            >
              {({ selected }) => (
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    {opt.icon && (
                      <img
                        src={opt.icon}
                        alt=""
                        className="w-5 h-5 object-contain flex-shrink-0"
                        onError={(e) => (e.target.style.display = 'none')}
                      />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </span>
                  {selected && <Check size={14} className={`text-accent-400 flex-shrink-0`} />}
                </div>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
