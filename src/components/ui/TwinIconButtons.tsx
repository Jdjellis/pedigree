import type { ReactElement } from 'react';
import { TwinType } from '../../types/enums';
import styles from './TwinIconButtons.module.css';

const SYMBOL_SIZE = 26;

/**
 * Monozygotic glyph: the pedigree twin "V" (two lines from a shared apex) WITH
 * the horizontal crossbar that denotes identical twins — mirroring how the
 * on-canvas {@link TwinConnector} draws an MZ pair.
 */
function MonozygoticSymbol() {
  return (
    <svg width={SYMBOL_SIZE} height={SYMBOL_SIZE} viewBox="0 0 28 28" aria-hidden="true">
      <path
        d="M14 4 L6 24 M14 4 L22 24 M9 15 L19 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Dizygotic glyph: the same twin "V" WITHOUT the crossbar (fraternal). */
function DizygoticSymbol() {
  return (
    <svg width={SYMBOL_SIZE} height={SYMBOL_SIZE} viewBox="0 0 28 28" aria-hidden="true">
      <path
        d="M14 4 L6 24 M14 4 L22 24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

interface TwinOption {
  value: TwinType;
  label: string;
  initial: string;
  Symbol: () => ReactElement;
}

const TWIN_OPTIONS: TwinOption[] = [
  { value: TwinType.Monozygotic, label: 'Monozygotic twin', initial: 'MZ', Symbol: MonozygoticSymbol },
  { value: TwinType.Dizygotic, label: 'Dizygotic twin', initial: 'DZ', Symbol: DizygoticSymbol },
];

interface TwinIconButtonsProps {
  /** Called with the chosen zygosity when a twin button is clicked. */
  onPick: (twinType: TwinType) => void;
}

/**
 * MZ / DZ twin buttons rendered in the gender popup's icon language, so they sit
 * beside the gender icons as a second section of the same row. Clicking one
 * creates a co-twin of the just-created person (see the picker's `makeTwin`).
 */
export function TwinIconButtons({ onPick }: TwinIconButtonsProps): ReactElement {
  return (
    <div className={styles.group} role="group" aria-label="Make twins">
      {TWIN_OPTIONS.map(({ value, label, initial, Symbol }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          className={styles.iconButton}
          onClick={() => onPick(value)}
        >
          <Symbol />
          <span className={styles.iconInitial}>{initial}</span>
        </button>
      ))}
    </div>
  );
}
