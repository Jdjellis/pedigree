import { describe, it, expect, beforeEach } from 'vitest';
import {
  usePedigreeStore,
  createDefaultIndividual,
  createDefaultDocument,
} from './pedigreeStore';
import { RelationshipType, TwinType } from '../types/enums';
import type {
  Individual,
  PartnershipRelationship,
  ParentChildRelationship,
  TwinGroup,
  PedigreeDocument,
} from '../types/pedigree';

/**
 * Tier-2 coverage for the relationship-construction and teardown actions in
 * pedigreeStore. These assert STRUCTURAL / REFERENTIAL INTEGRITY of the
 * resulting document rather than layout geometry (which relayoutFamily owns and
 * is covered elsewhere).
 */

beforeEach(() => {
  usePedigreeStore.getState().resetDocument();
  usePedigreeStore.temporal.getState().clear();
});

const store = () => usePedigreeStore.getState();
const doc = () => usePedigreeStore.getState().document;

// --- fixture builders -------------------------------------------------------

let counter = 0;
const uid = (prefix: string) => `${prefix}-${counter++}`;

function person(overrides: Partial<Individual> = {}): Individual {
  return createDefaultIndividual({ id: uid('ind'), ...overrides });
}

function partnership(
  overrides: Partial<PartnershipRelationship> = {},
): PartnershipRelationship {
  return {
    id: uid('pa'),
    type: RelationshipType.Partnership,
    childrenIds: [],
    ...overrides,
  };
}

function link(
  parentPartnershipId: string,
  childId: string,
): ParentChildRelationship {
  return {
    id: uid('lk'),
    type: RelationshipType.ParentChild,
    parentPartnershipId,
    childId,
  };
}

/**
 * Assert the document has no dangling references anywhere: every id referenced
 * by a partnership / parent-child link / twin group must resolve to a live
 * individual or partnership, and no removed id must survive in generationOrder.
 */
function expectNoDanglingReferences(d: PedigreeDocument) {
  const individualIds = new Set(Object.keys(d.individuals));
  const partnershipIds = new Set(Object.keys(d.partnerships));

  for (const p of Object.values(d.partnerships)) {
    if (p.partner1Id) expect(individualIds.has(p.partner1Id)).toBe(true);
    if (p.partner2Id) expect(individualIds.has(p.partner2Id)).toBe(true);
    for (const cId of p.childrenIds) {
      expect(individualIds.has(cId)).toBe(true);
    }
  }

  for (const l of Object.values(d.parentChildLinks)) {
    expect(individualIds.has(l.childId)).toBe(true);
    expect(partnershipIds.has(l.parentPartnershipId)).toBe(true);
  }

  for (const tg of Object.values(d.twinGroups)) {
    for (const iId of tg.individualIds) {
      expect(individualIds.has(iId)).toBe(true);
    }
  }

  for (const gen of d.generationOrder) {
    for (const gId of gen) {
      expect(individualIds.has(gId)).toBe(true);
    }
  }
}

// ---------------------------------------------------------------------------
// addChildToFamily
// ---------------------------------------------------------------------------

