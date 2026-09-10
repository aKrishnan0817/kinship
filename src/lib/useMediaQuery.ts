"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Matches a CSS media query in JS, for the few places CSS alone can't reach —
 * mainly handing pixel padding to the canvas so it frames around the mobile
 * chrome. Renders as a non-match on the server, so treat desktop as the
 * default shape and let mobile correct itself on hydration.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
