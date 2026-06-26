import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAutoSave } from './useAutoSave';
import {
  usePedigreeStore,
  createDefaultDocument,
  createDefaultIndividual,
} from '../stores/pedigreeStore';
import { useUIStore } from '../stores/uiStore';

const STORAGE_KEY = 'pedigree-editor-autosave';

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    usePedigreeStore.getState().resetDocument();
    useUIStore.getState().setLastSavedAt(0);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('restore on mount', () => {
    it('loads a saved document from localStorage', () => {
      const saved = createDefaultDocument();
      saved.metadata.title = 'Restored';
      const ind = createDefaultIndividual();
      saved.individuals[ind.id] = ind;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

      renderHook(() => useAutoSave());

      expect(usePedigreeStore.getState().document.metadata.title).toBe('Restored');
      expect(usePedigreeStore.getState().document.individuals[ind.id]).toBeDefined();
    });

    it('backfills a missing legendConfig on legacy documents', () => {
      const legacy = createDefaultDocument() as unknown as Record<string, unknown>;
      delete legacy.legendConfig;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));

      renderHook(() => useAutoSave());

      expect(usePedigreeStore.getState().document.legendConfig).toEqual({
        entries: [],
        position: { x: 50, y: 50 },
      });
    });

    it('backfills conditionIds on individuals that predate the field', () => {
      const doc = createDefaultDocument();
      const ind = createDefaultIndividual();
      doc.individuals[ind.id] = ind;
      const raw = JSON.parse(JSON.stringify(doc));
      delete raw.individuals[ind.id].conditionIds;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));

      renderHook(() => useAutoSave());

      expect(
        usePedigreeStore.getState().document.individuals[ind.id].conditionIds,
      ).toEqual([]);
    });

    it('ignores corrupt JSON and keeps the current document', () => {
      localStorage.setItem(STORAGE_KEY, '{not valid json');
      const before = usePedigreeStore.getState().document;

      renderHook(() => useAutoSave());

      expect(usePedigreeStore.getState().document).toBe(before);
    });

    it('ignores a payload that is not a document', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
      const before = usePedigreeStore.getState().document;

      renderHook(() => useAutoSave());

      expect(usePedigreeStore.getState().document).toBe(before);
    });
  });

  describe('debounced save', () => {
    it('writes to localStorage after the debounce window and records lastSavedAt', () => {
      renderHook(() => useAutoSave());

      const ind = createDefaultIndividual();
      act(() => {
        usePedigreeStore.getState().addIndividual(ind);
      });

      // Nothing written before the debounce elapses.
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(saved.individuals[ind.id]).toBeDefined();
      expect(useUIStore.getState().lastSavedAt).toBeGreaterThan(0);
    });

    it('coalesces rapid edits into a single write', () => {
      renderHook(() => useAutoSave());

      const setSpy = vi.spyOn(Storage.prototype, 'setItem');

      act(() => {
        usePedigreeStore.getState().addIndividual(createDefaultIndividual());
        vi.advanceTimersByTime(500);
        usePedigreeStore.getState().addIndividual(createDefaultIndividual());
        vi.advanceTimersByTime(500);
        usePedigreeStore.getState().addIndividual(createDefaultIndividual());
      });

      // Still within the debounce of the latest edit — no write yet.
      expect(setSpy).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(setSpy).toHaveBeenCalledTimes(1);
      setSpy.mockRestore();
    });

    it('stops saving after unmount', () => {
      const { unmount } = renderHook(() => useAutoSave());
      unmount();

      const setSpy = vi.spyOn(Storage.prototype, 'setItem');
      act(() => {
        usePedigreeStore.getState().addIndividual(createDefaultIndividual());
        vi.advanceTimersByTime(2000);
      });

      expect(setSpy).not.toHaveBeenCalled();
      setSpy.mockRestore();
    });
  });
});
