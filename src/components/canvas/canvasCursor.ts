import type { ActiveTool } from '../../stores/uiStore';

/**
 * The set of cursor values the canvas container writes to its stage-container
 * element. An empty string clears the inline cursor so the per-tool CSS cursor
 * (see CanvasContainer.module.css) takes over.
 */
export type CanvasCursor = 'grabbing' | 'grab' | 'pointer' | '';

export interface CanvasCursorInputs {
  /** A pan gesture is actively in progress (stage drag or middle-mouse pan). */
  panning: boolean;
  /** The spacebar is held — the canvas is in "pan anywhere" ready state. */
  spaceHeld: boolean;
  /** A symbol (or other clickable canvas node) is currently hovered. */
  hovering: boolean;
  /** The active tool. The hover pointer affordance only applies in 'select'. */
  tool: ActiveTool;
}

/**
 * Resolve the cursor the canvas container should show, given the current pan and
 * hover state. This is the single source of truth for the container cursor so
 * the pan/space-held affordances and the symbol hover pointer never fight over
 * `container().style.cursor` (they used to be written by separate owners).
 *
 * Priority, highest first:
 *  1. An in-progress pan gesture → `grabbing`.
 *  2. Spacebar held ("pan anywhere" ready) → `grab`.
 *  3. Hovering a clickable node in the select tool → `pointer`.
 *  4. Otherwise `''`, clearing the inline cursor so the per-tool CSS cursor
 *     (crosshair, custom eraser, etc.) takes over.
 */
export function resolveCanvasCursor({
  panning,
  spaceHeld,
  hovering,
  tool,
}: CanvasCursorInputs): CanvasCursor {
  if (panning) return 'grabbing';
  if (spaceHeld) return 'grab';
  if (hovering && tool === 'select') return 'pointer';
  return '';
}
