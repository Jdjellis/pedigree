import { useEditorActions } from './useEditorActions';
import { usePedigreeStore } from '../stores/pedigreeStore';
import { useUIStore } from '../stores/uiStore';

beforeEach(() => {
  // Reset all relevant stores to a clean state.
  usePedigreeStore.getState().resetDocument();
  useUIStore.setState({
    selectedIds: new Set<string>(),
    activeTool: 'select',
    propertiesPanelOpen: false,
  });
});

describe('addPersonAt', () => {
  test('places an individual at the rounded canvas position', () => {
    useUIStore.getState().setActiveTool('addIndividual');
    const { addPersonAt } = useEditorActions();

    addPersonAt({ x: 123.4, y: 200.6 });

    const individuals = Object.values(
      usePedigreeStore.getState().document.individuals
    );
    expect(individuals).toHaveLength(1);
    expect(individuals[0].position).toEqual({ x: 123, y: 201 });
  });

  test('selects the newly created individual', () => {
    useUIStore.getState().setActiveTool('addIndividual');
    const { addPersonAt } = useEditorActions();

    addPersonAt({ x: 123.4, y: 200.6 });

    const individuals = Object.values(
      usePedigreeStore.getState().document.individuals
    );
    expect(individuals).toHaveLength(1);
    const newId = individuals[0].id;
    expect(useUIStore.getState().selectedIds.has(newId)).toBe(true);
  });

  test('reverts the active tool to select after placement', () => {
    useUIStore.getState().setActiveTool('addIndividual');
    const { addPersonAt } = useEditorActions();

    addPersonAt({ x: 123.4, y: 200.6 });

    expect(useUIStore.getState().activeTool).toBe('select');
  });

  test('positions are rounded, not truncated', () => {
    const { addPersonAt } = useEditorActions();

    addPersonAt({ x: 99.9, y: 50.1 });

    const individuals = Object.values(
      usePedigreeStore.getState().document.individuals
    );
    expect(individuals[0].position).toEqual({ x: 100, y: 50 });
  });
});

describe('addPerson (center placement)', () => {
  test('adds exactly one individual to the document', () => {
    const { addPerson } = useEditorActions();
    addPerson();

    const individuals = Object.values(
      usePedigreeStore.getState().document.individuals
    );
    expect(individuals).toHaveLength(1);
  });

  test('selects the newly created individual', () => {
    const { addPerson } = useEditorActions();
    addPerson();

    const individuals = Object.values(
      usePedigreeStore.getState().document.individuals
    );
    expect(individuals).toHaveLength(1);
    expect(useUIStore.getState().selectedIds.has(individuals[0].id)).toBe(true);
  });
});
