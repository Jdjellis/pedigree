import { describe, it, expect } from 'vitest';
import { midpoint, distance, boundingBox } from './geometry';

describe('midpoint', () => {
  it('returns the point halfway between two positions', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 });
  });

  it('handles negative coordinates', () => {
    expect(midpoint({ x: -4, y: -2 }, { x: 4, y: 6 })).toEqual({ x: 0, y: 2 });
  });

  it('is the same point when both inputs are identical', () => {
    expect(midpoint({ x: 3, y: 7 }, { x: 3, y: 7 })).toEqual({ x: 3, y: 7 });
  });
});

describe('distance', () => {
  it('computes a 3-4-5 right triangle hypotenuse', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('is zero for identical points', () => {
    expect(distance({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0);
  });

  it('is symmetric in its arguments', () => {
    const a = { x: 1, y: 9 };
    const b = { x: -5, y: 3 };
    expect(distance(a, b)).toBe(distance(b, a));
  });
});

describe('boundingBox', () => {
  it('returns an all-zero box for an empty list', () => {
    expect(boundingBox([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });

  it('collapses to a point for a single position', () => {
    expect(boundingBox([{ x: 5, y: -3 }])).toEqual({
      minX: 5,
      minY: -3,
      maxX: 5,
      maxY: -3,
    });
  });

  it('spans the extremes of many positions', () => {
    const box = boundingBox([
      { x: -10, y: 4 },
      { x: 2, y: -7 },
      { x: 8, y: 12 },
      { x: 0, y: 0 },
    ]);
    expect(box).toEqual({ minX: -10, minY: -7, maxX: 8, maxY: 12 });
  });
});
