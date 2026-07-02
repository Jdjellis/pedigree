import { describe, it, expect, beforeEach } from 'vitest';
import { usePedigreeStore, createDefaultIndividual } from '../../stores/pedigreeStore';
import { RelationshipType } from '../../types/enums';
import type { PartnershipRelationship } from '../../types/pedigree';
import { eraseElementById } from './eraserTool';

describe('eraseElementById', () => {
  beforeEach(() => {
    usePedigreeStore.getState().resetDocument();
  });

  it('removes a text annotation', () => {
    const store = usePedigreeStore.getState();
    store.addTextAnnotation({ id: 't1', text: 'hi', position: { x: 0, y: 0 }, fontSize: 16 });
    eraseElementById('t1');
    expect(usePedigreeStore.getState().document.textAnnotations.t1).toBeUndefined();
  });

  it('removes a partnership directly', () => {
    const store = usePedigreeStore.getState();
    const p: PartnershipRelationship = {
      id: 'p1', type: RelationshipType.Partnership,
      partner1Id: 'a', partner2Id: 'b', childrenIds: [],
    };
    store.addPartnership(p);
    eraseElementById('p1');
    expect(usePedigreeStore.getState().document.partnerships.p1).toBeUndefined();
  });

  it('removes an individual and cascades its partnership', () => {
    const store = usePedigreeStore.getState();
    store.addIndividual(createDefaultIndividual({ id: 'a', position: { x: 0, y: 0 } }));
    store.addIndividual(createDefaultIndividual({ id: 'b', position: { x: 50, y: 0 } }));
    store.addPartnership({
      id: 'p1', type: RelationshipType.Partnership,
      partner1Id: 'a', partner2Id: 'b', childrenIds: [],
    });
    eraseElementById('a');
    const doc = usePedigreeStore.getState().document;
    expect(doc.individuals.a).toBeUndefined();
    expect(doc.partnerships.p1).toBeUndefined();
  });

  it('never erases the last remaining individual', () => {
    const store = usePedigreeStore.getState();
    store.addIndividual(createDefaultIndividual({ id: 'only' }));
    eraseElementById('only');
    expect(usePedigreeStore.getState().document.individuals.only).toBeDefined();
  });

  it('erases down to but not past the final individual', () => {
    const store = usePedigreeStore.getState();
    store.addIndividual(createDefaultIndividual({ id: 'a' }));
    store.addIndividual(createDefaultIndividual({ id: 'b' }));
    eraseElementById('a');
    eraseElementById('b'); // now the last one — refused
    const doc = usePedigreeStore.getState().document;
    expect(doc.individuals.a).toBeUndefined();
    expect(doc.individuals.b).toBeDefined();
  });

  it('prunes a single-parent/one-child union instead of leaving a stranded connector', () => {
    const store = usePedigreeStore.getState();
    // A single parent 'p' with one child 'c' (one-partner union with a child).
    store.addIndividual(createDefaultIndividual({ id: 'p', position: { x: 0, y: 0 } }));
    store.addIndividual(createDefaultIndividual({ id: 'c', position: { x: 0, y: 150 } }));
    store.addPartnership({
      id: 'u1', type: RelationshipType.Partnership,
      partner1Id: 'p', partner2Id: undefined, childrenIds: ['c'],
    });
    store.addParentChildLink({ id: 'l1', type: RelationshipType.ParentChild, parentPartnershipId: 'u1', childId: 'c' });

    // Erasing the sole parent would leave a no-partner/one-child union — a
    // descent stub above 'c' attached to nothing. It must be pruned instead.
    eraseElementById('p');

    const doc = usePedigreeStore.getState().document;
    expect(doc.individuals.p).toBeUndefined();
    expect(doc.individuals.c).toBeDefined();
    expect(doc.partnerships.u1).toBeUndefined();
    expect(Object.values(doc.parentChildLinks).some((l) => l.childId === 'c')).toBe(false);
  });

  it('keeps a parentless sibship bar for two or more orphaned siblings', () => {
    const store = usePedigreeStore.getState();
    store.addIndividual(createDefaultIndividual({ id: 'p', position: { x: 0, y: 0 } }));
    store.addIndividual(createDefaultIndividual({ id: 'c1', position: { x: 0, y: 150 } }));
    store.addIndividual(createDefaultIndividual({ id: 'c2', position: { x: 50, y: 150 } }));
    store.addPartnership({
      id: 'u1', type: RelationshipType.Partnership,
      partner1Id: 'p', partner2Id: undefined, childrenIds: ['c1', 'c2'],
    });

    eraseElementById('p');

    // Two siblings still form a meaningful bare sibship, so the union survives.
    expect(usePedigreeStore.getState().document.partnerships.u1).toBeDefined();
  });
});
