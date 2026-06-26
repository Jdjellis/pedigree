import { describe, it, expect, beforeEach } from 'vitest';
import { usePedigreeStore } from '../../stores/pedigreeStore';
import { useUIStore } from '../../stores/uiStore';
import { GenderIdentity } from '../../types/enums';
import { genderForTool, placePersonAt } from './toolPlacement';

describe('toolPlacement — sex person', () => {
  beforeEach(() => {
    usePedigreeStore.getState().resetDocument();
    useUIStore.setState({
      activeTool: 'male',
      toolLocked: false,
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
    useUIStore.setState({ toolLocked: true });
    placePersonAt('male', { x: 0, y: 0 });
    expect(useUIStore.getState().activeTool).toBe('male');
  });

  it('returns null and places nothing for a non-person tool', () => {
    const id = placePersonAt('select', { x: 0, y: 0 });
    expect(id).toBeNull();
    expect(Object.keys(usePedigreeStore.getState().document.individuals)).toHaveLength(0);
  });
});
