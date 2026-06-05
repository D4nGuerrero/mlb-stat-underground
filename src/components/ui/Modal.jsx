import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  align = 'center',
  className = '',
  panelClassName = '',
}) {
  const maxWidth = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    full: 'max-w-full',
  }[size] ?? 'max-w-lg';

  const alignment =
    align === 'bottom'
      ? 'items-end sm:items-center'
      : 'items-end sm:items-center sm:justify-center';

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" aria-hidden="true" />

      <div className={`fixed inset-0 flex ${alignment} justify-center p-4 ${className}`}>
        <DialogPanel
          className={[
            'w-full bg-slate-900 border border-slate-700 shadow-2xl',
            'rounded-t-3xl sm:rounded-2xl overflow-hidden',
            'transition duration-200 ease-out data-[closed]:scale-95 data-[closed]:opacity-0',
            maxWidth,
            panelClassName,
          ].join(' ')}
        >
          {title && (
            <div className="p-4 border-b border-slate-800">
              <DialogTitle className="text-sm font-semibold text-white">{title}</DialogTitle>
            </div>
          )}
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}