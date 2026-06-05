import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react';

export default function Collapsible({
  title,
  badge,
  children,
  defaultOpen = false,
  className = '',
  headerClassName = '',
}) {
  return (
    <Disclosure
      as="div"
      defaultOpen={defaultOpen}
      className={`bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden ${className}`}
    >
      <DisclosureButton
        className={[
          'w-full px-4 py-3 flex items-center justify-between',
          'hover:bg-slate-800/40 transition-colors focus:outline-none',
          headerClassName,
        ].join(' ')}
      >
        {({ open }) => (
          <>
            <div className="flex items-center gap-2 text-left">
              {typeof title === 'string' ? (
                <span className="text-sm font-semibold text-slate-300">{title}</span>
              ) : (
                title
              )}
              {badge}
            </div>
            <span className="text-slate-600 text-xs">{open ? '▲' : '▼'}</span>
          </>
        )}
      </DisclosureButton>

      <DisclosurePanel className="border-t border-slate-800 focus:outline-none">
        {children}
      </DisclosurePanel>
    </Disclosure>
  );
}