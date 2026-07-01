import { describe, it, expect } from 'vitest';
import { consanguinityLines, partnershipMidpoint } from './partnershipGeometry';

describe('consanguinityLines', () => {
  it('offsets vertically for a same-generation (horizontal) union', () => {
    // Classic case: both partners share a y. The two lines sit gap/2 above and
    // below the union, spanning the same x range as the partners.
    const { a, b } = consanguinityLines({ x: 0, y: 100 }, { x: 200, y: 100 }, 4);
    // a is the +perpendicular line (perp of a rightward vector is (0, 1)).
    expect(a).toEqual([0, 102, 200, 102]);
    expect(b).toEqual([0, 98, 200, 98]);
  });

  it('keeps the offset perpendicular for a cross-generation union', () => {
    // A vertical union (partners stacked). The perpendicular is horizontal, so
    // the two lines flank the connector left/right and still touch both symbols'
    // y range — not float between them.
    const { a, b } = consanguinityLines({ x: 50, y: 0 }, { x: 50, y: 200 }, 4);
    expect(a).toEqual([48, 0, 48, 200]);
    expect(b).toEqual([52, 0, 52, 200]);
  });

  it('does not divide by zero for coincident points', () => {
    const { a, b } = consanguinityLines({ x: 10, y: 10 }, { x: 10, y: 10 }, 4);
    expect(a.every((n) => Number.isFinite(n))).toBe(true);
    expect(b.every((n) => Number.isFinite(n))).toBe(true);
  });
});

describe('partnershipMidpoint', () => {
  it('returns the average of the two points', () => {
    expect(partnershipMidpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 });
  });
});
