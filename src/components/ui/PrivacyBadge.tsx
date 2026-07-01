import { useState, useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { Island } from './islands/Island';
import islandStyles from './islands/islands.module.css';
import styles from './PrivacyBadge.module.css';

/**
 * Floating badge indicating local-first data privacy.
 *
 * Renders a small lock button in the bottom-right chrome. Clicking it opens
 * an inline popover explaining that pedigree data never leaves the browser.
 * Dismissed by clicking outside, pressing Escape, or clicking the badge again.
 */
export function PrivacyBadge(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (e: MouseEvent): void => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      {open && (
        <div className={styles.popover} role="status" aria-live="polite">
          <p className={styles.heading}>Your data stays on your device.</p>
          <p className={styles.body}>
            Nothing is ever sent to a server — all pedigree data is stored
            locally in your browser only.
          </p>
          <p className={styles.disclaimer}>
            For documentation and educational use. Not a medical device and not
            for diagnostic decisions — verify every pedigree against the source
            record.
          </p>
        </div>
      )}
      <Island aria-label="Privacy information">
        <button
          type="button"
          className={islandStyles.button}
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Privacy information"
          aria-expanded={open}
          title="Privacy information"
        >
          <Lock size={18} />
        </button>
      </Island>
    </div>
  );
}
