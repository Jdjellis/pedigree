import { useEffect, useRef, useState } from 'react';
import { usePedigreeStore } from '../../stores/pedigreeStore';
import { useUIStore } from '../../stores/uiStore';
import { useViewportStore } from '../../stores/viewportStore';
import { useEditorActions } from '../../commands/useEditorActions';
import { DocumentDetails } from './DocumentDetails';
import styles from './Toolbar.module.css';
import clsx from 'clsx';

const PLACEHOLDER_TITLE = 'Untitled Pedigree';
/** localStorage flag marking the one-time local-only notice as dismissed. */
const LOCAL_NOTICE_DISMISSED_KEY = 'pedigree-editor-local-notice-dismissed';

/**
 * Formats a "Saved locally" suffix as a coarse relative time. Kept intentionally
 * simple — the indicator is reassurance, not a precise clock.
 */
function formatRelativeSave(timestamp: number | null, now: number): string {
  // No autosave has fired yet this session — the document is trivially in its
  // saved (empty/restored) state, so reassure rather than imply pending work.
  if (timestamp === null) return 'Saved locally';
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 5) return 'Saved locally';
  if (seconds < 60) return `Saved locally · ${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Saved locally · ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `Saved locally · ${hours}h ago`;
}

/**
 * The top application toolbar: document title (click-to-edit), document-details
 * popover, document/edit/view actions, and the local-first "Saved locally"
 * status. Renders the one-time local-only-data notice within its own subtree.
 */
export function Toolbar() {
  const updateMetadata = usePedigreeStore((s) => s.updateMetadata);
  const doc = usePedigreeStore((s) => s.document);
  const metadata = doc.metadata;
  const title = metadata.title;

  const selectedIds = useUIStore((s) => s.selectedIds);
  const activeTool = useUIStore((s) => s.activeTool);
  const lastSavedAt = useUIStore((s) => s.lastSavedAt);

  const scale = useViewportStore((s) => s.scale);

  const actions = useEditorActions();

  // --- Title click-to-edit ---
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle) {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }
  }, [isEditingTitle]);

  const startEditingTitle = (): void => {
    setTitleDraft(title);
    setIsEditingTitle(true);
  };

  const commitTitle = (): void => {
    updateMetadata({ title: titleDraft.trim() });
    setIsEditingTitle(false);
  };

  const cancelTitle = (): void => {
    setTitleDraft(title);
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitTitle();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelTitle();
    }
  };

  // --- Document details popover ---
  const [detailsOpen, setDetailsOpen] = useState(false);

  // --- "Saved locally" relative-time tick ---
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(intervalId);
  }, []);
  const saveStatus = formatRelativeSave(lastSavedAt, now);

  // --- One-time local-only-data notice ---
  const [noticeDismissed, setNoticeDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LOCAL_NOTICE_DISMISSED_KEY) === 'true';
    } catch {
      // localStorage unavailable — treat as already dismissed to avoid nagging.
      return true;
    }
  });

  const dismissNotice = (): void => {
    setNoticeDismissed(true);
    try {
      localStorage.setItem(LOCAL_NOTICE_DISMISSED_KEY, 'true');
    } catch {
      // localStorage unavailable — state still updated for this session.
    }
  };

  return (
    <div className={styles.toolbar}>
      <div className={styles.documentInfo}>
        <div className={styles.titleRow}>
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              className={styles.titleInput}
              type="text"
              value={titleDraft}
              placeholder={PLACEHOLDER_TITLE}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={handleTitleKeyDown}
              aria-label="Document title"
            />
          ) : (
            <button
              type="button"
              className={clsx(styles.title, !title && styles.titlePlaceholder)}
              onClick={startEditingTitle}
              title="Click to rename this pedigree"
            >
              {title || PLACEHOLDER_TITLE}
            </button>
          )}

          <div className={styles.detailsAnchor}>
            <button
              type="button"
              className={clsx(styles.button, styles.detailsButton)}
              onClick={() => setDetailsOpen((open) => !open)}
              aria-expanded={detailsOpen}
              aria-haspopup="dialog"
              title="Document details (author, institution, reference condition)"
            >
              &#9432;
            </button>
            {detailsOpen && (
              <DocumentDetails
                metadata={metadata}
                onChange={updateMetadata}
                onClose={() => setDetailsOpen(false)}
              />
            )}
          </div>
        </div>

        <span
          className={styles.saveStatus}
          title="Your work lives only in this browser. Export → JSON to keep a permanent copy."
        >
          {saveStatus}
        </span>
      </div>

      {!noticeDismissed && (
        <div className={styles.localNotice} role="status">
          <span className={styles.localNoticeText}>
            Your work is saved only in this browser. Export → JSON to keep a
            permanent copy.
          </span>
          <button
            type="button"
            className={styles.localNoticeDismiss}
            onClick={dismissNotice}
            title="Dismiss"
            aria-label="Dismiss local-storage notice"
          >
            &times;
          </button>
        </div>
      )}

      <div className={styles.separator} />

      <div className={styles.group}>
        <button
          className={clsx(styles.button, styles.textButton)}
          onClick={actions.newDocument}
          title="New Pedigree"
        >
          New
        </button>
        <button
          className={clsx(styles.button, styles.textButton)}
          onClick={actions.openDocument}
          title="Open JSON (Cmd+O)"
        >
          Open
        </button>
        <button
          className={clsx(styles.button, styles.textButton)}
          onClick={actions.importPed}
          title="Import PED format"
        >
          Import
        </button>
        <button
          className={clsx(styles.button, styles.textButton)}
          onClick={actions.exportDocument}
          title="Export"
        >
          Export
        </button>
        <button
          className={clsx(styles.button, styles.textButton)}
          onClick={actions.openLegend}
          title="Configure legend / key"
        >
          Legend
        </button>
      </div>

      <div className={styles.separator} />

      <div className={styles.group}>
        <button
          className={styles.button}
          onClick={actions.undo}
          title="Undo (Cmd+Z)"
        >
          &#x21A9;
        </button>
        <button
          className={styles.button}
          onClick={actions.redo}
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
          onClick={actions.selectTool}
          title="Select tool"
        >
          Select
        </button>
        <button
          className={clsx(styles.button, styles.textButton)}
          onClick={actions.addPerson}
          title="Add Individual"
        >
          + Person
        </button>
      </div>

      <div className={styles.separator} />

      <button
        className={clsx(styles.button, styles.textButton)}
        onClick={actions.deleteSelected}
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
          onClick={actions.zoomOut}
          title="Zoom Out"
        >
          &minus;
        </button>
        <span className={styles.zoomDisplay}>
          {Math.round(scale * 100)}%
        </span>
        <button
          className={styles.button}
          onClick={actions.zoomIn}
          title="Zoom In"
        >
          +
        </button>
        <button
          className={clsx(styles.button, styles.textButton)}
          onClick={actions.resetView}
          title="Reset View"
        >
          Fit
        </button>
      </div>
    </div>
  );
}
