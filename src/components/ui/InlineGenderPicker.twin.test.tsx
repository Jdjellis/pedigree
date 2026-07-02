// src/components/ui/InlineGenderPicker.twin.test.tsx
//
// Coverage for the gender popup's twin icons: MZ/DZ buttons sitting beside the
// gender icons (gated behind the `twinsInGenderPopup` flag) that turn the
// just-created person into a twin.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InlineGenderPicker } from './InlineGenderPicker';
import { useUIStore } from '../../stores/uiStore';
import { usePedigreeStore, createDefaultIndividual } from '../../stores/pedigreeStore';
import { GenderIdentity, RelationshipType, TwinType } from '../../types/enums';
import { featureFlags } from '../../config/featureFlags';

const TARGET = 'target-1';
const COMPANION = 'companion-1';

function seedTarget(): void {
  const store = usePedigreeStore.getState();
  store.resetDocument();
  store.addIndividual(
    createDefaultIndividual({ id: TARGET, genderIdentity: GenderIdentity.Unknown, position: { x: 0, y: 0 } }),
  );
  const ui = useUIStore.getState();
  ui.hideGenderPicker();
  if (ui.editingLocked) ui.toggleEditingLocked();
}

/**
 * Grow the document past the lone onboarding seed by adding a second person, so
 * the twin section is offered (it is suppressed while only the seed exists).
 */
function addCompanion(): void {
  usePedigreeStore.getState().addIndividual(
    createDefaultIndividual({ id: COMPANION, position: { x: 200, y: 0 } }),
  );
}

beforeEach(seedTarget);
afterEach(() => {
  featureFlags.twinsInGenderPopup = true; // restore the default
});

describe('InlineGenderPicker twin icons', () => {
  it('offers MZ / DZ twin buttons for a non-twin target (flag on by default)', () => {
    addCompanion();
    useUIStore.getState().showGenderPicker(TARGET);
    render(<InlineGenderPicker />);
    expect(screen.getByRole('button', { name: 'Monozygotic twin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dizygotic twin' })).toBeInTheDocument();
  });

  it('hides the twin icons for the lone seed person during onboarding', () => {
    // Only the seed exists (document count === 1), as on first run.
    useUIStore.getState().showGenderPicker(TARGET);
    render(<InlineGenderPicker />);
    expect(screen.queryByRole('button', { name: 'Monozygotic twin' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dizygotic twin' })).toBeNull();
    // The gender buttons still show so the seed's sex can be chosen.
    expect(screen.getByRole('button', { name: 'Woman' })).toBeInTheDocument();
  });

  it('clicking MZ creates a co-twin, groups the pair, and re-anchors the picker onto the twin', () => {
    addCompanion();
    useUIStore.getState().showGenderPicker(TARGET);
    render(<InlineGenderPicker />);
    fireEvent.click(screen.getByRole('button', { name: 'Monozygotic twin' }));

    const doc = usePedigreeStore.getState().document;
    const created = Object.values(doc.individuals).filter(
      (i) => i.id !== TARGET && i.id !== COMPANION,
    );
    expect(created).toHaveLength(1);
    const twin = created[0];

    const groups = Object.values(doc.twinGroups);
    expect(groups).toHaveLength(1);
    expect(groups[0].twinType).toBe(TwinType.Monozygotic);
    expect(groups[0].individualIds.sort()).toEqual([TARGET, twin.id].sort());

    expect(twin.genderIdentity).toBe(GenderIdentity.Unknown);
    expect(useUIStore.getState().genderPicker.targetId).toBe(twin.id);
  });

  it('hides the twin icons once the target is already a twin', () => {
    const store = usePedigreeStore.getState();
    const sib = createDefaultIndividual({ id: 'sib', position: { x: 80, y: 0 } });
    store.addIndividual(sib);
    store.addPartnership({
      id: 'u1', type: RelationshipType.Partnership, childrenIds: [TARGET, 'sib'],
    });
    store.addTwinGroup({
      id: 'tg1', twinType: TwinType.Dizygotic,
      individualIds: [TARGET, 'sib'], parentPartnershipId: 'u1',
    });

    useUIStore.getState().showGenderPicker(TARGET);
    render(<InlineGenderPicker />);
    expect(screen.queryByRole('button', { name: 'Monozygotic twin' })).toBeNull();
  });

  it('hides the twin icons when the twinsInGenderPopup flag is off', () => {
    featureFlags.twinsInGenderPopup = false;
    useUIStore.getState().showGenderPicker(TARGET);
    render(<InlineGenderPicker />);
    expect(screen.queryByRole('button', { name: 'Monozygotic twin' })).toBeNull();
    // Gender buttons are unaffected.
    expect(screen.getByRole('button', { name: 'Woman' })).toBeInTheDocument();
  });
});
