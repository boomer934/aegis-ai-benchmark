import { useSyncExternalStore } from "react";

/**
 * Minimal external store (no dependency): React subscribes through
 * useSyncExternalStore with a selector, so components re-render only when
 * the selected slice changes. Non-React code (the render loop) reads/writes
 * directly without triggering renders.
 */
export interface Store<T> {
  get(): T;
  set(partial: Partial<T> | ((s: T) => Partial<T>)): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(partial) {
      const patch = typeof partial === "function" ? partial(state) : partial;
      let changed = false;
      for (const k in patch) {
        if (!Object.is(patch[k], state[k])) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      state = { ...state, ...patch };
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<T extends object, S>(store: Store<T>, selector: (s: T) => S, serverState?: T): S {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(serverState ?? store.get()),
  );
}
