import { describe, it, expect, beforeEach } from 'vitest';
import { buildPedigreeSvg } from './svgExport';
import { usePedigreeStore, createDefaultIndividual } from '../stores/pedigreeStore';
import { RelationshipType, TwinType } from '../types/enums';
import { PARENTLESS_SIBSHIP_RISE } from '../utils/constants';
import type { PartnershipRelationship, ParentChildRelationship } from '../types/pedigree';

/**
 * End-to-end guard for the bug report: a sibship of twins whose parents are
 * deleted must KEEP its twin connector. This spans two layers that each only
 * test their own half:
 *   - `removeIndividual` retains the union as a 0-parent sibship (this PR); and
 *   - `TwinConnector` / `svgExport` draw a real twin connector for a 0-parent
 *     sibship (PR #60).
 * Neither layer's tests cover the delete -> still-renders flow, so this locks
 * the combination against either side regressing.
 */
beforeEach(() => {
  usePedigreeStore.getState().resetDocument();
  usePedigreeStore.temporal.getState().clear();
});

function link(id: string, partnershipId: string, childId: string): ParentChildRelationship {
  return {
    id,
    type: RelationshipType.ParentChild,
    parentPartnershipId: partnershipId,
    childId,
  };
}

describe('twin connector survives deleting the parents (integration)', () => {
  it('keeps the converging twin lines after both parents are removed', () => {
    const store = usePedigreeStore.getState();
    // Twins centred on x=160 (midpoint of 130 and 190), a generation below the
    // parents. The convergence apex therefore lands at x=160.
    const dad = createDefaultIndividual({ id: 'dad', generation: 0, position: { x: 40, y: 100 } });
    const mum = createDefaultIndividual({ id: 'mum', generation: 0, position: { x: 160, y: 100 } });
    const c1 = createDefaultIndividual({ id: 'c1', generation: 1, position: { x: 130, y: 250 } });
    const c2 = createDefaultIndividual({ id: 'c2', generation: 1, position: { x: 190, y: 250 } });
    const union: PartnershipRelationship = {
      id: 'u1',
      type: RelationshipType.Partnership,
      partner1Id: 'dad',
      partner2Id: 'mum',
      childrenIds: ['c1', 'c2'],
    };
    store.addIndividual(dad);
    store.addIndividual(mum);
    store.addIndividual(c1);
    store.addIndividual(c2);
    store.addPartnership(union);
    store.addParentChildLink(link('l1', 'u1', 'c1'));
    store.addParentChildLink(link('l2', 'u1', 'c2'));
    store.addTwinGroup({
      id: 'tg1',
      twinType: TwinType.Monozygotic,
      individualIds: ['c1', 'c2'],
      parentPartnershipId: 'u1',
    });

    // Sanity: the twin convergence lines render while the parents are present.
    expect(buildPedigreeSvg(usePedigreeStore.getState().document, 'Twins')).toContain(
      'x2="130" y2="250"',
    );

    // Delete BOTH parents — the union becomes a parentless sibship.
    store.removeIndividual('dad');
    store.removeIndividual('mum');

    const svg = buildPedigreeSvg(usePedigreeStore.getState().document, 'Twins');

    const apexX = 160;
    const sibshipY = 250 - PARENTLESS_SIBSHIP_RISE;
    // Both twins still converge from a single apex on the sibship line.
    expect(svg).toContain(`<line x1="${apexX}" y1="${sibshipY}" x2="130" y2="250"`);
    expect(svg).toContain(`<line x1="${apexX}" y1="${sibshipY}" x2="190" y2="250"`);
    // They must NOT regress to plain vertical sibling drops.
    expect(svg).not.toContain(`<line x1="130" y1="${sibshipY}" x2="130" y2="250"`);
    expect(svg).not.toContain(`<line x1="190" y1="${sibshipY}" x2="190" y2="250"`);
  });

  it('keeps the twin lines when only one parent is removed', () => {
    const store = usePedigreeStore.getState();
    const dad = createDefaultIndividual({ id: 'dad', generation: 0, position: { x: 40, y: 100 } });
    const mum = createDefaultIndividual({ id: 'mum', generation: 0, position: { x: 160, y: 100 } });
    const c1 = createDefaultIndividual({ id: 'c1', generation: 1, position: { x: 130, y: 250 } });
    const c2 = createDefaultIndividual({ id: 'c2', generation: 1, position: { x: 190, y: 250 } });
    store.addIndividual(dad);
    store.addIndividual(mum);
    store.addIndividual(c1);
    store.addIndividual(c2);
    store.addPartnership({
      id: 'u1',
      type: RelationshipType.Partnership,
      partner1Id: 'dad',
      partner2Id: 'mum',
      childrenIds: ['c1', 'c2'],
    });
    store.addParentChildLink(link('l1', 'u1', 'c1'));
    store.addParentChildLink(link('l2', 'u1', 'c2'));
    store.addTwinGroup({
      id: 'tg1',
      twinType: TwinType.Monozygotic,
      individualIds: ['c1', 'c2'],
      parentPartnershipId: 'u1',
    });

    store.removeIndividual('mum');

    // The surviving single parent still anchors converging twin lines.
    const svg = buildPedigreeSvg(usePedigreeStore.getState().document, 'Twins');
    expect(svg).toContain('x1="160"');
    expect(svg).toContain('x2="130" y2="250"');
    expect(svg).toContain('x2="190" y2="250"');
  });
});
