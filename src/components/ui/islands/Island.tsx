import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './Island.module.css';

/**
 * Props for {@link Island}.
 */
export interface IslandProps {
  /** Content to render inside the island chrome. */
  children: ReactNode;
  /** Additional CSS class name(s) to merge onto the root element. */
  className?: string;
  /**
   * Accessible label for the island container.
   * Required for non-decorative islands so assistive technology can identify
   * each control group (e.g. "Tools", "Zoom controls").
   */
  'aria-label'?: string;
}

/**
 * Shared chrome wrapper for every floating control island in the canvas UI.
 *
 * Renders a flex container with surface background, hairline border, rounded
 * corners, and a soft drop shadow. Pass `className` to override or extend
 * layout from the parent (e.g. flex-direction, gap overrides).
 *
 * This component is intentionally dumb — it has no store access and takes
 * only props so it can be composed freely.
 *
 * @example
 * ```tsx
 * <Island aria-label="Tools">
 *   <ToolButton icon={<PenIcon />} label="Draw" />
 * </Island>
 * ```
 */
export function Island({
  children,
  className,
  'aria-label': ariaLabel,
}: IslandProps): React.JSX.Element {
  return (
    <div
      role="toolbar"
      aria-label={ariaLabel}
      className={clsx(styles.island, className)}
    >
      {children}
    </div>
  );
}
