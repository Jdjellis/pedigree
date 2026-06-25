import { describe, it, expect, beforeEach } from 'vitest';
import { usePedigreeStore } from './pedigreeStore';
import type { TextAnnotation } from '../types/pedigree';

/**
 * Reset the store to a fresh empty document (and clear undo/redo history)
 * before each test so cases are independent.
 */
beforeEach(() => {
  usePedigreeStore.getState().resetDocument();
  usePedigreeStore.temporal.getState().clear();
});

function makeAnnotation(overrides: Partial<TextAnnotation> = {}): TextAnnotation {
  return {
    id: 'anno-1',
    text: 'Family A',
    position: { x: 10, y: 20 },
    fontSize: 18,
    ...overrides,
  };
}

describe('pedigreeStore text annotation actions', () => {
  it('starts with an empty textAnnotations map on a new document', () => {
    expect(usePedigreeStore.getState().document.textAnnotations).toEqual({});
  });

  it('addTextAnnotation inserts the annotation keyed by id', () => {
    const annotation = makeAnnotation();
    usePedigreeStore.getState().addTextAnnotation(annotation);

    expect(
      usePedigreeStore.getState().document.textAnnotations['anno-1'],
    ).toEqual(annotation);
  });

  it('updateTextAnnotation patches text without dropping other fields', () => {
    usePedigreeStore.getState().addTextAnnotation(makeAnnotation());
    usePedigreeStore
      .getState()
      .updateTextAnnotation('anno-1', { text: 'Renamed' });

    const updated =
      usePedigreeStore.getState().document.textAnnotations['anno-1'];
    expect(updated.text).toBe('Renamed');
    expect(updated.position).toEqual({ x: 10, y: 20 });
    expect(updated.fontSize).toBe(18);
  });

  it('updateTextAnnotation moves the annotation when given a new position', () => {
    usePedigreeStore.getState().addTextAnnotation(makeAnnotation());
    usePedigreeStore
      .getState()
      .updateTextAnnotation('anno-1', { position: { x: 99, y: 88 } });

    expect(
      usePedigreeStore.getState().document.textAnnotations['anno-1'].position,
    ).toEqual({ x: 99, y: 88 });
  });

  it('updateTextAnnotation is a no-op for an unknown id', () => {
    usePedigreeStore.getState().addTextAnnotation(makeAnnotation());
    usePedigreeStore
      .getState()
      .updateTextAnnotation('missing', { text: 'x' });

    expect(
      Object.keys(usePedigreeStore.getState().document.textAnnotations),
    ).toEqual(['anno-1']);
  });

  it('removeTextAnnotation deletes only the targeted annotation', () => {
    usePedigreeStore.getState().addTextAnnotation(makeAnnotation());
    usePedigreeStore
      .getState()
      .addTextAnnotation(makeAnnotation({ id: 'anno-2', text: 'Other' }));

    usePedigreeStore.getState().removeTextAnnotation('anno-1');

    const remaining = usePedigreeStore.getState().document.textAnnotations;
    expect(Object.keys(remaining)).toEqual(['anno-2']);
  });

  it('add then undo removes the annotation (zundo tracks the change)', () => {
    usePedigreeStore.getState().addTextAnnotation(makeAnnotation());
    expect(
      usePedigreeStore.getState().document.textAnnotations['anno-1'],
    ).toBeDefined();

    usePedigreeStore.temporal.getState().undo();

    expect(
      usePedigreeStore.getState().document.textAnnotations['anno-1'],
    ).toBeUndefined();
  });

  it('move then undo restores the previous position (zundo tracks moves)', () => {
    usePedigreeStore.getState().addTextAnnotation(makeAnnotation());
    usePedigreeStore
      .getState()
      .updateTextAnnotation('anno-1', { position: { x: 500, y: 600 } });

    usePedigreeStore.temporal.getState().undo();

    expect(
      usePedigreeStore.getState().document.textAnnotations['anno-1'].position,
    ).toEqual({ x: 10, y: 20 });
  });
});
