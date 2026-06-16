import { useCallback, useEffect, useState } from 'react';

const STORAGE_SYNC_EVENT = 'mlb-storage-sync';

function resolveInitialValue(initialValue) {
  return typeof initialValue === 'function' ? initialValue() : initialValue;
}

function getStorage(storageType) {
  if (typeof window === 'undefined') return null;
  return storageType === 'session' ? window.sessionStorage : window.localStorage;
}

function readStoredValue(storageType, key, initialValue, parse) {
  const storage = getStorage(storageType);
  if (!storage) return resolveInitialValue(initialValue);

  try {
    const raw = storage.getItem(key);
    return raw == null ? resolveInitialValue(initialValue) : parse(raw);
  } catch {
    return resolveInitialValue(initialValue);
  }
}

function createAbortError() {
  return new DOMException('The operation was aborted.', 'AbortError');
}

export function useStorageState(
  key,
  initialValue,
  {
    storage = 'local',
    parse = JSON.parse,
    serialize = JSON.stringify,
    sync = true,
  } = {},
) {
  const [initialSnapshot] = useState(() => resolveInitialValue(initialValue));
  const [value, setValue] = useState(() => readStoredValue(storage, key, initialSnapshot, parse));

  const persistValue = useCallback((nextValue) => {
    const store = getStorage(storage);
    if (!store) return;

    try {
      if (nextValue === undefined) {
        store.removeItem(key);
      } else {
        store.setItem(key, serialize(nextValue));
      }

      window.dispatchEvent(new CustomEvent(STORAGE_SYNC_EVENT, {
        detail: { key, storage },
      }));
    } catch {
      // Ignore storage write failures so UI state still updates in memory.
    }
  }, [key, serialize, storage]);

  const updateValue = useCallback((updater) => {
    setValue((prev) => {
      const nextValue = typeof updater === 'function' ? updater(prev) : updater;
      persistValue(nextValue);
      return nextValue;
    });
  }, [persistValue]);

  const resetValue = useCallback(() => {
    updateValue(initialSnapshot);
  }, [initialSnapshot, updateValue]);

  useEffect(() => {
    if (!sync || typeof window === 'undefined') return undefined;

    const syncFromStorage = (event) => {
      if (event.type === 'storage') {
        const isMatchingStorage = storage === 'local'
          ? event.storageArea === window.localStorage
          : event.storageArea === window.sessionStorage;
        if (!isMatchingStorage || event.key !== key) return;
      } else if (event.detail?.key !== key || event.detail?.storage !== storage) {
        return;
      }

      setValue(readStoredValue(storage, key, initialSnapshot, parse));
    };

    window.addEventListener('storage', syncFromStorage);
    window.addEventListener(STORAGE_SYNC_EVENT, syncFromStorage);
    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener(STORAGE_SYNC_EVENT, syncFromStorage);
    };
  }, [initialSnapshot, key, parse, storage, sync]);

  return [value, updateValue, resetValue];
}

export function useLocalStorageState(key, initialValue, options = {}) {
  return useStorageState(key, initialValue, { ...options, storage: 'local' });
}

export function useSessionStorageState(key, initialValue, options = {}) {
  return useStorageState(key, initialValue, { ...options, storage: 'session' });
}

export function raceWithAbort(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(createAbortError());

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(createAbortError()), { once: true });
    }),
  ]);
}
