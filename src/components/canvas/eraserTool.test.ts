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
});
