/**
 * Helpers for individual-level childlessness marks (the no-partner analogue of a
 * childless partnership). Shared by the Konva renderer
 * (`IndividualChildlessLine.tsx`), the SVG exporter (`svgExport.ts`), and the
 * properties panel so the geometry and the "has children" suppression rule
 * cannot drift.
 */
import { SYMBOL_SIZE } from './constants';
import type { Individual, PartnershipRelationship } from '../types/pedigree';
import type { Point } from './partnershipGeometry';

/**
 * Anchor point for an individual's childless marks: the bottom-centre of the
 * symbol, so the vertical stub drops straight down from the symbol exactly as a
 * partnership's stub drops from the relationship line.
 */
export function individualChildlessAnchor(individual: Individual): Point {
  return {
    x: individual.position.x,
    y: individual.position.y + SYMBOL_SIZE / 2,
  };
}

/**
 * True when `individualId` is a partner in any union that has children on the
 * canvas. An individual childless marker contradicts existing descendants, so it
 * is suppressed in rendering (and the panel control disabled) in that case —
 * mirrors the partnership rule in {@link PartnershipRelationship}.
 */
export function individualHasChildren(
  partnerships: Record<string, PartnershipRelationship>,
  individualId: string,
): boolean {
  return Object.values(partnerships).some(
    (p) =>
      (p.partner1Id === individualId || p.partner2Id === individualId) &&
      p.childrenIds.length > 0,
  );
}
