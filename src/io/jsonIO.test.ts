import { describe, it, expect } from 'vitest';
import { serializeDocument, deserializeDocument, migrateAdoption } from './jsonIO';
import { createDefaultDocument, createDefaultIndividual } from '../stores/pedigreeStore';
import type { PedigreeDocument } from '../types/pedigree';
import { RelationshipType } from '../types/enums';

describe('deserializeDocument', () => {
  it('defaults investigations to [] for individuals saved before the field existed', () => {
    const doc = createDefaultDocument();
    const individual = createDefaultIndividual();
    doc.individuals[individual.id] = individual;

    // Simulate a legacy document: strip the investigations field from the JSON.
    // serializeDocument wraps the doc in { app, formatVersion, document }, so
    // we navigate through the envelope to reach the individuals map.
    const parsed = JSON.parse(serializeDocument(doc));
    delete parsed.document.individuals[individual.id].investigations;

    const loaded = deserializeDocument(JSON.stringify(parsed));
    expect(loaded.individuals[individual.id].investigations).toEqual([]);
  });

  it('round-trips investigations that are present', () => {
    const doc = createDefaultDocument();
    const individual = createDefaultIndividual({
      investigations: [{ label: 'BRCA1', description: 'Pathogenic variant' }],
    });
    doc.individuals[individual.id] = individual;

    const loaded = deserializeDocument(serializeDocument(doc));
    expect(loaded.individuals[individual.id].investigations).toEqual([
      { label: 'BRCA1', description: 'Pathogenic variant' },
    ]);
  });

  it('migrates legacy string investigations to { label, description }', () => {
    const doc = createDefaultDocument();
    const individual = createDefaultIndividual();
    doc.individuals[individual.id] = individual;

    // Simulate a document saved with the old single-string investigations form.
    const parsed = JSON.parse(serializeDocument(doc));
    parsed.document.individuals[individual.id].investigations = ['BRCA1 +'];

    const loaded = deserializeDocument(JSON.stringify(parsed));
    expect(loaded.individuals[individual.id].investigations).toEqual([
      { label: 'BRCA1 +', description: '' },
    ]);
  });
});

/**
 * A minimal but valid document fixture with one text annotation and a simple
 * family (one child + partnership + parent link) so migration tests have
 * concrete links to assert against.
 *
 * Known IDs: individual `'kid-1'`, partnership `'p1'`, link `'link-1'`.
 */
function makeDocument(): PedigreeDocument {
  return {
    metadata: {
      id: 'doc-1',
      title: 'Test',
      createdAt: '2026-06-25T00:00:00.000Z',
      updatedAt: '2026-06-25T00:00:00.000Z',
      version: '1.0.0',
    },
    individuals: {
      'kid-1': createDefaultIndividual({ id: 'kid-1', position: { x: 0, y: 150 } }),
    },
    partnerships: {
      p1: {
        id: 'p1',
        type: RelationshipType.Partnership,
        childrenIds: ['kid-1'],
      },
    },
    parentChildLinks: {
      'link-1': {
        id: 'link-1',
        type: RelationshipType.ParentChild,
        parentPartnershipId: 'p1',
        childId: 'kid-1',
      },
    },
    twinGroups: {},
    textAnnotations: {
      'anno-1': {
        id: 'anno-1',
        text: 'Pedigree Title',
        position: { x: 40, y: 20 },
        fontSize: 18,
      },
    },
    generationOrder: [],
    legendConfig: { entries: [], position: { x: 50, y: 50 } },
  };
}

