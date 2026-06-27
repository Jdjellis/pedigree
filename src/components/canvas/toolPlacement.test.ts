import { describe, it, expect, beforeEach } from 'vitest';
import { usePedigreeStore } from '../../stores/pedigreeStore';
import { useUIStore } from '../../stores/uiStore';
import { GenderIdentity } from '../../types/enums';
import { genderForTool, placePersonAt, placeTextAt } from './toolPlacement';
import { ANNOTATION_PLACEHOLDER_TEXT } from '../../utils/constants';

describe('toolPlacement — sex person', () => {
  beforeEach(() => {
    usePedigreeStore.getState().resetDocument();
    useUIStore.setState({
      activeTool: 'male',
      editingLocked: false,
      selectedIds: new Set(),
    });
  });

  it('maps tool ids to gender identities', () => {
    expect(genderForTool('male')).toBe(GenderIdentity.Man);
    expect(genderForTool('female')).toBe(GenderIdentity.Woman);
    expect(genderForTool('unknown')).toBe(GenderIdentity.Unknown);
    expect(genderForTool('select')).toBeNull();
  });

  it('places a person of the right sex at the rounded position and selects it', () => {
    const id = placePersonAt('female', { x: 120.6, y: 80.2 });
    expect(id).not.toBeNull();
    const ind = usePedigreeStore.getState().document.individuals[id as string];
    expect(ind.genderIdentity).toBe(GenderIdentity.Woman);
    expect(ind.position).toEqual({ x: 121, y: 80 });
    expect(useUIStore.getState().selectedIds.has(id as string)).toBe(true);
  });

  it('reverts to select after placing when not locked', () => {
    placePersonAt('male', { x: 0, y: 0 });
    expect(useUIStore.getState().activeTool).toBe('select');
  });

  it('keeps the tool active after placing when locked', () => {
    useUIStore.setState({ editingLocked: true });
    placePersonAt('male', { x: 0, y: 0 });
    expect(useUIStore.getState().activeTool).toBe('male');
  });

  it('returns null and places nothing for a non-person tool', () => {
    const id = placePersonAt('select', { x: 0, y: 0 });
    expect(id).toBeNull();
    expect(Object.keys(usePedigreeStore.getState().document.individuals)).toHaveLength(0);
  });
});

describe('toolPlacement — text', () => {
  beforeEach(() => {
    usePedigreeStore.getState().resetDocument();
    useUIStore.setState({ activeTool: 'text', editingLocked: false });
  });

  it('places a placeholder annotation at the rounded position and edits it', () => {
    const id = placeTextAt({ x: 50.7, y: 30.2 });
    const ann = usePedigreeStore.getState().document.textAnnotations[id];
    expect(ann.text).toBe(ANNOTATION_PLACEHOLDER_TEXT);
    expect(ann.position).toEqual({ x: 51, y: 30 });
    expect(useUIStore.getState().editingAnnotationId).toBe(id);
  });

  it('reverts to select after placing when not locked', () => {
    placeTextAt({ x: 0, y: 0 });
    expect(useUIStore.getState().activeTool).toBe('select');
  });
});
