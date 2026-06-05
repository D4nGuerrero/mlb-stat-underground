import { RadioGroup, Radio } from '@headlessui/react';

const VARIANTS = {
  white: {
    active: 'bg-white text-slate-900 shadow-sm',
    inactive: 'text-slate-400 hover:text-white',
  },
  emerald: {
    active: 'bg-emerald-500 text-white shadow-sm',
    inactive: 'text-slate-300 hover:text-white',
  },
  compact: {
    active: 'bg-slate-700 text-white',
    inactive: 'text-slate-500 hover:text-slate-300',
  },
  pill: {
    active: 'bg-white text-slate-900 border-white',
    inactive: 'bg-transparent text-slate-400 border-slate-600 hover:border-slate-400 hover:text-slate-200',
  },
  category: {
    active: 'bg-emerald-500 text-white shadow-sm',
    inactive: 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700',
  },
  simulator: {
    active: 'bg-slate-700 text-white shadow',
    inactive: 'text-slate-500 hover:text-slate-300',
  },
  speed: {
    active: 'bg-emerald-600 text-white',
    inactive: 'text-slate-400 hover:text-white',
  },
};

export default function SegmentedControl({
  value,
  onChange,
  options,
  variant = 'white',
  size = 'md',
  className = '',
  optionClassName = '',
  rounded = 'xl',
  wrap = false,
}) {
  const styles = VARIANTS[variant] ?? VARIANTS.white;
  const padding = size === 'sm' ? 'px-3 py-1.5' : size === 'xs' ? 'px-2 py-1' : 'px-4 py-2';
  const textSize = size === 'sm' || size === 'xs' ? 'text-xs' : 'text-sm';
  const isPill = variant === 'pill';
  const roundedClass = { xl: 'rounded-xl', lg: 'rounded-lg', full: 'rounded-full' }[rounded] ?? 'rounded-xl';

  return (
    <RadioGroup value={value} onChange={onChange} className={className}>
      <div className={`flex ${isPill || wrap ? 'flex-wrap gap-1.5' : 'gap-0.5'}`}>
        {options.map((opt) => (
          <Radio
            key={opt.value}
            value={opt.value}
            disabled={opt.disabled}
            title={opt.title}
            className={({ checked, disabled }) =>
              [
                'font-semibold transition-all capitalize flex items-center justify-center',
                isPill ? 'rounded-full border' : roundedClass,
                padding,
                textSize,
                checked ? styles.active : styles.inactive,
                disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                opt.disabled ? '' : 'active:scale-[0.98]',
                optionClassName,
                opt.className ?? '',
              ].join(' ')
            }
          >
            {opt.icon ? (
              <span className="flex items-center justify-center">
                <i className={`fa-solid ${opt.icon}`} />
              </span>
            ) : (
              opt.label
            )}
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
}