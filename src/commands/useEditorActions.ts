import { usePedigreeStore, createDefaultIndividual } from '../stores/pedigreeStore';
import { useUIStore } from '../stores/uiStore';
import { useViewportStore } from '../stores/viewportStore';
import { loadFromFile } from '../io/jsonIO';
import { ZOOM_STEP } from '../utils/constants';

/**
 * All imperative editor actions available to any surface (islands, ⌘K palette,
 * keyboard shortcuts). This is the single source of truth — do not duplicate
 * action bodies elsewhere.
 */
export interface EditorActions {
  /** Prompt to confirm, then reset the document, clear selection and view. */
  newDocument: () => void;
  /** Open a JSON file from disk and load it as the current document. */
  openDocument: () => Promise<void>;
  /** Open the PED-format import modal. */
  importPed: () => void;
  /** Open the export modal. */
  exportDocument: () => void;
  /** Open the legend editor modal. */
  openLegend: () => void;
  /**
   * Add a new individual placed at the visible-canvas centre and select it.
   * Placement uses `screenToCanvas` with stage-local coordinates (0,0 = top-left
   * of the `.konvajs-content` element), matching the project's Konva/Zustand
   * coordinate convention.
   */
  addPerson: () => void;
  /** Delete every currently-selected individual, then clear the selection. */
  deleteSelected: () => void;
  /** Undo the last pedigree document change. */
  undo: () => void;
  /** Redo the last undone pedigree document change. */
  redo: () => void;
  /** Zoom in toward the viewport centre. */
  zoomIn: () => void;
  /** Zoom out from the viewport centre. */
  zoomOut: () => void;
  /** Reset scale to 100% and pan to origin. */
  resetView: () => void;
  /** Activate the select pointer tool. */
  selectTool: () => void;
  /** Activate the pan (hand) tool. */
  handTool: () => void;
  /** Activate the add-individual tool. */
  addPersonTool: () => void;
}

/**
 * Returns the full set of imperative editor actions, ported verbatim from the
 * inline handlers in `Toolbar.tsx`. Consume in floating islands, the ⌘K
 * command palette, or any other surface that needs to trigger document or
 * viewport mutations.
 *
 * All store reads inside callbacks use `getState()` to avoid stale closures.
 */
export function useEditorActions(): EditorActions {
  const newDocument = (): void => {
    if (
      window.confirm('Create a new pedigree? Unsaved changes will be lost.')
    ) {
      usePedigreeStore.getState().resetDocument();
      useUIStore.getState().clearSelection();
      useViewportStore.getState().resetView();
    }
  };

  const openDocument = async (): Promise<void> => {
    try {
      const loaded = await loadFromFile();
      usePedigreeStore.getState().setDocument(loaded);
      useUIStore.getState().clearSelection();
      useViewportStore.getState().resetView();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Silently ignore cancelled file pickers
      if (err instanceof Error && err.message.includes('cancelled')) return;
      alert(
        `Failed to open file: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  };

  const importPed = (): void => {
    useUIStore.getState().openModal('import');
  };

  const exportDocument = (): void => {
    useUIStore.getState().openModal('export');
  };

  const openLegend = (): void => {
    useUIStore.getState().openModal('legendEditor');
  };

  const addPerson = (): void => {
    // Place new individual at center of visible canvas area.
    // screenToCanvas expects stage-local coords (0,0 = top-left of stage element).
    const { screenToCanvas } = useViewportStore.getState();
    const canvasEl = document.querySelector('.konvajs-content');
    let stageCenter = { x: 300, y: 300 };
    if (canvasEl) {
      const rect = canvasEl.getBoundingClientRect();
      stageCenter = { x: rect.width / 2, y: rect.height / 2 };
    }
    const canvasCenter = screenToCanvas(stageCenter);

    const individual = createDefaultIndividual({
      position: {
        x: Math.round(canvasCenter.x),
        y: Math.round(canvasCenter.y),
      },
    });
    usePedigreeStore.getState().addIndividual(individual);
    useUIStore.getState().select(individual.id);
  };

  const deleteSelected = (): void => {
    const { selectedIds } = useUIStore.getState();
    for (const id of selectedIds) {
      usePedigreeStore.getState().removeIndividual(id);
    }
    useUIStore.getState().clearSelection();
  };

  const undo = (): void => {
    usePedigreeStore.temporal.getState().undo();
  };

  const redo = (): void => {
    usePedigreeStore.temporal.getState().redo();
  };

  const zoomIn = (): void => {
    const { scale, zoomToPoint } = useViewportStore.getState();
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    zoomToPoint(center, scale * ZOOM_STEP);
  };

  const zoomOut = (): void => {
    const { scale, zoomToPoint } = useViewportStore.getState();
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    zoomToPoint(center, scale / ZOOM_STEP);
  };

  const resetView = (): void => {
    useViewportStore.getState().resetView();
  };

  const selectTool = (): void => {
    useUIStore.getState().setActiveTool('select');
  };

  const handTool = (): void => {
    useUIStore.getState().setActiveTool('pan');
  };

  const addPersonTool = (): void => {
    useUIStore.getState().setActiveTool('addIndividual');
  };

  return {
    newDocument,
    openDocument,
    importPed,
    exportDocument,
    openLegend,
    addPerson,
    deleteSelected,
    undo,
    redo,
    zoomIn,
    zoomOut,
    resetView,
    selectTool,
    handTool,
    addPersonTool,
  };
}
