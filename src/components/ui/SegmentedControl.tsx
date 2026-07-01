import styles from './SegmentedControl.module.css';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  /** When true the whole control is inert (buttons natively disabled). */
  disabled?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
}: SegmentedControlProps<T>) {
  return (
    <div className={styles.segmented} role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${styles.segment} ${opt.value === value ? styles.segmentActive : ''}`}
          aria-pressed={opt.value === value}
          disabled={disabled}
          onClick={() => {
            if (opt.value !== value) onChange(opt.value);
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
