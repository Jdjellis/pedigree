/**
 * Tests for createPatternCanvas.
 *
 * createPatternCanvas draws into a 2D canvas context. jsdom's canvas backend
 * does not implement getContext('2d') (it returns null), which makes the
 * function throw. We detect that capability once and skip the drawing-dependent
 * assertions when it is unavailable, keeping the suite green in a bare jsdom
 * environment while still exercising the logic wherever a real 2D context exists
 * (e.g. jsdom-canvas or a browser test runner).
 *
 * We deliberately assert only on canvas tile dimensions and the module-level
 * cache identity — never rendered pixel contents, which jsdom cannot produce.
 */
import { describe, it, expect } from 'vitest';
import { createPatternCanvas } from './fillPatterns';
import type { FillPatternType } from '../types/pedigree';

const ALL_PATTERNS: FillPatternType[] = [
  'solid',
  'diagonalLines',
  'dots',
  'crosshatch',
  'horizontalStripes',
  'verticalStripes',
];

/** True when this environment provides a usable 2D canvas context. */
const HAS_2D_CONTEXT = (() => {
  try {
    return document.createElement('canvas').getContext('2d') !== null;
  } catch {
    return false;
  }
})();

const describeIf2d = HAS_2D_CONTEXT ? describe : describe.skip;

describeIf2d('createPatternCanvas', () => {
  it.each(ALL_PATTERNS)(
    'returns a canvas sized to the tile for pattern %s (default tileSize 8)',
    (pattern) => {
      const canvas = createPatternCanvas(pattern, '#123456');
      expect(canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(canvas.width).toBe(8);
      expect(canvas.height).toBe(8);
    },
  );

  it('honours a custom tileSize', () => {
    const canvas = createPatternCanvas('dots', '#ff0000', 16);
    expect(canvas.width).toBe(16);
    expect(canvas.height).toBe(16);
  });

  it('returns the same cached canvas instance for identical (patternType, color, tileSize)', () => {
    const a = createPatternCanvas('crosshatch', '#abcdef', 12);
    const b = createPatternCanvas('crosshatch', '#abcdef', 12);
    expect(b).toBe(a);
  });

  it('returns different instances when any cache-key component differs', () => {
    const base = createPatternCanvas('solid', '#000000', 8);
    const diffPattern = createPatternCanvas('dots', '#000000', 8);
    const diffColor = createPatternCanvas('solid', '#111111', 8);
    const diffSize = createPatternCanvas('solid', '#000000', 10);

    expect(diffPattern).not.toBe(base);
    expect(diffColor).not.toBe(base);
    expect(diffSize).not.toBe(base);
  });
});

// A guard-level check that always runs, documenting why the suite may be skipped.
describe('fillPatterns environment', () => {
  it('either has a 2D context (suite runs) or is skipped intentionally', () => {
    expect(typeof HAS_2D_CONTEXT).toBe('boolean');
  });
});
