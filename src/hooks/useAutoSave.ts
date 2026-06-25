import { useEffect } from 'react';
import { usePedigreeStore } from '../stores/pedigreeStore';

const STORAGE_KEY = 'pedigree-editor-autosave';
const DEBOUNCE_MS = 2000;

/**
 * Auto-saves the pedigree document to localStorage on changes.
 * Debounced to avoid excessive writes during rapid edits (e.g. dragging).
 *
 * On mount, restores the document from localStorage if one exists.
 */
export function useAutoSave() {
  // Restore on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const doc = JSON.parse(saved);
        if (doc && typeof doc === 'object' && 'individuals' in doc) {
          // Migrate: ensure legendConfig exists
          if (!doc.legendConfig) {
            doc.legendConfig = { entries: [], position: { x: 50, y: 50 } };
          }
          // Migrate: conditionNames -> name
          for (const entry of doc.legendConfig.entries) {
            if (entry.conditionNames && !entry.name) {
              entry.name = entry.conditionNames.default;
              delete entry.conditionNames;
            }
          }
          // Migrate: ensure conditionIds on all individuals
          for (const ind of Object.values(doc.individuals)) {
            const individual = ind as Record<string, unknown>;
            if (!individual.conditionIds) {
              individual.conditionIds = [];
            }
          }
          usePedigreeStore.getState().setDocument(doc);
        }
      }
    } catch {
      // Corrupt data — ignore and start fresh
    }
  }, []);

  // Subscribe to store changes and auto-save
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = usePedigreeStore.subscribe((state) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state.document));
        } catch {
          // localStorage full or unavailable — ignore
        }
      }, DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);
}
