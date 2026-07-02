import { describe, it, expect } from 'vitest';
import {
  finalPositions, noSymbolOverlap, minSiblingSpacing, minPartnerSpacing,
  generationRowAlignment, noCrossedDescentLines, subtreeNonCollision,
  manualOrderPreserved, twinContiguity, anchorStability,
} from './invariants';
import type { LayoutDoc } from '../treeLayout';
import type { Individual, PartnershipRelationship, ParentChildRelationship, TwinGroup } from '../../types/pedigree';
import { RelationshipType, TwinType } from '../../types/enums';
import { createDefaultIndividual } from '../../stores/pedigreeStore';

function ind(id: string, x: number, generation = 0): Individual {
  return createDefaultIndividual({ id, generation, position: { x, y: generation * 150 } });
}
function union(id: string, p1: string | undefined, p2: string | undefined, kids: string[] = []): PartnershipRelationship {
  return { id, type: RelationshipType.Partnership, partner1Id: p1, partner2Id: p2, childrenIds: kids };
}
function link(id: string, parentPartnershipId: string, childId: string): ParentChildRelationship {
  return { id, type: RelationshipType.ParentChild, parentPartnershipId, childId, isAdoptive: false };
}
function doc(p: Partial<LayoutDoc>): LayoutDoc {
  return { individuals: p.individuals ?? {}, partnerships: p.partnerships ?? {}, parentChildLinks: p.parentChildLinks ?? {} };
}

describe('finalPositions', () => {
  it('merges the move-map over current positions', () => {
    const d = doc({ individuals: { a: ind('a', 10, 0), b: ind('b', 20, 1) } });
    expect(finalPositions(d, { a: { x: 99, y: 0 } })).toEqual({ a: { x: 99, y: 0 }, b: { x: 20, y: 150 } });
  });
});

describe('noSymbolOverlap', () => {
  it('flags two same-generation nodes closer than SYMBOL_SIZE', () => {
    const d = doc({ individuals: { a: ind('a', 0, 0), b: ind('b', 30, 0) } });
    expect(noSymbolOverlap({ a: { x: 0, y: 0 }, b: { x: 30, y: 0 } }, d).ok).toBe(false);
  });
  it('passes when same-generation nodes are >= SYMBOL_SIZE apart', () => {
    const d = doc({ individuals: { a: ind('a', 0, 0), b: ind('b', 40, 0) } });
    expect(noSymbolOverlap({ a: { x: 0, y: 0 }, b: { x: 40, y: 0 } }, d).ok).toBe(true);
  });
});

describe('minSiblingSpacing', () => {
  it('flags adjacent siblings closer than SIBLING_SPACING', () => {
    const d = doc({
      individuals: { p: ind('p', 0, 0), a: ind('a', 0, 1), b: ind('b', 50, 1) },
      partnerships: { u: union('u', 'p', undefined, ['a', 'b']) },
      parentChildLinks: { la: link('la', 'u', 'a'), lb: link('lb', 'u', 'b') },
    });
    expect(minSiblingSpacing({ p: { x: 0, y: 0 }, a: { x: 0, y: 150 }, b: { x: 50, y: 150 } }, d).ok).toBe(false);
  });
});

describe('minPartnerSpacing', () => {
  it('flags an ordinary couple not exactly PARTNER_SPACING apart', () => {
    const d = doc({ individuals: { a: ind('a', 0, 0), b: ind('b', 90, 0) }, partnerships: { u: union('u', 'a', 'b', []) } });
    expect(minPartnerSpacing({ a: { x: 0, y: 0 }, b: { x: 90, y: 0 } }, d).ok).toBe(false);
  });
  it('exempts a couple with a load-bearing in-law (wide couple)', () => {
    const d = doc({
      individuals: { blood: ind('blood', 0, 1), inlaw: ind('inlaw', 300, 1), ilp: ind('ilp', 300, 0) },
      partnerships: { mar: union('mar', 'blood', 'inlaw', []), ilU: union('ilU', 'ilp', undefined, ['inlaw']) },
      parentChildLinks: { b: link('b', 'ilU', 'inlaw') },
    });
    expect(minPartnerSpacing({ blood: { x: 0, y: 150 }, inlaw: { x: 300, y: 150 }, ilp: { x: 300, y: 0 } }, d).ok).toBe(true);
  });
});

describe('generationRowAlignment', () => {
  it('flags siblings that are not on the same row (undefined-generation bug)', () => {
    const d = doc({
      individuals: { p: ind('p', 0, 0), a: ind('a', -80, 1), b: ind('b', 80, 1) },
      partnerships: { u: union('u', 'p', undefined, ['a', 'b']) },
      parentChildLinks: { la: link('la', 'u', 'a'), lb: link('lb', 'u', 'b') },
    });
    // b collapsed onto the parent row (y=0) instead of y=150.
    expect(generationRowAlignment({ p: { x: 0, y: 0 }, a: { x: -80, y: 150 }, b: { x: 80, y: 0 } }, d).ok).toBe(false);
  });
  it('passes when all children of a union share a y', () => {
    const d = doc({
      individuals: { p: ind('p', 0, 0), a: ind('a', -80, 1), b: ind('b', 80, 1) },
      partnerships: { u: union('u', 'p', undefined, ['a', 'b']) },
      parentChildLinks: { la: link('la', 'u', 'a'), lb: link('lb', 'u', 'b') },
    });
    expect(generationRowAlignment({ p: { x: 0, y: 0 }, a: { x: -80, y: 150 }, b: { x: 80, y: 150 } }, d).ok).toBe(true);
  });
});

