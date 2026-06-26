import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEditorActions } from './useEditorActions';
import { usePedigreeStore } from '../stores/pedigreeStore';
import { useUIStore } from '../stores/uiStore';

describe('addPersonAt', () => {
  beforeEach(() => {
    // Reset all relevant stores to a clean state.
    usePedigreeStore.getState().resetDocument();
    useUIStore.setState({
      selectedIds: new Set<string>(),
      activeTool: 'select',
      propertiesPanelOpen: false,
    });
  });

  it('places an individual at the rounded canvas position', () => {
    useUIStore.getState().setActiveTool('male');
    const { result } = renderHook(() => useEditorActions());

    result.current.addPersonAt({ x: 123.4, y: 200.6 });

    const individuals = Object.values(
      usePedigreeStore.getState().document.individuals
    );
    expect(individuals).toHaveLength(1);
    expect(individuals[0].position).toEqual({ x: 123, y: 201 });
  });

  it('selects the newly created individual', () => {
    useUIStore.getState().setActiveTool('male');
    const { result } = renderHook(() => useEditorActions());

    result.current.addPersonAt({ x: 123.4, y: 200.6 });

    const individuals = Object.values(
      usePedigreeStore.getState().document.individuals
    );
    expect(individuals).toHaveLength(1);
    const newId = individuals[0].id;
    expect(useUIStore.getState().selectedIds.has(newId)).toBe(true);
  });

  it('reverts the active tool to select after placement', () => {
    useUIStore.getState().setActiveTool('male');
    const { result } = renderHook(() => useEditorActions());

    result.current.addPersonAt({ x: 123.4, y: 200.6 });

    expect(useUIStore.getState().activeTool).toBe('select');
  });

  it('positions are rounded, not truncated', () => {
    const { result } = renderHook(() => useEditorActions());

    result.current.addPersonAt({ x: 99.9, y: 50.1 });

    const individuals = Object.values(
      usePedigreeStore.getState().document.individuals
    );
    expect(individuals[0].position).toEqual({ x: 100, y: 50 });
  });
});

describe('addPerson (center placement)', () => {
  beforeEach(() => {
    // Reset all relevant stores to a clean state.
    usePedigreeStore.getState().resetDocument();
    useUIStore.setState({
      selectedIds: new Set<string>(),
      activeTool: 'select',
      propertiesPanelOpen: false,
    });
  });

  it('adds exactly one individual to the document', () => {
    const { result } = renderHook(() => useEditorActions());
    result.current.addPerson();

    const individuals = Object.values(
      usePedigreeStore.getState().document.individuals
    );
    expect(individuals).toHaveLength(1);
  });

  it('selects the newly created individual', () => {
    const { result } = renderHook(() => useEditorActions());
    result.current.addPerson();

    const individuals = Object.values(
      usePedigreeStore.getState().document.individuals
    );
    expect(individuals).toHaveLength(1);
    expect(useUIStore.getState().selectedIds.has(individuals[0].id)).toBe(true);
  });
});

describe('useEditorActions tool activators', () => {
  beforeEach(() => {
    useUIStore.setState({ activeTool: 'select', toolLocked: false });
  });

  it('activates each tool', () => {
    const { result } = renderHook(() => useEditorActions());
    result.current.handTool();
    expect(useUIStore.getState().activeTool).toBe('hand');
    result.current.maleTool();
    expect(useUIStore.getState().activeTool).toBe('male');
    result.current.femaleTool();
    expect(useUIStore.getState().activeTool).toBe('female');
    result.current.unknownTool();
    expect(useUIStore.getState().activeTool).toBe('unknown');
    result.current.partnershipTool();
    expect(useUIStore.getState().activeTool).toBe('partnership');
    result.current.textTool();
    expect(useUIStore.getState().activeTool).toBe('text');
    result.current.eraserTool();
    expect(useUIStore.getState().activeTool).toBe('eraser');
    result.current.selectTool();
    expect(useUIStore.getState().activeTool).toBe('select');
  });

  it('toggles the tool lock', () => {
    const { result } = renderHook(() => useEditorActions());
    result.current.toggleToolLock();
    expect(useUIStore.getState().toolLocked).toBe(true);
  });
});
