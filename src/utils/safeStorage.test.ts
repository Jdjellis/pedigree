import { describe, it, expect, afterEach } from 'vitest';
import { getItem, setItem, removeItem, isPersistent } from './safeStorage';

/**
 * Swap the global `localStorage` for a test double. Returns nothing — call
 * `restoreLocalStorage` (registered in afterEach) to put the jsdom shim back.
 */
function setLocalStorage(value: unknown): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value,
    configurable: true,
    writable: true,
  });
}

/** A minimal working Storage backed by a Map, for the happy path. */
function workingStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length(): number {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => void store.delete(k),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
  };
}

/**
 * A Storage whose every access throws — simulates Edge/Chrome under an
 * enterprise "block site data" policy (or private browsing), where even a read
 * raises `SecurityError: Access is denied for this document.`
 */
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

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
});

describe('safeStorage when localStorage works', () => {
  it('writes values through to the real backend', () => {
    const backend = workingStorage();
    setLocalStorage(backend);

    setItem('working-write', 'value');

    expect(backend.getItem('working-write')).toBe('value');
    expect(getItem('working-write')).toBe('value');
  });

  it('removes values from the real backend', () => {
    const backend = workingStorage();
    setLocalStorage(backend);

    setItem('working-remove', 'value');
    removeItem('working-remove');

    expect(getItem('working-remove')).toBeNull();
    expect(backend.getItem('working-remove')).toBeNull();
  });

  it('reports that storage is persistent', () => {
    setLocalStorage(workingStorage());
    expect(isPersistent()).toBe(true);
  });

  it('returns true from setItem when the write persists', () => {
    setLocalStorage(workingStorage());
    expect(setItem('persisted-write', 'value')).toBe(true);
  });
});

describe('safeStorage when localStorage is blocked', () => {
  it('returns null from getItem instead of throwing', () => {
    setLocalStorage(blockedStorage());

    expect(() => getItem('blocked-read')).not.toThrow();
    expect(getItem('blocked-read')).toBeNull();
  });

  it('does not throw from setItem and keeps the value for the session', () => {
    setLocalStorage(blockedStorage());

    expect(() => setItem('blocked-write', 'value')).not.toThrow();
    expect(getItem('blocked-write')).toBe('value');
  });

  it('does not throw from removeItem', () => {
    setLocalStorage(blockedStorage());
    setItem('blocked-delete', 'value');

    expect(() => removeItem('blocked-delete')).not.toThrow();
    expect(getItem('blocked-delete')).toBeNull();
  });

  it('reports that storage is not persistent', () => {
    setLocalStorage(blockedStorage());
    expect(isPersistent()).toBe(false);
  });

  it('returns false from setItem when the write does not persist', () => {
    setLocalStorage(blockedStorage());
    expect(setItem('blocked-write-return', 'value')).toBe(false);
  });
});
