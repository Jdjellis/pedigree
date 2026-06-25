import { useCallback } from 'react';
import { usePedigreeStore } from '../../stores/pedigreeStore';
import { useUIStore } from '../../stores/uiStore';
import styles from './LegendOverlay.module.css';

/**
 * Compact bottom-left affordance for editing the legend.
 *
 * The rendered legend (the "Key" that also appears in exports) lives on the
 * canvas in {@link LegendLayer}. This overlay no longer duplicates that
 * condition list — it is purely an entry point that opens the legend editor.
 */
export function LegendOverlay(): React.ReactElement | null {
  const legendConfig = usePedigreeStore((s) => s.document.legendConfig);
  const openModal = useUIStore((s) => s.openModal);

  const handleEdit = useCallback((): void => {
    openModal('legendEditor');
  }, [openModal]);

  if (!legendConfig || legendConfig.entries.length === 0) {
    return null;
  }

  return (
    <button
      type="button"
      className={styles.editButton}
      onClick={handleEdit}
      title="Edit the on-canvas legend"
    >
      Edit Legend
    </button>
  );
}
