// src/components/ui/RadialMenu.partnerSibling.test.tsx
//
// Coverage for the two RadialMenu handlers still untested elsewhere:
//   - handleAddPartner: both the fresh-partnership branch (target has no union)
//     and the sole-union branch (target is the lone partner of a 1-partner union,
//     so the new partner becomes co-parent of the existing children).
//   - handleAddSibling: the no-parents branch, which builds a 0-partner sibship
//     holding the target and the new sibling.
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RadialMenu } from './RadialMenu';
import { useUIStore } from '../../stores/uiStore';
import { usePedigreeStore, createDefaultIndividual } from '../../stores/pedigreeStore';
import { GenderIdentity, RelationshipType } from '../../types/enums';

const ROOT = 'root-1';

function created(...seedIds: string[]) {
  const seed = new Set(seedIds);
  return Object.values(usePedigreeStore.getState().document.individuals).filter(
    (i) => !seed.has(i.id),
  );
}

function seedRoot(gender = GenderIdentity.Woman): void {
  const pedigree = usePedigreeStore.getState();
  pedigree.resetDocument();
  pedigree.addIndividual(
    createDefaultIndividual({
      id: ROOT,
      genderIdentity: gender,
      generation: 0,
      position: { x: 0, y: 0 },
    }),
  );
  const ui = useUIStore.getState();
  ui.hideGenderPicker();
  ui.hideUnionPicker();
  if (ui.editingLocked) ui.toggleEditingLocked();
  ui.showRadialMenu(ROOT, { x: 0, y: 0 });
}

describe('RadialMenu Add Partner', () => {
  it('creates a fresh partnership with an Unknown partner and opens the gender picker', () => {
    seedRoot();
    render(<RadialMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Partner' }));

    const partners = created(ROOT);
    expect(partners).toHaveLength(1);
    expect(partners[0].genderIdentity).toBe(GenderIdentity.Unknown);

    const doc = usePedigreeStore.getState().document;
    const unions = Object.values(doc.partnerships);
    expect(unions).toHaveLength(1);
    expect(unions[0].partner1Id).toBe(ROOT);
    expect(unions[0].partner2Id).toBe(partners[0].id);
    expect(unions[0].childrenIds).toHaveLength(0);

    expect(useUIStore.getState().genderPicker.targetId).toBe(partners[0].id);
    expect(useUIStore.getState().radialMenu.visible).toBe(false);
  });

  it('fills the missing partner of a 1-partner union so it co-parents the existing children', () => {
    // ROOT is the sole present parent of a union with one child.
    seedRoot();
    const pedigree = usePedigreeStore.getState();
    pedigree.addIndividual(
      createDefaultIndividual({ id: 'kid', generation: 1, position: { x: 0, y: 150 } }),
    );
    pedigree.addPartnership({
      id: 'u1',
      type: RelationshipType.Partnership,
      partner1Id: ROOT,
      childrenIds: ['kid'],
    });
    pedigree.addParentChildLink({
      id: 'pcl',
      type: RelationshipType.ParentChild,
      parentPartnershipId: 'u1',
      childId: 'kid',
    });

    render(<RadialMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Partner' }));

    const partners = created(ROOT, 'kid');
    expect(partners).toHaveLength(1);

    const doc = usePedigreeStore.getState().document;
    // No new union — the existing one gained a second present partner.
    expect(Object.values(doc.partnerships)).toHaveLength(1);
    const union = doc.partnerships['u1'];
    expect([union.partner1Id, union.partner2Id]).toContain(partners[0].id);
    expect(union.childrenIds).toEqual(['kid']);

    expect(useUIStore.getState().genderPicker.targetId).toBe(partners[0].id);
  });
});

describe('RadialMenu Add Sibling (no parents)', () => {
  it('creates a 0-partner sibship holding the target and the new sibling', () => {
    seedRoot();
    render(<RadialMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Sibling/i }));

    const siblings = created(ROOT);
    expect(siblings).toHaveLength(1);
    expect(siblings[0].genderIdentity).toBe(GenderIdentity.Unknown);

    const doc = usePedigreeStore.getState().document;
    const unions = Object.values(doc.partnerships);
    expect(unions).toHaveLength(1);
    // A 0-partner sibship: no partners, both people are children of it.
    expect(unions[0].partner1Id).toBeUndefined();
    expect(unions[0].partner2Id).toBeUndefined();
    expect(unions[0].childrenIds.sort()).toEqual([ROOT, siblings[0].id].sort());

    // Both target and sibling are linked as children of the new sibship.
    const links = Object.values(doc.parentChildLinks);
    expect(links).toHaveLength(2);
    expect(links.map((l) => l.childId).sort()).toEqual([ROOT, siblings[0].id].sort());

    expect(useUIStore.getState().genderPicker.targetId).toBe(siblings[0].id);
  });
});
