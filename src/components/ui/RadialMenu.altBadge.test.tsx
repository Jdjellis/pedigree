// src/components/ui/RadialMenu.altBadge.test.tsx
//
// The persistent ⌥ discovery badge is gated behind the `altHint` feature flag
// (off by default). When on, it renders on the Sibling and Child buttons as an
// aria-hidden decoration that must not leak into their accessible names.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RadialMenu } from './RadialMenu';
import { useUIStore } from '../../stores/uiStore';
import { usePedigreeStore, createDefaultIndividual } from '../../stores/pedigreeStore';
import { featureFlags } from '../../config/featureFlags';

const ROOT = 'root';

beforeEach(() => {
  const store = usePedigreeStore.getState();
  store.resetDocument();
  store.addIndividual(createDefaultIndividual({ id: ROOT, generation: 0, position: { x: 0, y: 0 } }));
  const ui = useUIStore.getState();
  ui.hideGenderPicker();
  ui.hideUnionPicker();
  if (ui.editingLocked) ui.toggleEditingLocked();
  ui.showRadialMenu(ROOT, { x: 0, y: 0 });
});

afterEach(() => {
  featureFlags.altHint = false; // restore the default
});

describe('RadialMenu ⌥ discovery badge (altHint flag)', () => {
  it('is hidden by default (flag off)', () => {
    featureFlags.altHint = false;
    render(<RadialMenu />);
    const sibling = screen.getByRole('button', { name: 'Sibling' });
    expect(within(sibling).queryByText('⌥')).toBeNull();
  });

  it('shows a ⌥ badge on both Sibling and Child when the flag is on', () => {
    featureFlags.altHint = true;
    render(<RadialMenu />);
    const sibling = screen.getByRole('button', { name: 'Sibling' });
    const child = screen.getByRole('button', { name: 'Child' });
    expect(within(sibling).getByText('⌥')).toBeTruthy();
    expect(within(child).getByText('⌥')).toBeTruthy();
  });

  it('keeps the buttons’ accessible names plain when the badge is on', () => {
    featureFlags.altHint = true;
    render(<RadialMenu />);
    // Would throw if the ⌥ glyph leaked into the accessible name.
    expect(screen.getByRole('button', { name: 'Sibling' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Child' })).toBeTruthy();
    // Parent/Partner never carry the badge.
    expect(within(screen.getByRole('button', { name: 'Parent' })).queryByText('⌥')).toBeNull();
  });
});
