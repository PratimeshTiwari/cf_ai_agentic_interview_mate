import { useRef } from "react";

/**
 * Returns the most recent non-undefined value. Agent state is briefly
 * undefined while the WebSocket reconnects; holding on to the last synced
 * state keeps the UI (and any in-progress form input) mounted meanwhile.
 */
export function useLastDefined<T>(value: T | undefined): T | undefined {
  const ref = useRef(value);
  if (value !== undefined) ref.current = value;
  return ref.current;
}
