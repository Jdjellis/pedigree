/**
 * RTL tests for the adaptive adoption control in PropertiesPanel.
 *
 * The panel early-returns (shows empty state) unless both `propertiesPanelOpen`
 * and a matching individual exist in the pedigree store, so each test seeds
 * both stores before rendering.
 *
 * Store state is reset in `beforeEach` so tests are fully independent.
 */
import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { beforeEach, describe, it, expect } from 'vitest';
import { usePedigreeStore, createDefaultDocument, createDefaultIndividual } from '../../stores/pedigreeStore';
import { useUIStore } from '../../stores/uiStore';
import { RelationshipType, VitalStatus } from '../../types/enums';
import type { ParentChildRelationship, PartnershipRelationship } from '../../types/pedigree';
import { PropertiesPanel } from './PropertiesPanel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLink(id: string, childId: string, parentPartnershipId: string): ParentChildRelationship {
  return {
    id,
    type: RelationshipType.ParentChild,
    parentPartnershipId,
    childId,
  };
}

function makePartnership(id: string, partner1Id: string, partner2Id: string): PartnershipRelationship {
  return {
    id,
    type: RelationshipType.Partnership,
    partner1Id,
    partner2Id,
    childrenIds: [],
  };
}

// ---------------------------------------------------------------------------
// Store reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  act(() => {
    usePedigreeStore.getState().setDocument(createDefaultDocument());
    useUIStore.setState({
      selectedIds: new Set<string>(),
      propertiesPanelOpen: false,
    });
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PropertiesPanel adoption control', () => {
  it('shows the plain Adopted checkbox when the child has no parent links', () => {
    const child = createDefaultIndividual({ id: 'child-a' });
    const doc = createDefaultDocument();
    doc.individuals['child-a'] = child;

    act(() => {
      usePedigreeStore.getState().setDocument(doc);
      useUIStore.setState({
        selectedIds: new Set(['child-a']),
        propertiesPanelOpen: true,
      });
    });

    render(<PropertiesPanel />);

    // 0-link branch: plain checkbox labelled "Adopted"
    expect(screen.getByRole('checkbox', { name: 'Adopted' })).toBeInTheDocument();
    // In/out segmented control must NOT appear
    expect(screen.queryByRole('group', { name: 'Adoption status' })).not.toBeInTheDocument();
  });

  it('shows the in/out segmented control when the child has exactly one parent link', () => {
    const child = createDefaultIndividual({ id: 'child-b' });
    const doc = createDefaultDocument();
    doc.individuals['child-b'] = child;
    doc.individuals['parent1'] = createDefaultIndividual({ id: 'parent1' });
    doc.individuals['parent2'] = createDefaultIndividual({ id: 'parent2' });
    doc.partnerships['union1'] = makePartnership('union1', 'parent1', 'parent2');
    doc.parentChildLinks['link1'] = makeLink('link1', 'child-b', 'union1');

    act(() => {
      usePedigreeStore.getState().setDocument(doc);
      useUIStore.setState({
        selectedIds: new Set(['child-b']),
        propertiesPanelOpen: true,
      });
    });

    render(<PropertiesPanel />);

    // 1-link branch: SegmentedControl group with ariaLabel="Adoption status"
    expect(screen.getByRole('group', { name: 'Adoption status' })).toBeInTheDocument();

    // All three ADOPTION_OPTIONS must be present as buttons
    expect(screen.getByRole('button', { name: 'Not adopted' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adopted in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adopted out' })).toBeInTheDocument();

    // Plain "Adopted" checkbox must NOT appear in this branch
    expect(screen.queryByRole('checkbox', { name: 'Adopted' })).not.toBeInTheDocument();
  });

  // The 2+-link (multi-family) branch — reachable now that multi-parentage (#64)
  // lets a child gain a second parent set.
  function seedTwoParentSets(): void {
    const doc = createDefaultDocument();
    doc.individuals['child-c'] = createDefaultIndividual({ id: 'child-c', adopted: true });
    doc.individuals['bioDad'] = createDefaultIndividual({ id: 'bioDad', displayName: 'Bio Dad' });
    doc.individuals['bioMum'] = createDefaultIndividual({ id: 'bioMum', displayName: 'Bio Mum' });
    doc.individuals['adoptDad'] = createDefaultIndividual({ id: 'adoptDad', displayName: 'Adoptive Dad' });
    doc.individuals['adoptMum'] = createDefaultIndividual({ id: 'adoptMum', displayName: 'Adoptive Mum' });
    doc.partnerships['bioUnion'] = makePartnership('bioUnion', 'bioDad', 'bioMum');
    doc.partnerships['adoptUnion'] = makePartnership('adoptUnion', 'adoptDad', 'adoptMum');
    // Biological edge (solid) + adoptive edge (dashed) for the same child.
    doc.parentChildLinks['bioLink'] = makeLink('bioLink', 'child-c', 'bioUnion');
    doc.parentChildLinks['adoptLink'] = {
      ...makeLink('adoptLink', 'child-c', 'adoptUnion'),
      isAdoptive: true,
    };

    act(() => {
      usePedigreeStore.getState().setDocument(doc);
      useUIStore.setState({
        selectedIds: new Set(['child-c']),
        propertiesPanelOpen: true,
      });
    });
  }

  it('shows a per-couple Biological/Adoptive toggle for each parent set when 2+ links exist', () => {
    seedTwoParentSets();
    render(<PropertiesPanel />);

    // One labelled toggle group per couple, keyed by the partners' display names.
    expect(
      screen.getByRole('group', { name: 'Line of descent for Bio Dad & Bio Mum' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Line of descent for Adoptive Dad & Adoptive Mum' }),
    ).toBeInTheDocument();

    // The 1-link in/out control is NOT used in this branch.
    expect(screen.queryByRole('group', { name: 'Adoption status' })).not.toBeInTheDocument();
    // A separate brackets checkbox remains.
    expect(screen.getByRole('checkbox', { name: 'Adopted (brackets)' })).toBeInTheDocument();
  });

  it('toggles a single edge\'s line style independently via setLinkAdoptive', () => {
    seedTwoParentSets();
    render(<PropertiesPanel />);

    // The biological couple starts solid (Biological selected). Switch it to Adoptive.
    const bioGroup = screen.getByRole('group', { name: 'Line of descent for Bio Dad & Bio Mum' });
    fireEvent.click(within(bioGroup).getByRole('button', { name: 'Adoptive' }));

    const links = usePedigreeStore.getState().document.parentChildLinks;
    expect(links['bioLink'].isAdoptive).toBe(true);
    // The other couple's edge is unaffected.
    expect(links['adoptLink'].isAdoptive).toBe(true);
  });
});

describe('PropertiesPanel stillbirth gestational age', () => {
  function seedStillborn() {
    const ind = createDefaultIndividual({ id: 'sb-1', displayName: 'Baby' });
    ind.vitalStatus = VitalStatus.Stillborn;
    ind.gestationalAge = '20 wk';
    const doc = createDefaultDocument();
    doc.individuals['sb-1'] = ind;

    act(() => {
      usePedigreeStore.getState().setDocument(doc);
      useUIStore.setState({
        selectedIds: new Set(['sb-1']),
        propertiesPanelOpen: true,
      });
    });
  }

  it('replaces the Age field with Gestational age when the status is Stillborn', () => {
    seedStillborn();
    render(<PropertiesPanel />);
    // Gestational age is shown; the Age input is not (GA takes its place).
    expect(screen.getByDisplayValue('20 wk')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Age')).not.toBeInTheDocument();
  });

  it('clears a stale age when the status changes to Stillborn', () => {
    const ind = createDefaultIndividual({ id: 'p-1', displayName: 'Kid' });
    ind.vitalStatus = VitalStatus.Alive;
    ind.age = 30;
    const doc = createDefaultDocument();
    doc.individuals['p-1'] = ind;

    act(() => {
      usePedigreeStore.getState().setDocument(doc);
      useUIStore.setState({
        selectedIds: new Set(['p-1']),
        propertiesPanelOpen: true,
      });
    });

    render(<PropertiesPanel />);
    // Age is shown for a living person…
    expect(screen.getByPlaceholderText('Age')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Stillborn' }));

    // …and dropped on the switch to Stillborn, so no "d. <age>" can render.
    expect(usePedigreeStore.getState().document.individuals['p-1'].age).toBeUndefined();
    expect(screen.queryByPlaceholderText('Age')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 20 wk')).toBeInTheDocument();
  });
});
