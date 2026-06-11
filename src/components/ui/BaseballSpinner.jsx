const SIZE_CLASS = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-10 h-10',
};

function BaseballSvg({ className = '' }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="32" cy="32" r="29" fill="#FAF7F0" stroke="#D8D2C4" strokeWidth="1.5" />
      <path
        d="M17 11 C28 22, 28 42, 17 53"
        stroke="#C8102E"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M47 11 C36 22, 36 42, 47 53"
        stroke="#C8102E"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M21 18 L23 20 M24 24 L26 26 M26 30 L28 32 M26 36 L28 38 M23 42 L25 44 M20 48 L22 50" stroke="#C8102E" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M43 18 L41 20 M40 24 L38 26 M38 30 L36 32 M38 36 L36 38 M41 42 L39 44 M44 48 L42 50" stroke="#C8102E" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Spinning baseball loading indicator. */
export function BaseballSpinner({
  size = 'lg',
  className = '',
  label,
  inline = false,
}) {
  const sizeClass = SIZE_CLASS[size] ?? SIZE_CLASS.lg;
  const ball = (
    <BaseballSvg className={`${sizeClass} shrink-0 animate-spin ${className}`} />
  );

  if (label) {
    return (
      <div className="flex flex-col items-center gap-3 text-slate-400" role="status" aria-live="polite">
        {ball}
        <span>{label}</span>
      </div>
    );
  }

  if (inline) {
    return (
      <span role="status" aria-label="Loading" className="inline-flex">
        {ball}
      </span>
    );
  }

  return (
    <div role="status" aria-label="Loading" className="inline-flex">
      {ball}
    </div>
  );
}

/** Centered page/section loading state with spinning baseball. */
export function LoadingSpinner({
  size = 'lg',
  className = '',
  py = 'py-16',
  label,
}) {
  return (
    <div className={`flex justify-center items-center ${py} ${className}`}>
      {label ? (
        <BaseballSpinner size={size} label={label} />
      ) : (
        <BaseballSpinner size={size} />
      )}
    </div>
  );
}