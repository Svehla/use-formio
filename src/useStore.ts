import { useState, useSyncExternalStore } from "react";

export type StoreAction<S> = S | ((prev: S) => S);

export type Store<S> = {
  /** synchronous and always fresh (also outside render, inside `act`, after unmount) */
  getState: () => S;
  /**
   * applies the action synchronously and notifies subscribers; returns the new state.
   * `Object.is`-equal results (e.g. `p => p`) are a no-op: nothing is notified, nothing rerenders.
   */
  setState: (action: StoreAction<S>) => S;
  subscribe: (listener: () => void) => () => void;
};

export const createStore = <S>(initialState: S): Store<S> => {
  let state = initialState;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    setState: action => {
      const next = action instanceof Function ? action(state) : action;
      if (Object.is(next, state)) return state;
      state = next;
      listeners.forEach(listener => listener());
      return next;
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
};

/**
 * Component-local external store bound to React via `useSyncExternalStore`.
 *
 * Compared to `useState`, the state lives outside of React so reading it (`store.getState()`)
 * never depends on a render happening: it works synchronously inside `act()`, after unmount,
 * during transitions and it is never a value of a discarded render. Writes are applied
 * synchronously (no updater double-invocation in StrictMode, no rebasing) and React just
 * rerenders with the latest snapshot.
 *
 * `init` runs once (lazy initialiser).
 */
export const useStore = <S>(init: () => S) => {
  const [store] = useState(() => createStore(init()));
  // the same getter is used as the server snapshot: the initial state is what SSR renders
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  return [state, store] as const;
};
