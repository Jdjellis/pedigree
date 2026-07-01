/**
 * Coverage for the useEditorActions actions that the existing
 * useEditorActions.test.tsx (tool activators + editing lock) leaves untested:
 * document lifecycle (new / modals / add-text), history (undo / redo), and the
 * viewport actions (zoom in/out, reset, and the fit-view fallback path).
 *
 * All actions read stores via getState(), so tests drive the real stores and
 * assert on their resulting state rather than mocking.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEditorActions } from './useEditorActions';
import {
  usePedigreeStore,
  createDefaultDocument,
  createDefaultIndividual,
} from '../stores/pedigreeStore';
import { useUIStore } from '../stores/uiStore';
import { useViewportStore } from '../stores/viewportStore';
import { DEFAULT_ZOOM } from '../utils/constants';

beforeEach(() => {
  usePedigreeStore.getState().setDocument(createDefaultDocument());
  useUIStore.setState({
    activeTool: 'select',
    editingLocked: false,
    activeModal: null,
    selectedIds: new Set<string>(),
    editingAnnotationId: null,
  });
  useViewportStore.getState().resetView();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useEditorActions document lifecycle', () => {
  it('opens the import / export / legend modals', () => {
    const { result } = renderHook(() => useEditorActions());

    result.current.importPed();
    expect(useUIStore.getState().activeModal).toBe('import');

    result.current.exportDocument();
    expect(useUIStore.getState().activeModal).toBe('export');

    result.current.openLegend();
    expect(useUIStore.getState().activeModal).toBe('legendEditor');
  });

  it('starts a new document without confirming when the doc is effectively empty', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = renderHook(() => useEditorActions());

    result.current.newDocument();

    // Empty (<= 1 individual) → no confirm prompt, and a fresh seed exists.
    expect(confirmSpy).not.toHaveBeenCalled();
    const inds = Object.keys(usePedigreeStore.getState().document.individuals);
    expect(inds).toHaveLength(1);
    // The gender picker opens on the seed.
    expect(useUIStore.getState().genderPicker.targetId).toBe(inds[0]);
  });

  it('confirms before replacing a non-empty document and aborts on cancel', () => {
    // hasContent is true only with more than one individual.
    usePedigreeStore.getState().setDocument(createDefaultDocument());
    usePedigreeStore.getState().addIndividual(createDefaultIndividual({ id: 'x1' }));
    usePedigreeStore.getState().addIndividual(createDefaultIndividual({ id: 'x2' }));

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { result } = renderHook(() => useEditorActions());

    result.current.newDocument();

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // Cancelled: the two individuals survive.
    expect(Object.keys(usePedigreeStore.getState().document.individuals)).toHaveLength(2);
  });

  it('adds a text annotation and opens it for inline editing', () => {
    const { result } = renderHook(() => useEditorActions());

    result.current.addText();

    const annotations = usePedigreeStore.getState().document.textAnnotations;
    const ids = Object.keys(annotations);
    expect(ids).toHaveLength(1);
    expect(useUIStore.getState().editingAnnotationId).toBe(ids[0]);
  });
});

describe('useEditorActions history', () => {
  it('undoes and redoes a document change', () => {
    const { result } = renderHook(() => useEditorActions());

    // Make an undoable change.
    result.current.addText();
    expect(Object.keys(usePedigreeStore.getState().document.textAnnotations)).toHaveLength(1);

    result.current.undo();
    expect(Object.keys(usePedigreeStore.getState().document.textAnnotations)).toHaveLength(0);

    result.current.redo();
    expect(Object.keys(usePedigreeStore.getState().document.textAnnotations)).toHaveLength(1);
  });
});

describe('useEditorActions viewport', () => {
  it('zooms in and out about the window centre', () => {
    const { result } = renderHook(() => useEditorActions());

    result.current.zoomIn();
    expect(useViewportStore.getState().scale).toBeGreaterThan(DEFAULT_ZOOM);

    useViewportStore.getState().resetView();
    result.current.zoomOut();
    expect(useViewportStore.getState().scale).toBeLessThan(DEFAULT_ZOOM);
  });

  it('resets the view to default scale and origin', () => {
    useViewportStore.setState({ scale: 3, position: { x: 100, y: 200 } });
    const { result } = renderHook(() => useEditorActions());

    result.current.resetView();
    expect(useViewportStore.getState().scale).toBe(DEFAULT_ZOOM);
    expect(useViewportStore.getState().position).toEqual({ x: 0, y: 0 });
  });

  it('falls back to resetView when there is no measurable canvas to fit', () => {
    // jsdom has no .konvajs-content element, so fitView takes the fallback path.
    useViewportStore.setState({ scale: 2.5, position: { x: 42, y: 42 } });
    const { result } = renderHook(() => useEditorActions());

    result.current.fitView();
    expect(useViewportStore.getState().scale).toBe(DEFAULT_ZOOM);
    expect(useViewportStore.getState().position).toEqual({ x: 0, y: 0 });
  });
});
