import { usePedigreeStore } from '../../stores/pedigreeStore';

/**
 * Delete the document element with the given id, routing to the correct remover
 * by entity type: text annotation, partnership, or individual. Removing an
 * individual cascades to its partnerships, parent-child links, and twin-group
 * membership (handled inside the store). A no-op if `id` matches nothing.
 */
export function eraseElementById(id: string): void {
  const store = usePedigreeStore.getState();
  const { textAnnotations, partnerships } = store.document;
  if (textAnnotations[id]) {
    store.removeTextAnnotation(id);
  } else if (partnerships[id]) {
    store.removePartnership(id);
  } else {
    store.removeIndividual(id);
  }
}
