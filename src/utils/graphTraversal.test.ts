import { describe, it, expect } from 'vitest';
import {
  findParents,
  findChildren,
  findSiblings,
  findPartnerships,
  hasParents,
  hasPartnership,
} from './graphTraversal';
import { RelationshipType } from '../types/enums';
import { createDefaultDocument, createDefaultIndividual } from '../stores/pedigreeStore';
import type { PedigreeDocument } from '../types/pedigree';

/**
 * Builds a small nuclear family:
 *   father + mother (partnership) -> child1, child2
 * plus an unrelated `loner` with no relationships.
 */
function makeFamily(): {
  doc: PedigreeDocument;
  fatherId: string;
  motherId: string;
  child1Id: string;
  child2Id: string;
  lonerId: string;
  partnershipId: string;
} {
  const doc = createDefaultDocument();

  const father = createDefaultIndividual();
  const mother = createDefaultIndividual();
  const child1 = createDefaultIndividual();
  const child2 = createDefaultIndividual();
  const loner = createDefaultIndividual();

  for (const ind of [father, mother, child1, child2, loner]) {
    doc.individuals[ind.id] = ind;
  }

  const partnershipId = 'p1';
  doc.partnerships[partnershipId] = {
    id: partnershipId,
    type: RelationshipType.Partnership,
    partner1Id: father.id,
    partner2Id: mother.id,
    childrenIds: [child1.id, child2.id],
  };

  for (const childId of [child1.id, child2.id]) {
    const linkId = `link-${childId}`;
    doc.parentChildLinks[linkId] = {
      id: linkId,
      type: RelationshipType.ParentChild,
      parentPartnershipId: partnershipId,
      childId,
      isAdopted: false,
    };
  }

  return {
    doc,
    fatherId: father.id,
    motherId: mother.id,
    child1Id: child1.id,
    child2Id: child2.id,
    lonerId: loner.id,
    partnershipId,
  };
}

describe('findParents', () => {
  it('returns both partners and the partnership for a child', () => {
    const { doc, fatherId, motherId, child1Id, partnershipId } = makeFamily();
    const parents = findParents(doc, child1Id);
    expect(parents.father?.id).toBe(fatherId);
    expect(parents.mother?.id).toBe(motherId);
    expect(parents.partnershipId).toBe(partnershipId);
  });

  it('returns an empty object for an individual with no parent link', () => {
    const { doc, lonerId } = makeFamily();
    expect(findParents(doc, lonerId)).toEqual({});
  });

  it('skips a link whose partnership has been deleted', () => {
    const { doc, child1Id, partnershipId } = makeFamily();
    delete doc.partnerships[partnershipId];
    expect(findParents(doc, child1Id)).toEqual({});
  });
});

describe('findChildren', () => {
  it('returns every child of any partnership the individual is in', () => {
    const { doc, fatherId, motherId, child1Id, child2Id } = makeFamily();
    expect(findChildren(doc, fatherId).map((c) => c.id).sort()).toEqual(
      [child1Id, child2Id].sort(),
    );
    // mother is the other partner — same children.
    expect(findChildren(doc, motherId).map((c) => c.id).sort()).toEqual(
      [child1Id, child2Id].sort(),
    );
  });

  it('returns an empty array for someone with no partnerships', () => {
    const { doc, lonerId } = makeFamily();
    expect(findChildren(doc, lonerId)).toEqual([]);
  });

  it('ignores child ids that no longer resolve to an individual', () => {
    const { doc, fatherId, child2Id } = makeFamily();
    delete doc.individuals[child2Id];
    const children = findChildren(doc, fatherId);
    expect(children.map((c) => c.id)).not.toContain(child2Id);
    expect(children).toHaveLength(1);
  });
});

describe('findSiblings', () => {
  it('returns the other children of the same partnership', () => {
    const { doc, child1Id, child2Id } = makeFamily();
    const siblings = findSiblings(doc, child1Id);
    expect(siblings.map((s) => s.id)).toEqual([child2Id]);
  });

  it('excludes the individual themselves', () => {
    const { doc, child1Id } = makeFamily();
    expect(findSiblings(doc, child1Id).map((s) => s.id)).not.toContain(child1Id);
  });

  it('returns an empty array when the individual has no parents', () => {
    const { doc, fatherId } = makeFamily();
    expect(findSiblings(doc, fatherId)).toEqual([]);
  });
});

describe('findPartnerships', () => {
  it('returns ids of partnerships the individual belongs to', () => {
    const { doc, fatherId, partnershipId } = makeFamily();
    expect(findPartnerships(doc, fatherId)).toEqual([partnershipId]);
  });

  it('returns an empty array for an unpartnered individual', () => {
    const { doc, lonerId } = makeFamily();
    expect(findPartnerships(doc, lonerId)).toEqual([]);
  });
});

describe('hasParents', () => {
  it('is true for a child with a parent link and false otherwise', () => {
    const { doc, child1Id, fatherId } = makeFamily();
    expect(hasParents(doc, child1Id)).toBe(true);
    expect(hasParents(doc, fatherId)).toBe(false);
  });
});

describe('hasPartnership', () => {
  it('is true for a partnered individual and false for a loner', () => {
    const { doc, fatherId, lonerId } = makeFamily();
    expect(hasPartnership(doc, fatherId)).toBe(true);
    expect(hasPartnership(doc, lonerId)).toBe(false);
  });
});
