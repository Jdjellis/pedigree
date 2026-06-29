import { describe, it, expect, afterEach, vi } from 'vitest';

/**
 * Regression guard for the "blank screen on a locked-down browser" bug.
 *
 * `useUIStore`'s initializer reads `localStorage` at module-evaluation time (to
 * seed `onboarded`). On browsers that block site data — e.g. Edge/Chrome under
 * an enterprise policy or private browsing — that access throws `SecurityError`.
 * Before the safeStorage guard, the throw happened during the import graph, so
 * React never mounted and the app rendered nothing. These tests re-import the
 * store under a throwing `localStorage` to lock in that bootstrap never crashes.
 */

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function setLocalStorage(value: unknown): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value,
    configurable: true,
    writable: true,
  });
}

/** A Storage whose every access throws, like a blocked browser profile. */
function blockedStorage(): Storage {
  const deny = (): never => {
    throw new DOMException('Access is denied for this document.', 'SecurityError');
  };
  return {
    get length(): number {
      return deny();
    },
    clear: deny,
    getItem: deny,
    key: deny,
    removeItem: deny,
    setItem: deny,
  } as unknown as Storage;
}

afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  vi.resetModules();
});

describe('uiStore bootstrap with blocked localStorage', () => {
  it('initializes the store without throwing when storage access is denied', async () => {
    setLocalStorage(blockedStorage());
    vi.resetModules();

    // A fresh import re-runs the module-level store initializer under the
    // blocked-storage condition — exactly what happens at app bootstrap.
    const mod = await import('./uiStore');

    // Reached this line ⇒ the module evaluated without throwing.
    expect(mod.useUIStore.getState().onboarded).toBe(false);
  });

  it('persists onboarding without throwing under blocked storage', async () => {
    setLocalStorage(blockedStorage());
    vi.resetModules();
    const mod = await import('./uiStore');

    expect(() => mod.useUIStore.getState().setOnboarded()).not.toThrow();
    expect(mod.useUIStore.getState().onboarded).toBe(true);
  });
});
