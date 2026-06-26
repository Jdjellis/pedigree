import clsx from 'clsx';
import styles from './islands.module.css';

/** Props for {@link ToolButton}. */
export interface ToolButtonProps {
  /** Accessible label (also the tooltip text). */
  label: string;
  /** Shortcut number shown as a badge; omit for modal helpers (lock/hand). */
  shortcut?: string;
  /** Icon node to render. */
  icon: React.ReactNode;
  /** Whether this tool/toggle is currently active. */
  active: boolean;
  /** Click handler. */
  onClick: () => void;
}

/**
 * A single floating-toolbar button: an icon, an optional shortcut badge, and an
 * active (violet) state. Lives in the react-dom tree, so reactive store reads
 * are safe in the parent that renders it.
 */
export function ToolButton({
  label,
  shortcut,
  icon,
  active,
  onClick,
}: ToolButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={clsx(styles.toolButton, active && styles.buttonActive)}
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active}
    >
      <span className={styles.toolIcon} aria-hidden="true">
        {icon}
      </span>
      {shortcut && <span className={styles.toolBadge} aria-hidden="true">{shortcut}</span>}
    </button>
  );
}
