import { useCallback, useState } from 'react';
import { usePedigreeStore } from '../../stores/pedigreeStore';
import { useUIStore } from '../../stores/uiStore';
import {
  GenderIdentity,
  SexAssignedAtBirth,
  VitalStatus,
} from '../../types/enums';
import { generateId } from '../../utils/idGenerator';
import type { Individual } from '../../types/pedigree';
import styles from './PropertiesPanel.module.css';

export function PropertiesPanel() {
  const selectedIds = useUIStore((s) => s.selectedIds);
  const propertiesPanelOpen = useUIStore((s) => s.propertiesPanelOpen);
  const individuals = usePedigreeStore((s) => s.document.individuals);
  const updateIndividual = usePedigreeStore((s) => s.updateIndividual);
  const legendConfig = usePedigreeStore((s) => s.document.legendConfig);

  const selectedId =
    selectedIds.size === 1 ? Array.from(selectedIds)[0] : null;
  const individual = selectedId ? individuals[selectedId] : null;

  const update = useCallback(
    (patch: Partial<Individual>) => {
      if (selectedId) updateIndividual(selectedId, patch);
    },
    [selectedId, updateIndividual]
  );

  const [addingNote, setAddingNote] = useState(false);
  const [noteName, setNoteName] = useState('');
  const [noteAge, setNoteAge] = useState('');

  const resetNoteForm = useCallback(() => {
    setAddingNote(false);
    setNoteName('');
    setNoteAge('');
  }, []);

  const submitNote = useCallback(() => {
    if (!individual) return;
    const name = noteName.trim();
    if (!name) return;
    const parsedAge = noteAge.trim() ? parseInt(noteAge, 10) : NaN;
    const ageOfOnset = !isNaN(parsedAge) ? parsedAge : undefined;
    update({
      conditions: [
        ...individual.conditions,
        {
          id: generateId(),
          name,
          ageOfOnset,
        },
      ],
    });
    resetNoteForm();
  }, [individual, noteName, noteAge, update, resetNoteForm]);

  if (!propertiesPanelOpen || !individual) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          Select an individual to edit their properties
        </div>
      </div>
    );
  }

  const toggleCondition = (entryId: string) => {
    const current = individual.conditionIds ?? [];
    const next = current.includes(entryId)
      ? current.filter((id) => id !== entryId)
      : [...current, entryId];
    update({ conditionIds: next });
  };

  const applicableEntries = legendConfig.entries.filter((entry) => {
    if (!entry.applicableTo) return true;
    if (entry.applicableTo === 'man' && individual.genderIdentity === GenderIdentity.Man) return true;
    if (entry.applicableTo === 'woman' && individual.genderIdentity === GenderIdentity.Woman) return true;
    return false;
  });

  return (
    <div className={styles.panel}>
      {/* Identity Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Identity</div>

        <div className={styles.field}>
          <label className={styles.label}>Name / Initials</label>
          <input
            className={styles.input}
            value={individual.displayName ?? ''}
            onChange={(e) =>
              update({ displayName: e.target.value || undefined })
            }
            placeholder="Name or initials"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Gender Identity</label>
          <select
            className={styles.select}
            value={individual.genderIdentity}
            onChange={(e) =>
              update({
                genderIdentity: e.target.value as GenderIdentity,
              })
            }
          >
            <option value={GenderIdentity.Unknown}>Unknown</option>
            <option value={GenderIdentity.Man}>Man</option>
            <option value={GenderIdentity.Woman}>Woman</option>
            <option value={GenderIdentity.NonBinary}>Non-binary</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Sex Assigned at Birth</label>
          <select
            className={styles.select}
            value={individual.sexAssignedAtBirth ?? ''}
            onChange={(e) =>
              update({
                sexAssignedAtBirth: (e.target.value ||
                  undefined) as SexAssignedAtBirth | undefined,
              })
            }
          >
            <option value="">Not specified</option>
            <option value={SexAssignedAtBirth.AMAB}>AMAB</option>
            <option value={SexAssignedAtBirth.AFAB}>AFAB</option>
            <option value={SexAssignedAtBirth.UAAB}>UAAB</option>
          </select>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Clinical Section - Condition Checkboxes */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Conditions</div>

        {applicableEntries.length === 0 ? (
          <p className={styles.hint}>
            {legendConfig.entries.length === 0
              ? 'No conditions defined. Use the Legend editor to add conditions.'
              : 'No conditions apply to this individual.'}
          </p>
        ) : (
          applicableEntries.map((entry) => (
            <div key={entry.id} className={styles.field}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={(individual.conditionIds ?? []).includes(entry.id)}
                  onChange={() => toggleCondition(entry.id)}
                />
                <span
                  className={styles.conditionSwatch}
                  style={{ backgroundColor: entry.fillColor }}
                />
                {entry.name}
              </label>
            </div>
          ))
        )}
      </div>

      <div className={styles.divider} />

      {/* Clinical Notes */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Clinical Notes</div>

        <div className={styles.field}>
          {individual.conditions.map((condition, idx) => (
            <div key={condition.id} className={styles.conditionItem}>
              <span className={styles.conditionName}>
                {condition.name}
                {condition.ageOfOnset != null
                  ? ` (onset: ${condition.ageOfOnset})`
                  : ''}
              </span>
              <button
                className={styles.removeButton}
                onClick={() =>
                  update({
                    conditions: individual.conditions.filter(
                      (_, i) => i !== idx
                    ),
                  })
                }
              >
                &times;
              </button>
            </div>
          ))}
          {addingNote ? (
            <div className={styles.noteForm}>
              <input
                className={styles.input}
                value={noteName}
                onChange={(e) => setNoteName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitNote();
                  if (e.key === 'Escape') resetNoteForm();
                }}
                placeholder="Clinical note / condition"
                autoFocus
              />
              <input
                className={styles.input}
                type="number"
                value={noteAge}
                onChange={(e) => setNoteAge(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitNote();
                  if (e.key === 'Escape') resetNoteForm();
                }}
                placeholder="Age of onset (optional)"
                min={0}
              />
              <div className={styles.noteFormActions}>
                <button
                  className={styles.noteAddButton}
                  onClick={submitNote}
                  disabled={!noteName.trim()}
                >
                  Add
                </button>
                <button
                  className={styles.noteCancelButton}
                  onClick={resetNoteForm}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className={styles.addButton}
              onClick={() => setAddingNote(true)}
            >
              + Add Note
            </button>
          )}
        </div>
      </div>

      <div className={styles.divider} />

      {/* Vital Status Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Vital Status</div>

        <div className={styles.field}>
          <label className={styles.label}>Status</label>
          <select
            className={styles.select}
            value={individual.vitalStatus}
            onChange={(e) =>
              update({
                vitalStatus: e.target.value as VitalStatus,
              })
            }
          >
            <option value={VitalStatus.Alive}>Alive</option>
            <option value={VitalStatus.Deceased}>Deceased</option>
            <option value={VitalStatus.Stillborn}>Stillborn</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Age</label>
          <input
            className={styles.input}
            type="number"
            value={individual.age ?? ''}
            onChange={(e) =>
              update({
                age: e.target.value
                  ? parseInt(e.target.value, 10)
                  : undefined,
              })
            }
            placeholder="Age"
            min={0}
          />
        </div>

        {individual.vitalStatus === VitalStatus.Deceased && (
          <div className={styles.field}>
            <label className={styles.label}>Cause of Death</label>
            <input
              className={styles.input}
              value={individual.causeOfDeath ?? ''}
              onChange={(e) =>
                update({
                  causeOfDeath: e.target.value || undefined,
                })
              }
              placeholder="Cause of death"
            />
          </div>
        )}
      </div>

      <div className={styles.divider} />

      {/* Pedigree Role Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Pedigree Role</div>

        <div className={styles.field}>
          <label className={styles.label}>Role</label>
          <select
            className={styles.select}
            value={
              individual.isProband
                ? 'proband'
                : individual.isConsultand
                  ? 'consultand'
                  : 'none'
            }
            onChange={(e) => {
              const val = e.target.value;
              update({
                isProband: val === 'proband',
                isConsultand: val === 'consultand',
              });
            }}
          >
            <option value="none">None</option>
            <option value="proband">Proband</option>
            <option value="consultand">Consultand</option>
          </select>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Notes Section */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Notes</div>
        <div className={styles.field}>
          <textarea
            className={styles.input}
            value={individual.notes ?? ''}
            onChange={(e) =>
              update({ notes: e.target.value || undefined })
            }
            placeholder="Internal notes..."
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>
      </div>
    </div>
  );
}
