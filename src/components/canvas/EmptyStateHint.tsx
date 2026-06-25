import type { ReactElement } from 'react';
import { usePedigreeStore } from '../../stores/pedigreeStore';
import styles from './EmptyStateHint.module.css';

/**
 * A calm, Excalidraw-style onboarding hint centered over the canvas area.
 *
 * Rendered only when the pedigree contains zero individuals, giving a
 * first-time clinician a gentle cue for where to begin. It is a plain
 * react-dom overlay (not a Konva node), so it never appears in canvas
 * exports, and it is fully non-interactive (`pointer-events: none`) so it
 * never blocks canvas interaction.
 *
 * @returns The hint overlay, or `null` when at least one individual exists.
 */
export function EmptyStateHint(): ReactElement | null {
  const individualCount = usePedigreeStore(
    (s) => Object.keys(s.document.individuals).length
  );

  if (individualCount > 0) {
    return null;
  }

  return (
    <div className={styles.hint} aria-hidden="true">
      <p className={styles.primary}>
        Click <span className={styles.action}>+ Person</span> to start
      </p>
      <p className={styles.secondary}>hover a symbol to add relatives</p>
    </div>
  );
}