describe('noCrossedDescentLines', () => {
  it('flags cousin sibships whose order is inverted relative to their parents', () => {
    // union u1 (parent at x=0) left of u2 (parent at x=200); but u1 child sits RIGHT of u2 child.
    const d = doc({
      individuals: {
        p1: ind('p1', 0, 1), p2: ind('p2', 200, 1),
        c1: ind('c1', 180, 2), c2: ind('c2', 20, 2),
      },
      partnerships: { u1: union('u1', 'p1', undefined, ['c1']), u2: union('u2', 'p2', undefined, ['c2']) },
      parentChildLinks: { a: link('a', 'u1', 'c1'), b: link('b', 'u2', 'c2') },
    });
    const pos = { p1: { x: 0, y: 150 }, p2: { x: 200, y: 150 }, c1: { x: 180, y: 300 }, c2: { x: 20, y: 300 } };
    expect(noCrossedDescentLines(pos, d).ok).toBe(false);
  });
  it('passes when cousins are in the same left-to-right order as their parents', () => {
    const d = doc({
      individuals: {
        p1: ind('p1', 0, 1), p2: ind('p2', 200, 1),
        c1: ind('c1', 20, 2), c2: ind('c2', 180, 2),
      },
      partnerships: { u1: union('u1', 'p1', undefined, ['c1']), u2: union('u2', 'p2', undefined, ['c2']) },
      parentChildLinks: { a: link('a', 'u1', 'c1'), b: link('b', 'u2', 'c2') },
    });
    const pos = { p1: { x: 0, y: 150 }, p2: { x: 200, y: 150 }, c1: { x: 20, y: 300 }, c2: { x: 180, y: 300 } };
    expect(noCrossedDescentLines(pos, d).ok).toBe(true);
  });
});

describe('subtreeNonCollision', () => {
  it('flags two cousin sibships whose x-extents overlap', () => {
    const d = doc({
      individuals: {
        p1: ind('p1', 0, 1), p2: ind('p2', 200, 1),
        a1: ind('a1', 0, 2), a2: ind('a2', 100, 2),
        b1: ind('b1', 90, 2), b2: ind('b2', 190, 2),
      },
      partnerships: { u1: union('u1', 'p1', undefined, ['a1', 'a2']), u2: union('u2', 'p2', undefined, ['b1', 'b2']) },
      parentChildLinks: { la1: link('la1', 'u1', 'a1'), la2: link('la2', 'u1', 'a2'), lb1: link('lb1', 'u2', 'b1'), lb2: link('lb2', 'u2', 'b2') },
    });
    const pos = { p1: { x: 0, y: 150 }, p2: { x: 200, y: 150 }, a1: { x: 0, y: 300 }, a2: { x: 100, y: 300 }, b1: { x: 90, y: 300 }, b2: { x: 190, y: 300 } };
    expect(subtreeNonCollision(pos, d).ok).toBe(false);
  });
});

describe('manualOrderPreserved', () => {
  it('flags a sibling order that inverts the input x order', () => {
    const d = doc({
      individuals: { p: ind('p', 0, 0), a: ind('a', 0, 1), b: ind('b', 80, 1) },
      partnerships: { u: union('u', 'p', undefined, ['a', 'b']) },
      parentChildLinks: { la: link('la', 'u', 'a'), lb: link('lb', 'u', 'b') },
    });
    // input: a(0) < b(80); output flips them.
    expect(manualOrderPreserved(d, { p: { x: 0, y: 0 }, a: { x: 80, y: 150 }, b: { x: 0, y: 150 } }).ok).toBe(false);
  });
  it('passes when output sibling order agrees with input x order', () => {
    const d = doc({
      individuals: { p: ind('p', 0, 0), a: ind('a', 0, 1), b: ind('b', 80, 1) },
      partnerships: { u: union('u', 'p', undefined, ['a', 'b']) },
      parentChildLinks: { la: link('la', 'u', 'a'), lb: link('lb', 'u', 'b') },
    });
    // input: a(0) < b(80); output keeps that order (a left of b).
    expect(manualOrderPreserved(d, { p: { x: 0, y: 0 }, a: { x: -40, y: 150 }, b: { x: 40, y: 150 } }).ok).toBe(true);
  });
});

describe('twinContiguity', () => {
  it('flags a non-twin sibling ordered between two twins', () => {
    const d = doc({
      individuals: { p: ind('p', 0, 0), t1: ind('t1', 0, 1), s: ind('s', 80, 1), t2: ind('t2', 160, 1) },
      partnerships: { u: union('u', 'p', undefined, ['t1', 's', 't2']) },
      parentChildLinks: { l1: link('l1', 'u', 't1'), l2: link('l2', 'u', 's'), l3: link('l3', 'u', 't2') },
    });
    // NOTE: TwinGroup uses `twinType` and `individualIds` (not `type`/`memberIds`); also requires `parentPartnershipId`.
    const tg: Record<string, TwinGroup> = { g: { id: 'g', twinType: TwinType.Monozygotic, individualIds: ['t1', 't2'], parentPartnershipId: 'u' } };
    const pos = { p: { x: 0, y: 0 }, t1: { x: 0, y: 150 }, s: { x: 80, y: 150 }, t2: { x: 160, y: 150 } };
    expect(twinContiguity(pos, d, tg).ok).toBe(false);
  });
});

describe('anchorStability', () => {
  it('passes when the anchor id is absent from the move-map', () => {
    const d = doc({ individuals: { a: ind('a', 10, 0) } });
    expect(anchorStability(d, {}, 'a').ok).toBe(true);
  });
  it('flags an anchor id that moved', () => {
    const d = doc({ individuals: { a: ind('a', 10, 0) } });
    expect(anchorStability(d, { a: { x: 99, y: 0 } }, 'a').ok).toBe(false);
  });
});
