import { usePedigreeStore, createDefaultIndividual } from '../../stores/pedigreeStore';
import { useUIStore, type ActiveTool } from '../../stores/uiStore';
import { GenderIdentity } from '../../types/enums';
import { generateId } from '../../utils/idGenerator';
import {
  ANNOTATION_DEFAULT_FONT_SIZE,
  ANNOTATION_PLACEHOLDER_TEXT,
} from '../../utils/constants';

/**
 * Map a placement tool id to the gender identity it creates. Returns `null`
 * for any tool that is not a person-placement tool.
 */
export function genderForTool(tool: ActiveTool): GenderIdentity | null {
  switch (tool) {
    case 'male':
      return GenderIdentity.Man;
    case 'female':
      return GenderIdentity.Woman;
    case 'unknown':
      return GenderIdentity.Unknown;
    default:
      return null;
  }
}

/**
 * Place a new individual of the tool's sex at the given CANVAS-space position
 * (already converted from stage-local coords by the caller via `screenToCanvas`).
 * Coordinates are rounded to integers. Selects the new individual and reverts
 * the active tool to `'select'` unless the toolbar lock is engaged.
 *
 * @returns the new individual's id, or `null` when `tool` is not a person tool.
 */
export function placePersonAt(
  tool: ActiveTool,
  position: { x: number; y: number },
): string | null {
  const genderIdentity = genderForTool(tool);
  if (genderIdentity === null) return null;

  const individual = createDefaultIndividual({
    genderIdentity,
    position: { x: Math.round(position.x), y: Math.round(position.y) },
  });
  usePedigreeStore.getState().addIndividual(individual);

  const ui = useUIStore.getState();
  ui.select(individual.id);
  if (!ui.editingLocked) ui.setActiveTool('select');

  return individual.id;
}

/**
 * Place an empty-placeholder text annotation at the given CANVAS-space position
 * (rounded to integers), open it straight into inline edit mode, and revert the
 * active tool to `'select'` unless the toolbar lock is engaged.
 *
 * @returns the new annotation's id.
 */
export function placeTextAt(position: { x: number; y: number }): string {
  const annotation = {
    id: generateId(),
    text: ANNOTATION_PLACEHOLDER_TEXT,
    position: { x: Math.round(position.x), y: Math.round(position.y) },
    fontSize: ANNOTATION_DEFAULT_FONT_SIZE,
  };
  usePedigreeStore.getState().addTextAnnotation(annotation);

  const ui = useUIStore.getState();
  ui.startEditingAnnotation(annotation.id);
  if (!ui.editingLocked) ui.setActiveTool('select');

  return annotation.id;
}
