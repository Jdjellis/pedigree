import { describe, it, test, expect, beforeEach } from 'vitest';
import { useUIStore } from './uiStore';

test('togglePropertiesPanel flips the flag', () => {
  useUIStore.setState({ propertiesPanelOpen: false });
  useUIStore.getState().togglePropertiesPanel();
  expect(useUIStore.getState().propertiesPanelOpen).toBe(true);
});

test('toggleCommandPalette flips palette state', () => {
  useUIStore.setState({ commandPaletteOpen: false });
  useUIStore.getState().toggleCommandPalette();
  expect(useUIStore.getState().commandPaletteOpen).toBe(true);
});

describe('relationshipPopup slice', () => {
  beforeEach(() => {
    useUIStore.getState().hideRelationshipPopup();
  });

  it('is hidden by default', () => {
    expect(useUIStore.getState().relationshipPopup.visible).toBe(false);
  });

  it('shows the popup for a partnership at a screen position', () => {
    useUIStore.getState().showRelationshipPopup('pa-1', { x: 10, y: 20 });
    const popup = useUIStore.getState().relationshipPopup;
    expect(popup.visible).toBe(true);
    expect(popup.partnershipId).toBe('pa-1');
    expect(popup.screenPosition).toEqual({ x: 10, y: 20 });
  });

  it('hides the popup and clears the partnership id', () => {
    useUIStore.getState().showRelationshipPopup('pa-1', { x: 10, y: 20 });
    useUIStore.getState().hideRelationshipPopup();
    const popup = useUIStore.getState().relationshipPopup;
    expect(popup.visible).toBe(false);
    expect(popup.partnershipId).toBeNull();
  });
});

describe('uiStore tool state', () => {
  beforeEach(() => {
    useUIStore.setState({
      activeTool: 'select',
      editingLocked: false,
      partnershipAnchorId: null,
    });
  });

  it('switches the active tool to any of the new tool ids', () => {
    useUIStore.getState().setActiveTool('male');
    expect(useUIStore.getState().activeTool).toBe('male');
    useUIStore.getState().setActiveTool('eraser');
    expect(useUIStore.getState().activeTool).toBe('eraser');
  });

  it('toggles the editing lock on and off', () => {
    expect(useUIStore.getState().editingLocked).toBe(false);
    useUIStore.getState().toggleEditingLocked();
    expect(useUIStore.getState().editingLocked).toBe(true);
    useUIStore.getState().toggleEditingLocked();
    expect(useUIStore.getState().editingLocked).toBe(false);
  });

  it('sets and clears the partnership anchor', () => {
    useUIStore.getState().setPartnershipAnchor('ind-1');
    expect(useUIStore.getState().partnershipAnchorId).toBe('ind-1');
    useUIStore.getState().setPartnershipAnchor(null);
    expect(useUIStore.getState().partnershipAnchorId).toBeNull();
  });
});
