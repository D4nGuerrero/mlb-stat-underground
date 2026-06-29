import { Fragment, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';

export default function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  align = 'center',
  className = '',
  panelClassName = '',
  backDismiss = false,
  historyKey = 'appModal',
}) {
  const historyActiveRef = useRef(false);
  const suppressNextPopRef = useRef(false);

  useEffect(() => {
    if (!backDismiss) return undefined;

    const onPopState = () => {
      if (suppressNextPopRef.current) {
        suppressNextPopRef.current = false;
        return;
      }
      if (!open || !historyActiveRef.current) return;
      historyActiveRef.current = false;
      onClose?.();
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [backDismiss, onClose, open]);

  useEffect(() => {
    if (!backDismiss) return;

    const stateKey = `__${historyKey}`;
    if (open && !historyActiveRef.current) {
      if (window.history.state?.[stateKey]) {
        historyActiveRef.current = true;
        return;
      }
      window.history.pushState({ ...(window.history.state ?? {}), [stateKey]: true }, '');
      historyActiveRef.current = true;
      return;
    }

    if (!open && historyActiveRef.current) {
      historyActiveRef.current = false;
      suppressNextPopRef.current = true;
      window.history.back();
    }
  }, [backDismiss, historyKey, open]);

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
      <Transition appear show={open} as={Fragment}>
        <TransitionChild
          as="div"
          className="fixed inset-0"
          enter="modal-backdrop-enter"
          enterFrom="modal-backdrop-from"
          enterTo="modal-backdrop-to"
          leave="modal-backdrop-enter"
          leaveFrom="modal-backdrop-to"
          leaveTo="modal-backdrop-from"
        >
          <DialogBackdrop className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
        </TransitionChild>
      </Transition>

      <div className={`fixed inset-0 flex ${alignment} justify-center pointer-events-none ${className}`}>
        <Transition appear show={open} as={Fragment}>
          <TransitionChild
            as="div"
            className={['pointer-events-auto w-full', maxWidth].join(' ')}
            enter="modal-sheet-motion"
            enterFrom="modal-sheet-from"
            enterTo="modal-sheet-to"
            leave="modal-sheet-motion"
            leaveFrom="modal-sheet-leave-from"
            leaveTo="modal-sheet-leave-to"
          >
            <DialogPanel
              className={[
                'w-full bg-slate-900 border border-slate-700 shadow-2xl',
                'rounded-t-3xl sm:rounded-2xl overflow-hidden',
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
          </TransitionChild>
        </Transition>
      </div>
    </Dialog>
  );
}
