import { usePedigreeStore, createDefaultIndividual } from '../../stores/pedigreeStore';
import { useUIStore } from '../../stores/uiStore';
import { getPresentPartners } from '../../utils/graphTraversal';
import { generateId } from '../../utils/idGenerator';
import { RelationshipType, GenderIdentity } from '../../types/enums';
import { GENERATION_SPACING, SIBLING_SPACING } from '../../utils/constants';
import type {
  Individual,
  ParentChildRelationship,
  PartnershipRelationship,
  PedigreeDocument,
} from '../../types/pedigree';

/**
 * Build the new child individual and its parent-child link for adding a child
 * under an EXISTING union, without touching any store.
 *
 * The child is created Unknown so the inline gender picker can prompt for it,
 * anchored under the average x of whichever partners are present (falling back
 * to the target's x for a partnerless sibship) and offset by the existing
 * children so siblings fan out rather than stack. Pure so it can be unit-tested
 * (react-konva/jsdom can't render the components that consume it — see CLAUDE.md).
 */
export function buildChildForUnion(
  doc: PedigreeDocument,
  target: Individual,
  partnership: PartnershipRelationship,
): { child: Individual; link: ParentChildRelationship } {
  const partners = getPresentPartners(doc.individuals, partnership);
  const midX = partners.length
    ? partners.reduce((s, p) => s + p.position.x, 0) / partners.length
    : target.position.x;
  const existingChildren = partnership.childrenIds.length;

  const child = createDefaultIndividual({
    genderIdentity: GenderIdentity.Unknown,
    generation: (target.generation ?? 0) + 1,
    position: {
      x: midX + existingChildren * SIBLING_SPACING,
      y: target.position.y + GENERATION_SPACING,
    },
  });
  const link: ParentChildRelationship = {
    id: generateId(),
    type: RelationshipType.ParentChild,
    parentPartnershipId: partnership.id,
    childId: child.id,
  };
  return { child, link };
}

/**
 * Add a child under a SPECIFIC existing union and open the inline gender picker
 * on it. Shared by the radial menu's single-union Add Child path and the union
 * picker's per-union choice, so both routes place the child identically — the
 * only difference is how the union was chosen.
 */
export function addChildToUnion(
  doc: PedigreeDocument,
  target: Individual,
  partnership: PartnershipRelationship,
): void {
  const { child, link } = buildChildForUnion(doc, target, partnership);
  usePedigreeStore.getState().addChildToFamily(child, partnership.id, link);
  useUIStore.getState().select(child.id);
  useUIStore.getState().showGenderPicker(child.id);
}
