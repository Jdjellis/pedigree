import { useUIStore } from '../../../stores/uiStore';
import styles from './ZenModeExit.module.css';

/**
 * The lone affordance shown while zen mode is active.
 *
 * Zen mode hides every editing island, so without this the only ways back out
 * are the `Z` shortcut and the ⌘K command palette — neither discoverable. This
 * renders a small centred "Exit zen mode" pill at the bottom of the canvas
 * (mirroring Excalidraw) so the mode is never a trap.
 *
 * Renders nothing when zen mode is off. Lives in the react-dom tree, so the
 * Zustand subscription is safe here.
 */
export function ZenModeExit(): React.JSX.Element | null {
  const zenMode = useUIStore((s) => s.zenMode);

  if (!zenMode) return null;

  return (
    <button
      type="button"
      className={styles.exitButton}
      onClick={() => useUIStore.getState().setZenMode(false)}
      aria-keyshortcuts="Z"
    >
      Exit zen mode
      <kbd className={styles.kbd} aria-hidden="true">
        Z
      </kbd>
    </button>
  );
}
