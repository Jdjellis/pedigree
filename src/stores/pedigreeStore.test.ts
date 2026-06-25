import { describe, it, expect, beforeEach } from 'vitest';
import { usePedigreeStore, createDefaultIndividual } from './pedigreeStore';
import { RelationshipType } from '../types/enums';
import type { PartnershipRelationship } from '../types/pedigree';

function seedPartnership(): string {
  const a = createDefaultIndividual();
  const b = createDefaultIndividual();
  const partnership: PartnershipRelationship = {
    id: 'pa-1',
    type: RelationshipType.Partnership,
    partner1Id: a.id,
    partner2Id: b.id,
    childrenIds: [],
  };
  const store = usePedigreeStore.getState();
  store.addIndividual(a);
  store.addIndividual(b);
  store.addPartnership(partnership);
  return partnership.id;
}

describe('updatePartnership', () => {
  beforeEach(() => {
    usePedigreeStore.getState().resetDocument();
  });

  it('changes the partnership type', () => {
    const id = seedPartnership();
    usePedigreeStore
      .getState()
      .updatePartnership(id, { type: RelationshipType.Separation });
    expect(usePedigreeStore.getState().document.partnerships[id].type).toBe(
      RelationshipType.Separation,
    );
  });

  it('preserves other fields when patching type', () => {
    const id = seedPartnership();
    const before = usePedigreeStore.getState().document.partnerships[id];
    usePedigreeStore
      .getState()
      .updatePartnership(id, { type: RelationshipType.Consanguinity });
    const after = usePedigreeStore.getState().document.partnerships[id];
    expect(after.partner1Id).toBe(before.partner1Id);
    expect(after.partner2Id).toBe(before.partner2Id);
    expect(after.childrenIds).toEqual(before.childrenIds);
  });

  it('is a no-op for an unknown id', () => {
    const id = seedPartnership();
    const before = usePedigreeStore.getState().document.partnerships[id];
    usePedigreeStore
      .getState()
      .updatePartnership('does-not-exist', { type: RelationshipType.Separation });
    expect(usePedigreeStore.getState().document.partnerships[id]).toEqual(before);
  });
});
