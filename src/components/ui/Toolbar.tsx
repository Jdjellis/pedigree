import { usePedigreeStore, createDefaultIndividual } from '../../stores/pedigreeStore';
import { useUIStore } from '../../stores/uiStore';
import { useViewportStore } from '../../stores/viewportStore';
import { loadFromFile } from '../../io/jsonIO';
import { ZOOM_STEP } from '../../utils/constants';
import styles from './Toolbar.module.css';
import clsx from 'clsx';

export function Toolbar() {
  const resetDocument = usePedigreeStore((s) => s.resetDocument);
  const setDocument = usePedigreeStore((s) => s.setDocument);
  const addIndividual = usePedigreeStore((s) => s.addIndividual);
  const removeIndividual = usePedigreeStore((s) => s.removeIndividual);
  const doc = usePedigreeStore((s) => s.document);
  const title = doc.metadata.title;

  const selectedIds = useUIStore((s) => s.selectedIds);
  const clearSelection = useUIStore((s) => s.clearSelection);
  const select = useUIStore((s) => s.select);
  const openModal = useUIStore((s) => s.openModal);
  const activeTool = useUIStore((s) => s.activeTool);
  const setActiveTool = useUIStore((s) => s.setActiveTool);

  const scale = useViewportStore((s) => s.scale);
  const zoomToPoint = useViewportStore((s) => s.zoomToPoint);
  const resetView = useViewportStore((s) => s.resetView);

  const handleNew = () => {
    if (
      window.confirm(
        'Create a new pedigree? Unsaved changes will be lost.'
      )
    ) {
      resetDocument();
      clearSelection();
      resetView();
    }
  };

  const handleOpen = async () => {
    try {
      const loaded = await loadFromFile();
      setDocument(loaded);
      clearSelection();
      resetView();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Silently ignore cancelled file pickers
      if (err instanceof Error && err.message.includes('cancelled')) return;
      alert(`Failed to open file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleAddIndividual = () => {
    // Place new individual at center of visible canvas area
    const { screenToCanvas } = useViewportStore.getState();
    const canvasEl = document.querySelector('.konvajs-content');
    // screenToCanvas expects stage-local coords (0,0 = top-left of stage)
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
    addIndividual(individual);
    select(individual.id);
  };

  const handleDelete = () => {
    for (const id of selectedIds) {
      removeIndividual(id);
    }
    clearSelection();
  };

  const handleUndo = () => {
    usePedigreeStore.temporal.getState().undo();
  };

  const handleRedo = () => {
    usePedigreeStore.temporal.getState().redo();
  };

  const handleZoomIn = () => {
    // Zoom toward center of viewport
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    zoomToPoint(center, scale * ZOOM_STEP);
  };

  const handleZoomOut = () => {
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    zoomToPoint(center, scale / ZOOM_STEP);
  };

  return (
    <div className={styles.toolbar}>
      <span className={styles.title}>{title}</span>

      <div className={styles.separator} />

      <div className={styles.group}>
        <button
          className={clsx(styles.button, styles.textButton)}
          onClick={handleNew}
          title="New Pedigree"
        >
          New
        </button>
        <button
          className={clsx(styles.button, styles.textButton)}
          onClick={handleOpen}
          title="Open JSON (Cmd+O)"
        >
          Open
        </button>
        <button
          className={clsx(styles.button, styles.textButton)}
          onClick={() => openModal('import')}
          title="Import PED format"
        >
          Import
        </button>
        <button
          className={clsx(styles.button, styles.textButton)}
          onClick={() => openModal('export')}
          title="Export"
        >
          Export
        </button>
        <button
          className={clsx(styles.button, styles.textButton)}
          onClick={() => openModal('legendEditor')}
          title="Configure legend / key"
        >
          Legend
        </button>
      </div>

      <div className={styles.separator} />

      <div className={styles.group}>
        <button
          className={styles.button}
          onClick={handleUndo}
          title="Undo (Cmd+Z)"
        >
          &#x21A9;
        </button>
        <button
          className={styles.button}
          onClick={handleRedo}
          title="Redo (Cmd+Shift+Z)"
        >
          &#x21AA;
        </button>
      </div>

      <div className={styles.separator} />

      <div className={styles.group}>
        <button
          className={clsx(
            styles.button,
            styles.textButton,
            activeTool === 'select' && styles.buttonActive
          )}
          onClick={() => setActiveTool('select')}
          title="Select tool"
        >
          Select
        </button>
        <button
          className={clsx(styles.button, styles.textButton)}
          onClick={handleAddIndividual}
          title="Add Individual"
        >
          + Person
        </button>
      </div>

      <div className={styles.separator} />

      <button
        className={clsx(styles.button, styles.textButton)}
        onClick={handleDelete}
        disabled={selectedIds.size === 0}
        title="Delete Selected"
        style={{ opacity: selectedIds.size === 0 ? 0.4 : 1 }}
      >
        Delete
      </button>

      <div className={styles.spacer} />

      <div className={styles.group}>
        <button
          className={styles.button}
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          &minus;
        </button>
        <span className={styles.zoomDisplay}>
          {Math.round(scale * 100)}%
        </span>
        <button
          className={styles.button}
          onClick={handleZoomIn}
          title="Zoom In"
        >
          +
        </button>
        <button
          className={clsx(styles.button, styles.textButton)}
          onClick={resetView}
          title="Reset View"
        >
          Fit
        </button>
      </div>
    </div>
  );
}
