import { useSyncExternalStore } from 'react';

import { DiagnosticEntry } from '../types/api';

let entries: DiagnosticEntry[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function addDiagnostic(entry: DiagnosticEntry) {
  entries = [entry, ...entries].slice(0, 100);
  emit();
}

export function clearDiagnostics() {
  entries = [];
  emit();
}

export function useDiagnostics() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => entries,
    () => entries,
  );
}