describe('addChildToFamily', () => {
  it('appends the child to the union and creates a valid parent-child link', () => {
    const p1 = person();
    const p2 = person();
    const union = partnership({ partner1Id: p1.id, partner2Id: p2.id });
    const d = createDefaultDocument();
    d.individuals[p1.id] = p1;
    d.individuals[p2.id] = p2;
    d.partnerships[union.id] = union;
    store().setDocument(d);

    const child = person();
    const l = link(union.id, child.id);
    store().addChildToFamily(child, union.id, l);

    const after = doc();
    expect(after.individuals[child.id]).toBeDefined();
    expect(after.partnerships[union.id].childrenIds).toContain(child.id);
    expect(after.parentChildLinks[l.id]).toMatchObject({
      childId: child.id,
      parentPartnershipId: union.id,
    });
    expectNoDanglingReferences(after);
  });

  it('is a no-op for an unknown partnership id', () => {
    const d = createDefaultDocument();
    store().setDocument(d);
    const before = doc();

    const child = person();
    store().addChildToFamily(child, 'missing-union', link('missing-union', child.id));

    expect(doc()).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// addPartnerToIndividual
// ---------------------------------------------------------------------------

describe('addPartnerToIndividual', () => {
  it('inserts the partner and a union cross-referencing both individuals', () => {
    const target = person();
    const d = createDefaultDocument();
    d.individuals[target.id] = target;
    store().setDocument(d);

    const partner = person();
    const union = partnership({ partner1Id: target.id, partner2Id: partner.id });
    store().addPartnerToIndividual(partner, union);

    const after = doc();
    expect(after.individuals[partner.id]).toBeDefined();
    const u = after.partnerships[union.id];
    expect(u).toBeDefined();
    expect([u.partner1Id, u.partner2Id].sort()).toEqual(
      [target.id, partner.id].sort(),
    );
    expectNoDanglingReferences(after);
  });
});

// ---------------------------------------------------------------------------
// addParentsForChild
// ---------------------------------------------------------------------------

describe('addParentsForChild', () => {
  it('creates two parents, a union, and a link, pinning the child generation', () => {
    const child = person({ generation: 0 });
    const d = createDefaultDocument();
    d.individuals[child.id] = child;
    store().setDocument(d);

    const p1 = person();
    const p2 = person();
    const union = partnership({
      partner1Id: p1.id,
      partner2Id: p2.id,
      childrenIds: [child.id],
    });
    const l = link(union.id, child.id);
    store().addParentsForChild(p1, p2, union, l, child.id, -1);

    const after = doc();
    expect(after.individuals[p1.id]).toBeDefined();
    expect(after.individuals[p2.id]).toBeDefined();
    expect(after.individuals[child.id].generation).toBe(-1);
    expect(after.partnerships[union.id].childrenIds).toContain(child.id);
    expect(after.parentChildLinks[l.id]).toMatchObject({
      childId: child.id,
      parentPartnershipId: union.id,
    });
    expectNoDanglingReferences(after);
  });

  it('is a no-op when the child does not exist', () => {
    const d = createDefaultDocument();
    store().setDocument(d);
    const before = doc();

    const p1 = person();
    const p2 = person();
    const union = partnership({ partner1Id: p1.id, partner2Id: p2.id });
    store().addParentsForChild(p1, p2, union, link(union.id, 'ghost'), 'ghost', -1);

    expect(doc()).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// addSiblingViaNewUnion
// ---------------------------------------------------------------------------

describe('addSiblingViaNewUnion', () => {
  it('creates a childless union linking both the target and the new sibling', () => {
    // Target starts parentless; the new union becomes the parents of both the
    // target and the fresh sibling.
    const target = person({ generation: 0 });
    const d = createDefaultDocument();
    d.individuals[target.id] = target;
    store().setDocument(d);

    const sibling = person({ generation: 0 });
    const union = partnership({ childrenIds: [target.id, sibling.id] });
    const targetLink = link(union.id, target.id);
    const siblingLink = link(union.id, sibling.id);

    store().addSiblingViaNewUnion(target, sibling, union, targetLink, siblingLink);

    const after = doc();
    expect(after.individuals[sibling.id]).toBeDefined();
    expect(after.partnerships[union.id].childrenIds).toEqual(
      expect.arrayContaining([target.id, sibling.id]),
    );
    // Both links exist and reference the shared union.
    expect(after.parentChildLinks[targetLink.id]).toMatchObject({
      childId: target.id,
      parentPartnershipId: union.id,
    });
    expect(after.parentChildLinks[siblingLink.id]).toMatchObject({
      childId: sibling.id,
      parentPartnershipId: union.id,
    });
    expectNoDanglingReferences(after);
  });
});

// ---------------------------------------------------------------------------
// addChildViaNewUnion
// ---------------------------------------------------------------------------

describe('addChildViaNewUnion', () => {
  it('inserts a single-parent union and its descent link to the new child', () => {
    const parent = person({ generation: 0 });
    const d = createDefaultDocument();
    d.individuals[parent.id] = parent;
    store().setDocument(d);

    const child = person({ generation: 1 });
    const union = partnership({ partner1Id: parent.id, childrenIds: [child.id] });
    const l = link(union.id, child.id);

    store().addChildViaNewUnion(child, union, l);

    const after = doc();
    expect(after.individuals[child.id]).toBeDefined();
    expect(after.partnerships[union.id].partner1Id).toBe(parent.id);
    expect(after.partnerships[union.id].childrenIds).toContain(child.id);
    expect(after.parentChildLinks[l.id]).toMatchObject({
      childId: child.id,
      parentPartnershipId: union.id,
    });
    expectNoDanglingReferences(after);
  });
});

// ---------------------------------------------------------------------------
// fillUnionPartner
// ---------------------------------------------------------------------------

describe('fillUnionPartner', () => {
  it('fills the empty partner1 slot without disturbing the existing partner2', () => {
    const existing = person({ generation: 0 });
    const union = partnership({ partner1Id: undefined, partner2Id: existing.id });
    const d = createDefaultDocument();
    d.individuals[existing.id] = existing;
    d.partnerships[union.id] = union;
    store().setDocument(d);

    const filler = person({ generation: 0 });
    store().fillUnionPartner(filler, union.id);

    const after = doc();
    expect(after.individuals[filler.id]).toBeDefined();
    const u = after.partnerships[union.id];
    expect(u.partner1Id).toBe(filler.id);
    expect(u.partner2Id).toBe(existing.id);
    expectNoDanglingReferences(after);
  });

  it('fills the empty partner2 slot without disturbing the existing partner1', () => {
    const existing = person({ generation: 0 });
    const union = partnership({ partner1Id: existing.id, partner2Id: undefined });
    const d = createDefaultDocument();
    d.individuals[existing.id] = existing;
    d.partnerships[union.id] = union;
    store().setDocument(d);

    const filler = person({ generation: 0 });
    store().fillUnionPartner(filler, union.id);

    const after = doc();
    const u = after.partnerships[union.id];
    expect(u.partner1Id).toBe(existing.id);
    expect(u.partner2Id).toBe(filler.id);
    expectNoDanglingReferences(after);
  });

  it('is a no-op for an unknown partnership id', () => {
    const d = createDefaultDocument();
    store().setDocument(d);
    const before = doc();

    store().fillUnionPartner(person(), 'missing-union');

    expect(doc()).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// addParentsToParentlessUnion
// ---------------------------------------------------------------------------

describe('addParentsToParentlessUnion', () => {
  it('fills both empty partner slots of a bare sibship union', () => {
    // A bare sibship: a childless-of-partners union that only holds siblings.
    const childA = person({ generation: 0 });
    const childB = person({ generation: 0 });
    const union = partnership({
      partner1Id: undefined,
      partner2Id: undefined,
      childrenIds: [childA.id, childB.id],
    });
    const d = createDefaultDocument();
    d.individuals[childA.id] = childA;
    d.individuals[childB.id] = childB;
    d.partnerships[union.id] = union;
    d.parentChildLinks['la'] = link(union.id, childA.id);
    d.parentChildLinks['lb'] = link(union.id, childB.id);
    store().setDocument(d);

    const p1 = person({ generation: -1 });
    const p2 = person({ generation: -1 });
    store().addParentsToParentlessUnion(p1, p2, union.id);

    const after = doc();
    const u = after.partnerships[union.id];
    expect(u.partner1Id).toBe(p1.id);
    expect(u.partner2Id).toBe(p2.id);
    // The existing sibship children are preserved.
    expect(u.childrenIds).toEqual(
      expect.arrayContaining([childA.id, childB.id]),
    );
    expect(after.individuals[p1.id]).toBeDefined();
    expect(after.individuals[p2.id]).toBeDefined();
    expectNoDanglingReferences(after);
  });

  it('is a no-op for an unknown partnership id', () => {
    const d = createDefaultDocument();
    store().setDocument(d);
    const before = doc();

    store().addParentsToParentlessUnion(person(), person(), 'missing-union');

    expect(doc()).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// removeIndividual — cascade cleanup
// ---------------------------------------------------------------------------

describe('removeIndividual (cascade cleanup)', () => {
  /**
   * Build a two-parent family with two children plus a twin group over the
   * children, all wired with links, so cascade behaviour can be exercised.
   */
  function seedFamily() {
    const father = person({ generation: -1 });
    const mother = person({ generation: -1 });
    const childA = person({ generation: 0 });
    const childB = person({ generation: 0 });
    const union = partnership({
      partner1Id: father.id,
      partner2Id: mother.id,
      childrenIds: [childA.id, childB.id],
    });
    const linkA = link(union.id, childA.id);
    const linkB = link(union.id, childB.id);
    const tg: TwinGroup = {
      id: uid('tg'),
      twinType: TwinType.Dizygotic,
      individualIds: [childA.id, childB.id],
      parentPartnershipId: union.id,
    };

    const d = createDefaultDocument();
    d.individuals[father.id] = father;
    d.individuals[mother.id] = mother;
    d.individuals[childA.id] = childA;
    d.individuals[childB.id] = childB;
    d.partnerships[union.id] = union;
    d.parentChildLinks[linkA.id] = linkA;
    d.parentChildLinks[linkB.id] = linkB;
    d.twinGroups[tg.id] = tg;
    d.generationOrder = [
      [father.id, mother.id],
      [childA.id, childB.id],
    ];
    store().setDocument(d);

    return { father, mother, childA, childB, union, linkA, linkB, tg };
  }

  it('removes the individual and leaves NO dangling references', () => {
    const { childA } = seedFamily();
    store().removeIndividual(childA.id);

    const after = doc();
    expect(after.individuals[childA.id]).toBeUndefined();
    expectNoDanglingReferences(after);
  });

  it('detaches a removed partner from the union but keeps the union (other partner + children remain)', () => {
    const { father, mother, union } = seedFamily();
    store().removeIndividual(father.id);

    const after = doc();
    const u = after.partnerships[union.id];
    expect(u).toBeDefined();
    // Removed partner's slot is cleared; surviving partner keeps their slot.
    expect(u.partner1Id).toBeUndefined();
    expect(u.partner2Id).toBe(mother.id);
    expectNoDanglingReferences(after);
  });

  it('drops the removed child from union.childrenIds and its parent-child link', () => {
    const { childA, childB, union, linkA, linkB } = seedFamily();
    store().removeIndividual(childA.id);

    const after = doc();
    const u = after.partnerships[union.id];
    expect(u.childrenIds).not.toContain(childA.id);
    expect(u.childrenIds).toContain(childB.id);
    // The link for the removed child is gone; the sibling's link survives.
    expect(after.parentChildLinks[linkA.id]).toBeUndefined();
    expect(after.parentChildLinks[linkB.id]).toBeDefined();
  });

  it('shrinks a twin group when a member is removed but keeps it at >=2 members', () => {
    // Seed a triplet twin group so removing one still leaves two members.
    const father = person({ generation: -1 });
    const mother = person({ generation: -1 });
    const t1 = person({ generation: 0 });
    const t2 = person({ generation: 0 });
    const t3 = person({ generation: 0 });
    const union = partnership({
      partner1Id: father.id,
      partner2Id: mother.id,
      childrenIds: [t1.id, t2.id, t3.id],
    });
    const tg: TwinGroup = {
      id: uid('tg'),
      twinType: TwinType.Monozygotic,
      individualIds: [t1.id, t2.id, t3.id],
      parentPartnershipId: union.id,
    };
    const d = createDefaultDocument();
    for (const p of [father, mother, t1, t2, t3]) d.individuals[p.id] = p;
    d.partnerships[union.id] = union;
    d.parentChildLinks['l1'] = link(union.id, t1.id);
    d.parentChildLinks['l2'] = link(union.id, t2.id);
    d.parentChildLinks['l3'] = link(union.id, t3.id);
    d.twinGroups[tg.id] = tg;
    store().setDocument(d);

    store().removeIndividual(t1.id);

    const after = doc();
    expect(after.twinGroups[tg.id]).toBeDefined();
    expect(after.twinGroups[tg.id].individualIds).toEqual(
      expect.arrayContaining([t2.id, t3.id]),
    );
    expect(after.twinGroups[tg.id].individualIds).not.toContain(t1.id);
    expectNoDanglingReferences(after);
  });

  it('deletes a twin group entirely once it would drop below 2 members', () => {
    const { childA, tg } = seedFamily(); // twin group over {childA, childB}
    store().removeIndividual(childA.id);

    const after = doc();
    // Only childB would remain -> group deleted.
    expect(after.twinGroups[tg.id]).toBeUndefined();
    expectNoDanglingReferences(after);
  });

  it('prunes a union that would keep exactly one partner and no children', () => {
    // A couple with no children: removing one partner leaves a lone partner,
    // which the pruning rule (partnerCount===1 needs >=1 child) drops.
    const a = person({ generation: 0 });
    const b = person({ generation: 0 });
    const union = partnership({ partner1Id: a.id, partner2Id: b.id });
    const d = createDefaultDocument();
    d.individuals[a.id] = a;
    d.individuals[b.id] = b;
    d.partnerships[union.id] = union;
    store().setDocument(d);

    store().removeIndividual(a.id);

    const after = doc();
    expect(after.partnerships[union.id]).toBeUndefined();
    expectNoDanglingReferences(after);
  });

  it('prunes a bare-sibship union that would drop to a single child, cascading its links', () => {
    // No-partner union holding two siblings; remove one -> one child left ->
    // union no longer draws a meaningful connector -> pruned, and its remaining
    // child-link must be cascaded away (it references the deleted partnership).
    const s1 = person({ generation: 0 });
    const s2 = person({ generation: 0 });
    const union = partnership({
      partner1Id: undefined,
      partner2Id: undefined,
      childrenIds: [s1.id, s2.id],
    });
    const l1 = link(union.id, s1.id);
    const l2 = link(union.id, s2.id);
    const d = createDefaultDocument();
    d.individuals[s1.id] = s1;
    d.individuals[s2.id] = s2;
    d.partnerships[union.id] = union;
    d.parentChildLinks[l1.id] = l1;
    d.parentChildLinks[l2.id] = l2;
    store().setDocument(d);

    store().removeIndividual(s1.id);

    const after = doc();
    // Union pruned...
    expect(after.partnerships[union.id]).toBeUndefined();
    // ...and the surviving sibling's link is cascaded away (its partnership is gone).
    expect(after.parentChildLinks[l2.id]).toBeUndefined();
    // s2 the individual survives even though its link/union are gone.
    expect(after.individuals[s2.id]).toBeDefined();
    expectNoDanglingReferences(after);
  });

  it('keeps a bare-sibship union of three when one sibling is removed (>=2 children remain)', () => {
    const s1 = person({ generation: 0 });
    const s2 = person({ generation: 0 });
    const s3 = person({ generation: 0 });
    const union = partnership({
      partner1Id: undefined,
      partner2Id: undefined,
      childrenIds: [s1.id, s2.id, s3.id],
    });
    const d = createDefaultDocument();
    for (const p of [s1, s2, s3]) d.individuals[p.id] = p;
    d.partnerships[union.id] = union;
    d.parentChildLinks['l1'] = link(union.id, s1.id);
    d.parentChildLinks['l2'] = link(union.id, s2.id);
    d.parentChildLinks['l3'] = link(union.id, s3.id);
    store().setDocument(d);

    store().removeIndividual(s1.id);

    const after = doc();
    const u = after.partnerships[union.id];
    expect(u).toBeDefined();
    expect(u.childrenIds).toEqual(expect.arrayContaining([s2.id, s3.id]));
    expect(u.childrenIds).not.toContain(s1.id);
    // Links for the survivors remain; the removed child's link is gone.
    expect(after.parentChildLinks['l1']).toBeUndefined();
    expect(after.parentChildLinks['l2']).toBeDefined();
    expect(after.parentChildLinks['l3']).toBeDefined();
    expectNoDanglingReferences(after);
  });

  it('removes the individual from every generationOrder row', () => {
    const { father } = seedFamily();
    store().removeIndividual(father.id);

    const after = doc();
    for (const gen of after.generationOrder) {
      expect(gen).not.toContain(father.id);
    }
    expectNoDanglingReferences(after);
  });

  it('records a single undoable step that restores the full family', () => {
    const { childA } = seedFamily();

    store().removeIndividual(childA.id);
    expect(doc().individuals[childA.id]).toBeUndefined();

    usePedigreeStore.temporal.getState().undo();
    expect(doc().individuals[childA.id]).toBeDefined();
    expectNoDanglingReferences(doc());
  });
});
