// src/components/ui/RadialMenu.genderPicker.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RadialMenu } from './RadialMenu';
import { useUIStore } from '../../stores/uiStore';
import { usePedigreeStore, createDefaultIndividual } from '../../stores/pedigreeStore';
import { GenderIdentity } from '../../types/enums';

const ROOT = 'root-1';

function seedRoot(): void {
  const pedigree = usePedigreeStore.getState();
  pedigree.resetDocument();
  pedigree.addIndividual(
    createDefaultIndividual({
      id: ROOT,
      genderIdentity: GenderIdentity.Woman,
      generation: 0,
      position: { x: 0, y: 0 },
    }),
  );
  const ui = useUIStore.getState();
  ui.hideGenderPicker();
  if (ui.editingLocked) ui.toggleEditingLocked();
  ui.showRadialMenu(ROOT, { x: 0, y: 0 });
}

describe('RadialMenu gender-picker wiring', () => {
  beforeEach(() => {
    seedRoot();
  });

  it('Add Child creates an Unknown child and opens the gender picker on it', () => {
    render(<RadialMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Child' }));

    const doc = usePedigreeStore.getState().document;
    const newPeople = Object.values(doc.individuals).filter((i) => i.id !== ROOT);
    expect(newPeople).toHaveLength(1);
    expect(newPeople[0].genderIdentity).toBe(GenderIdentity.Unknown);
    expect(useUIStore.getState().genderPicker.targetId).toBe(newPeople[0].id);
  });

  it('is hidden while a gender picker is open', () => {
    useUIStore.getState().showGenderPicker(ROOT);
    const { container } = render(<RadialMenu />);
    expect(container).toBeEmptyDOMElement();
  });
});
