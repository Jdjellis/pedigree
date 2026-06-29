import { useUIStore, type ActiveTool } from '../../../stores/uiStore';
import styles from './ToolHint.module.css';

/**
 * Per-tool hint shown under the toolbar. Contextual: the select tool swaps
 * between a pan hint (default) and an Alt+drag linking hint when the pointer
 * is over a node — teaching the right thing at the right moment.
 */
export function ToolHint(): React.JSX.Element | null {
  const activeTool = useUIStore((s) => s.activeTool);
  const hoveredId = useUIStore((s) => s.hoveredId);

  let hint: React.ReactNode = null;

  if (activeTool === 'select') {
    if (hoveredId) {
      hint = (
        <>
          Hold <kbd>Alt</kbd> and drag onto another person to link them
        </>
      );
    } else {
      hint = (
        <>
          Hold <kbd>Space</kbd> while dragging to pan, or use the hand tool
        </>
      );
    }
  }

  if (!hint) return null;

  return (
    <div className={styles.hint} role="note">
      {hint}
    </div>
  );
}
