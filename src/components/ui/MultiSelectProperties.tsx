import { useMemo } from 'react';
import { usePedigreeStore } from '../../stores/pedigreeStore';
import { useUIStore } from '../../stores/uiStore';
import { GenderIdentity, SexAssignedAtBirth } from '../../types/enums';
import { GenderIconButtons } from './GenderIconButtons';
import styles from './PropertiesPanel.module.css';

/**
 * Returns the value shared by every element, or `undefined` when the array is
 * empty or its elements disagree (a "mixed" selection).
 */
export function sharedValue<T>(values: T[]): T | undefined {
  if (values.length === 0) return undefined;
  const [first, ...rest] = values;
  return rest.every((v) => v === first) ? first : undefined;
}

/**
 * Properties editor shown when more than one individual is selected. Edits the
 * agreed bulk-eligible fields across the whole selection; controls whose people
 * disagree render a "Mixed" state and write only on an explicit change. It is a
 * react-dom component, so Zustand subscriptions are safe here.
 */
export function MultiSelectProperties() {
  const selectedIds = useUIStore((s) => s.selectedIds);
  const editingLocked = useUIStore((s) => s.editingLocked);
  const individuals = usePedigreeStore((s) => s.document.individuals);
  const updateIndividuals = usePedigreeStore((s) => s.updateIndividuals);

  const ids = useMemo(
    () => Array.from(selectedIds).filter((id) => individuals[id]),
    [selectedIds, individuals],
  );
  const people = ids.map((id) => individuals[id]);

  if (people.length < 2) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>Select an individual to edit their properties</div>
      </div>
    );
  }

  const genderValue = sharedValue(people.map((p) => p.genderIdentity));
  const saabValue = sharedValue(people.map((p) => p.sexAssignedAtBirth ?? ''));

  return (
    <div className={styles.panel}>
      <fieldset
        disabled={editingLocked}
        style={{ border: 'none', margin: 0, padding: 0, minInlineSize: 0 }}
      >
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{people.length} people selected</div>
        </div>

        <div className={styles.divider} />

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Identity</div>

          <div className={styles.field}>
            <label className={styles.label}>Gender Identity</label>
            {/* A value not in the enum renders no active button — our "Mixed" state. */}
            <GenderIconButtons
              value={genderValue ?? ('' as GenderIdentity)}
              onChange={(v) => updateIndividuals(ids, { genderIdentity: v })}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Sex Assigned at Birth</label>
            <select
              className={styles.select}
              value={saabValue ?? ''}
              onChange={(e) =>
                updateIndividuals(ids, {
                  sexAssignedAtBirth: (e.target.value || undefined) as
                    | SexAssignedAtBirth
                    | undefined,
                })
              }
            >
              <option value="">{saabValue === undefined ? 'Mixed' : 'Not specified'}</option>
              <option value={SexAssignedAtBirth.AMAB}>AMAB</option>
              <option value={SexAssignedAtBirth.AFAB}>AFAB</option>
              <option value={SexAssignedAtBirth.UAAB}>UAAB</option>
            </select>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
