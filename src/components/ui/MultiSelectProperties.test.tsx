import { render, screen, fireEvent, act } from '@testing-library/react';
import { beforeEach, describe, it, expect } from 'vitest';
import {
  usePedigreeStore,
  createDefaultDocument,
  createDefaultIndividual,
} from '../../stores/pedigreeStore';
import { useUIStore } from '../../stores/uiStore';
import { GenderIdentity, VitalStatus } from '../../types/enums';
import { PropertiesPanel } from './PropertiesPanel';

function selectPeople(ids: string[]) {
  act(() => {
    useUIStore.setState({
      selectedIds: new Set(ids),
      selectedConnection: null,
      propertiesPanelOpen: true,
    });
  });
}

beforeEach(() => {
  act(() => {
    usePedigreeStore.getState().setDocument(createDefaultDocument());
    useUIStore.setState({
      selectedIds: new Set<string>(),
      selectedConnection: null,
      propertiesPanelOpen: false,
    });
  });
});

describe('MultiSelectProperties — header & identity', () => {
  it('shows a count header when more than one person is selected', () => {
    const doc = createDefaultDocument();
    doc.individuals['a'] = createDefaultIndividual({ id: 'a', genderIdentity: GenderIdentity.Man });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b', genderIdentity: GenderIdentity.Man });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    expect(screen.getByText('2 people selected')).toBeInTheDocument();
  });

  it('shows the shared gender as active when all agree', () => {
    const doc = createDefaultDocument();
    doc.individuals['a'] = createDefaultIndividual({ id: 'a', genderIdentity: GenderIdentity.Woman });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b', genderIdentity: GenderIdentity.Woman });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    expect(screen.getByRole('button', { name: 'Woman' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows no active gender button when the selection is mixed', () => {
    const doc = createDefaultDocument();
    doc.individuals['a'] = createDefaultIndividual({ id: 'a', genderIdentity: GenderIdentity.Man });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b', genderIdentity: GenderIdentity.Woman });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    expect(screen.getByRole('button', { name: 'Man' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Woman' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('writes a gender change to every selected person', () => {
    const doc = createDefaultDocument();
    doc.individuals['a'] = createDefaultIndividual({ id: 'a', genderIdentity: GenderIdentity.Man });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b', genderIdentity: GenderIdentity.Woman });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Non-binary' }));
    });

    const docAfter = usePedigreeStore.getState().document;
    expect(docAfter.individuals.a.genderIdentity).toBe(GenderIdentity.NonBinary);
    expect(docAfter.individuals.b.genderIdentity).toBe(GenderIdentity.NonBinary);
  });
});

describe('MultiSelectProperties — vital status & adoption', () => {
  it('sets vital status on every selected person', () => {
    const doc = createDefaultDocument();
    doc.individuals['a'] = createDefaultIndividual({ id: 'a' });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b' });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Deceased' })));

    const after = usePedigreeStore.getState().document;
    expect(after.individuals.a.vitalStatus).toBe(VitalStatus.Deceased);
    expect(after.individuals.b.vitalStatus).toBe(VitalStatus.Deceased);
  });

  it('shows the cause-of-death field only when every selected person is deceased', () => {
    const doc = createDefaultDocument();
    doc.individuals['a'] = createDefaultIndividual({ id: 'a', vitalStatus: VitalStatus.Deceased });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b', vitalStatus: VitalStatus.Alive });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    const { rerender } = render(<PropertiesPanel />);
    expect(screen.queryByPlaceholderText(/Cause of death|Mixed/i)).not.toBeInTheDocument();

    act(() => {
      usePedigreeStore.getState().updateIndividuals(['b'], { vitalStatus: VitalStatus.Deceased });
    });
    rerender(<PropertiesPanel />);
    expect(screen.getByLabelText('Cause of Death')).toBeInTheDocument();
  });

  it('renders the adopted checkbox as indeterminate when the selection is mixed', () => {
    const doc = createDefaultDocument();
    doc.individuals['a'] = createDefaultIndividual({ id: 'a', adopted: true });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b' });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    expect(screen.getByRole('checkbox', { name: 'Adopted' })).toBePartiallyChecked();
  });

  it('marks all selected adopted when toggled from mixed', () => {
    const doc = createDefaultDocument();
    doc.individuals['a'] = createDefaultIndividual({ id: 'a', adopted: true });
    doc.individuals['b'] = createDefaultIndividual({ id: 'b' });
    act(() => usePedigreeStore.getState().setDocument(doc));
    selectPeople(['a', 'b']);

    render(<PropertiesPanel />);
    act(() => fireEvent.click(screen.getByRole('checkbox', { name: 'Adopted' })));

    const after = usePedigreeStore.getState().document;
    expect(after.individuals.a.adopted).toBe(true);
    expect(after.individuals.b.adopted).toBe(true);
  });
});
