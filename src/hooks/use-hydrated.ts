"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True after hydration. Guards UI that reads persisted (localStorage) state. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
