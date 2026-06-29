/**
 * A `localStorage` wrapper that never throws.
 *
 * Some browsers refuse storage access entirely — notably Edge/Chrome under an
 * enterprise "block site data" policy, strict tracking prevention, or private
 * browsing. In those environments even a *read* of `localStorage` raises
 * `SecurityError: Access is denied for this document.` An unguarded access at
 * app bootstrap then crashes before the first patient is seeded, leaving a blank
 * screen.
 *
 * This module degrades gracefully: every value is mirrored to an in-memory store
 * so the session keeps working (without cross-session persistence) when the real
 * backend is unavailable or over quota.
 */

const PROBE_KEY = '__pedigree_storage_probe__';

/** In-memory fallback, also used to round-trip values within a blocked session. */
const memory = new Map<string, string>();

/**
 * Read a value, preferring the real backend and falling back to the in-memory
 * mirror when storage access is blocked.
 *
 * @param key - The storage key.
 * @returns The stored string, or `null` when absent/unavailable.
 */
export function getItem(key: string): string | null {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return memory.has(key) ? (memory.get(key) as string) : null;
  }
}

/**
 * Write a value. Always mirrored to memory first so it round-trips within the
 * session even when the write-through to real storage is blocked or over quota.
 *
 * @param key - The storage key.
 * @param value - The value to store.
 * @returns `true` when the value persisted to the real backend, `false` when it
 *   was only kept in memory (storage blocked or over quota). Callers can use
 *   this to avoid claiming a durable save.
 */
export function setItem(key: string, value: string): boolean {
  memory.set(key, value);
  try {
    globalThis.localStorage.setItem(key, value);
    return true;
  } catch {
    // Storage blocked / full — the in-memory mirror above keeps the session working.
    return false;
  }
}

/**
 * Remove a value from both the real backend and the in-memory mirror.
 *
 * @param key - The storage key.
 */
export function removeItem(key: string): void {
  memory.delete(key);
  try {
    globalThis.localStorage.removeItem(key);
  } catch {
    // Storage blocked — nothing to remove from the real backend.
  }
}

/**
 * Whether writes actually persist across sessions (i.e. the real backend is
 * usable). Useful for UI that should not claim "Saved" when storage is blocked.
 *
 * @returns `true` when `localStorage` accepts a probe write, otherwise `false`.
 */
export function isPersistent(): boolean {
  try {
    globalThis.localStorage.setItem(PROBE_KEY, '1');
    globalThis.localStorage.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}
