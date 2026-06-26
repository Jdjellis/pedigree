import { usePedigreeStore, createDefaultIndividual } from '../../stores/pedigreeStore';
import { useUIStore, type ActiveTool } from '../../stores/uiStore';
import { GenderIdentity } from '../../types/enums';

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
  if (!ui.toolLocked) ui.setActiveTool('select');

  return individual.id;
}
