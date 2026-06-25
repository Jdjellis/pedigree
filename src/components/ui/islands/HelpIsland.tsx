import { useUIStore } from '../../../stores/uiStore';
import { Island } from './Island';
import styles from './islands.module.css';

/**
 * Floating help island containing a keyboard shortcuts button.
 *
 * Renders a single `?` button that opens the shortcuts modal overlay.
 * The overlay component itself is implemented separately; this component
 * only handles the button and store interaction.
 *
 * @example
 * ```tsx
 * <HelpIsland />
 * ```
 */
export function HelpIsland(): React.JSX.Element {
  const handleHelpClick = (): void => {
    useUIStore.getState().openModal('shortcuts');
  };

  return (
    <Island aria-label="Help">
      <button
        type="button"
        className={styles.button}
        onClick={handleHelpClick}
        title="Keyboard shortcuts"
        aria-label="Keyboard shortcuts"
      >
        ?
      </button>
    </Island>
  );
}
