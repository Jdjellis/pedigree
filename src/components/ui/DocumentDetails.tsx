import { useEffect, useRef } from 'react';
import type { PedigreeMetadata } from '../../types/pedigree';
import styles from './DocumentDetails.module.css';

/**
 * Props for {@link DocumentDetails}.
 */
export interface DocumentDetailsProps {
  /** The current document metadata, used to populate the field values. */
  metadata: PedigreeMetadata;
  /**
   * Commits a partial metadata change (wired to the store's `updateMetadata`).
   * Called on every edit so changes flow into autosave immediately.
   */
  onChange: (patch: Partial<PedigreeMetadata>) => void;
  /** Closes the popover (e.g. on outside click, Escape, or the Done button). */
  onClose: () => void;
}

/**
 * Compact popover for editing the document's identity fields: author,
 * institution, and reference condition. The document date is derived
 * automatically from `metadata.updatedAt` and shown read-only.
 *
 * Rendered anchored within the document-identity island. Closes on outside
 * click or the Escape key. Each field commits on change via
 * {@link DocumentDetailsProps.onChange} so edits are picked up by autosave.
 */
export function DocumentDetails({
  metadata,
  onChange,
  onClose,
}: DocumentDetailsProps): React.JSX.Element {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent): void => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const dateStr = new Date(metadata.updatedAt).toLocaleDateString();

  return (
    <div
      ref={popoverRef}
      className={styles.popover}
      role="dialog"
      aria-label="Document details"
    >
      <h2 className={styles.heading}>Document details</h2>

      <label className={styles.field}>
        <span className={styles.label}>Author</span>
        <input
          className={styles.input}
          type="text"
          value={metadata.author ?? ''}
          placeholder="e.g. Dr. Jane Smith"
          onChange={(e) => onChange({ author: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Institution</span>
        <input
          className={styles.input}
          type="text"
          value={metadata.institution ?? ''}
          placeholder="e.g. Royal Melbourne Hospital"
          onChange={(e) => onChange({ institution: e.target.value })}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Reference condition</span>
        <input
          className={styles.input}
          type="text"
          value={metadata.referenceCondition ?? ''}
          placeholder="e.g. Hereditary breast cancer"
          onChange={(e) => onChange({ referenceCondition: e.target.value })}
        />
      </label>

      <div className={styles.field}>
        <span className={styles.label}>Date</span>
        <span className={styles.readonlyValue}>{dateStr}</span>
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.doneButton}
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </div>
  );
}
