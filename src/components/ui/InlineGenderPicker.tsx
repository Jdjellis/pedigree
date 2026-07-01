// src/components/ui/InlineGenderPicker.tsx
import { useEffect, useCallback } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useViewportStore } from '../../stores/viewportStore';
import { usePedigreeStore } from '../../stores/pedigreeStore';
import { GenderIdentity, TwinType } from '../../types/enums';
import { GenderIconButtons } from './GenderIconButtons';
import { TwinIconButtons } from './TwinIconButtons';
import { commitGenderPick } from './commitGenderPick';
import { addTwinOf, isTwin } from './addTwin';
import { featureFlags } from '../../config/featureFlags';
import styles from './InlineGenderPicker.module.css';

/** Screen-px gap between the node anchor and the picker sitting above it. */
const PICKER_GAP = 48;

/** Single-key shortcuts for quick gender selection. */
const KEY_TO_GENDER: Record<string, GenderIdentity> = {
  m: GenderIdentity.Man,
  f: GenderIdentity.Woman,
  n: GenderIdentity.NonBinary,
  u: GenderIdentity.Unknown,
};

/**
 * Inline gender picker: a small HTML overlay anchored above a just-created
 * individual, letting the user choose its gender identity by click or keystroke
 * (M/F/N/U) without visiting the Properties panel. Rendered in the react-dom
 * tree (sibling of the Konva stage), so subscribing to Zustand here is safe.
 *
 * Dismissal (Esc/Enter/click-away) keeps the current shape. The pick is routed
 * through `commitGenderPick` so create + pick collapse into one undo step.
 */
export function InlineGenderPicker(): React.JSX.Element | null {
  const targetId = useUIStore((s) => s.genderPicker.targetId);
  const editingLocked = useUIStore((s) => s.editingLocked);
  const scale = useViewportStore((s) => s.scale);
  const viewportX = useViewportStore((s) => s.position.x);
  const viewportY = useViewportStore((s) => s.position.y);
  const target = usePedigreeStore((s) =>
    targetId ? s.document.individuals[targetId] : undefined,
  );
  // Only offer "make twins" for someone not already twinned, so a person can't
  // be double-grouped. Reactive so the section disappears once the twin exists.
  const alreadyTwin = usePedigreeStore((s) =>
    targetId ? isTwin(s.document, targetId) : false,
  );
  // During first-run onboarding the document holds just the seed person and the
  // picker pops on it to choose a sex. Offering "make twins" there would spawn a
  // floating co-twin before the user has built any family, so suppress the twin
  // section until the pedigree has grown past the lone seed. Mirrors
  // shouldShowOnboarding's `individualCount <= 1` definition. Every other
  // gender-picker trigger (radial child/sibling/partner) already has >= 2 people.
  const isSeedPerson = usePedigreeStore(
    (s) => Object.keys(s.document.individuals).length <= 1,
  );

  const dismiss = useCallback(() => {
    if (targetId) commitGenderPick(targetId, null);
  }, [targetId]);

  // Turn the just-created person into a twin: create their co-twin, group the
  // pair, and re-anchor the picker onto the new twin (addTwinOf does this) so
  // the user can set its sex next. Shared with the radial menu's ⌥ split.
  const makeTwin = useCallback(
    (twinType: TwinType) => {
      if (!target) return;
      addTwinOf(usePedigreeStore.getState().document, target, twinType);
    },
    [target],
  );

  // Self-clear: if the picker's target disappears (undo, delete, import) while
  // the picker is open, dismiss it so the radial menu gate is not left stuck.
  useEffect(() => {
    if (targetId && !target) useUIStore.getState().hideGenderPicker();
  }, [targetId, target]);

  // Capture-phase listener so M/F/N/U/Esc/Enter resolve the picker before any
  // global shortcut sees them.
  useEffect(() => {
    if (!targetId || !target || editingLocked) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      const gender = KEY_TO_GENDER[e.key.toLowerCase()];
      if (gender !== undefined) {
        // Don't hijack system / app modified shortcuts (Cmd+F, Ctrl+N, etc.).
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        e.preventDefault();
        e.stopPropagation();
        commitGenderPick(targetId, gender);
      } else if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        commitGenderPick(targetId, null);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [targetId, target, editingLocked]);

  if (!targetId || !target || editingLocked) return null;

  const left = target.position.x * scale + viewportX;
  const top = target.position.y * scale + viewportY - PICKER_GAP;

  return (
    <>
      <div className={styles.backdrop} onClick={dismiss} aria-hidden="true" />
      <div
        className={styles.picker}
        style={{ left, top }}
        role="dialog"
        aria-label="Choose gender identity"
      >
        <div className={styles.row}>
          <GenderIconButtons
            value={target.genderIdentity}
            onChange={(gender) => commitGenderPick(targetId, gender)}
          />
          {featureFlags.twinsInGenderPopup && !alreadyTwin && !isSeedPerson && (
            <>
              <div className={styles.divider} aria-hidden="true" />
              <TwinIconButtons onPick={makeTwin} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
