import { describe, it, expect } from 'vitest';
import { generateId } from './idGenerator';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('generateId', () => {
  it('produces a valid RFC-4122 v4 UUID', () => {
    expect(generateId()).toMatch(UUID_V4);
  });

  it('produces a unique value on each call', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateId()));
    expect(ids.size).toBe(1000);
  });
});