describe('jsonIO text annotation round-trip', () => {
  it('preserves text annotations through serialize -> deserialize', () => {
    const doc = makeDocument();
    const restored = deserializeDocument(serializeDocument(doc));

    expect(restored.textAnnotations).toEqual(doc.textAnnotations);
  });

  it('defaults textAnnotations to {} when loading a document that lacks it', () => {
    // Simulate an older document saved before text annotations existed.
    const legacy = {
      app: 'PedigreeEditor',
      formatVersion: '2.0',
      document: {
        metadata: {
          id: 'doc-1',
          title: 'Legacy',
          createdAt: '2026-06-25T00:00:00.000Z',
          updatedAt: '2026-06-25T00:00:00.000Z',
          version: '1.0.0',
        },
        individuals: {},
        partnerships: {},
        parentChildLinks: {},
        twinGroups: {},
        generationOrder: [],
        legendConfig: { entries: [], position: { x: 50, y: 50 } },
      },
    };

    const restored = deserializeDocument(JSON.stringify(legacy));

    expect(restored.textAnnotations).toEqual({});
  });
});

describe('migrateAdoption', () => {
  it('maps legacy link.isAdopted and type=Adoption to isAdoptive', () => {
    const doc = makeDocument();
    // Legacy adoptive link expressed the old two ways.
    (doc.parentChildLinks as Record<string, unknown>).legacy = {
      id: 'legacy',
      type: 'adoption',
      parentPartnershipId: 'p1',
      childId: 'kid',
      isAdopted: true,
    };

    migrateAdoption(doc);

    const link = doc.parentChildLinks.legacy as unknown as Record<string, unknown>;
    expect(link.isAdoptive).toBe(true);
    expect(link.type).toBe(RelationshipType.ParentChild);
    expect('isAdopted' in link).toBe(false);
  });

  it('dashes the parent link of a legacy individual.adopted person (adopted-in)', () => {
    const doc = makeDocument();
    const kidId = Object.keys(doc.individuals)[0]; // 'kid-1'
    doc.individuals[kidId] = { ...doc.individuals[kidId], adopted: true };

    migrateAdoption(doc);

    // 'link-1' is the known parent-child link for 'kid-1' in makeDocument()
    expect(doc.parentChildLinks['link-1'].isAdoptive).toBe(true);
  });

  it('is idempotent', () => {
    const doc = makeDocument();
    const once = JSON.stringify(migrateAdoption(doc));
    const twice = JSON.stringify(migrateAdoption(doc));
    expect(twice).toBe(once);
  });

  it('preserves an explicit biological edge (adopted-out) across multiple loads', () => {
    // Regression for the unguarded step-2 bug: a person marked adopted:true
    // whose parent link is explicitly isAdoptive:false (= adopted-out) must NOT
    // be flipped back to adopted-in on load. This test would fail without the
    // `&& link.isAdoptive === undefined` guard.
    const doc = makeDocument();
    // 'kid-1' has parent link 'link-1' in makeDocument().
    doc.individuals['kid-1'] = { ...doc.individuals['kid-1'], adopted: true };
    doc.parentChildLinks['link-1'] = { ...doc.parentChildLinks['link-1'], isAdoptive: false };

    migrateAdoption(doc);
    expect(doc.parentChildLinks['link-1'].isAdoptive).toBe(false);

    // Run again to confirm true idempotency for the adopted-out case.
    migrateAdoption(doc);
    expect(doc.parentChildLinks['link-1'].isAdoptive).toBe(false);
  });

  it('migrates a link with only type="adoption" (no isAdopted field) to isAdoptive', () => {
    // Exercises the `type === Adoption` branch of the OR in isolation —
    // a link that used only the old type field and had no isAdopted property.
    const doc = makeDocument();
    (doc.parentChildLinks as Record<string, unknown>)['type-only'] = {
      id: 'type-only',
      type: 'adoption',
      parentPartnershipId: 'p1',
      childId: 'other-kid',
    };

    migrateAdoption(doc);

    const link = doc.parentChildLinks['type-only'] as unknown as Record<string, unknown>;
    expect(link.isAdoptive).toBe(true);
    expect(link.type).toBe(RelationshipType.ParentChild);
    expect('isAdopted' in link).toBe(false);
  });
});
