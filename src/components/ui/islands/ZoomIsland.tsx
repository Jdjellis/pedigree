import { useViewportStore } from '../../../stores/viewportStore';
import { useEditorActions } from '../../../commands/useEditorActions';
import { Island } from './Island';
import styles from './islands.module.css';

/**
 * Floating zoom-control island.
 *
 * Renders Zoom Out (−), a live percentage display, Zoom In (+), and a Fit
 * button that resets the view. Reads `scale` reactively from
 * `useViewportStore` — safe here because this component lives in the
 * react-dom tree (not inside react-konva).
 *
 * @example
 * ```tsx
 * <ZoomIsland />
 * ```
 */
export function ZoomIsland(): React.JSX.Element {
  const scale = useViewportStore((s) => s.scale);
  const { zoomIn, zoomOut, resetView } = useEditorActions();

  const zoomPercent = `${Math.round(scale * 100)}%`;

  return (
    <Island aria-label="Zoom controls">
      <button
        type="button"
        className={styles.button}
        onClick={zoomOut}
        title="Zoom Out (−)"
        aria-label="Zoom Out"
      >
        &minus;
      </button>

      <span className={styles.zoomDisplay} aria-live="polite" aria-atomic="true">
        {zoomPercent}
      </span>

      <button
        type="button"
        className={styles.button}
        onClick={zoomIn}
        title="Zoom In (+)"
        aria-label="Zoom In"
      >
        +
      </button>

      <button
        type="button"
        className={styles.button}
        onClick={resetView}
        title="Fit — reset view to 100%"
        aria-label="Fit"
      >
        Fit
      </button>
    </Island>
  );
}
