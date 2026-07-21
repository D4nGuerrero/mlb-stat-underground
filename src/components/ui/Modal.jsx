import { Fragment, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react';

const modalHistoryStack = [];
let modalHistoryListenerInstalled = false;

function getModalHistoryStack(state = window.history.state) {
  return Array.isArray(state?.__modalStack) ? state.__modalStack : [];
}

function registerModalHistoryEntry(entry) {
  const existingIndex = modalHistoryStack.findIndex((item) => item.key === entry.key);
  if (existingIndex >= 0) {
    modalHistoryStack.splice(existingIndex, 1, entry);
  } else {
    modalHistoryStack.push(entry);
  }
}

function unregisterModalHistoryEntry(key) {
  const existingIndex = modalHistoryStack.findIndex((item) => item.key === key);
  if (existingIndex >= 0) modalHistoryStack.splice(existingIndex, 1);
}

function modalTokenBelongsToKey(token, key) {
  return typeof token === 'string' && token.startsWith(`${key}:`);
}

function ensureModalHistoryListener() {
  if (modalHistoryListenerInstalled || typeof window === 'undefined') return;
  modalHistoryListenerInstalled = true;

  window.addEventListener('popstate', (event) => {
    const top = modalHistoryStack[modalHistoryStack.length - 1];
    if (!top) return;

    // If the new history entry still contains this modal, Back was for some
    // deeper browser entry. Otherwise, dismiss exactly the top visible sheet.
    if (getModalHistoryStack(event.state).includes(top.token)) return;
    top.closeFromBack();
  });
}

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
  const closedByBackRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const historyTokenRef = useRef(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!backDismiss) return;

    const stateKey = `__${historyKey}`;
    const entryKey = historyKey;
    if (open && !historyActiveRef.current) {
      closedByBackRef.current = false;
      ensureModalHistoryListener();
      const entryToken = `${entryKey}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      historyTokenRef.current = entryToken;
      registerModalHistoryEntry({
        key: entryKey,
        token: entryToken,
        closeFromBack: () => {
          closedByBackRef.current = true;
          historyActiveRef.current = false;
          unregisterModalHistoryEntry(entryKey);
          onCloseRef.current?.();
        },
      });

      const currentState = window.history.state ?? {};
      const currentStack = getModalHistoryStack(currentState);
      window.history.pushState({
        ...currentState,
        [stateKey]: true,
        __modalStack: [
          ...currentStack.filter((token) => !modalTokenBelongsToKey(token, entryKey)),
          entryToken,
        ],
      }, '');
      historyActiveRef.current = true;
      return;
    }

    if (!open && historyActiveRef.current) {
      historyActiveRef.current = false;
      unregisterModalHistoryEntry(entryKey);
      if (closedByBackRef.current) {
        closedByBackRef.current = false;
        historyTokenRef.current = null;
        return;
      }

      const entryToken = historyTokenRef.current;
      historyTokenRef.current = null;
      if (entryToken && getModalHistoryStack().includes(entryToken)) {
        window.history.back();
      }
    }
  }, [backDismiss, historyKey, open]);

  useEffect(() => () => {
    if (!backDismiss) return;
    unregisterModalHistoryEntry(historyKey);
  }, [backDismiss, historyKey]);

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
