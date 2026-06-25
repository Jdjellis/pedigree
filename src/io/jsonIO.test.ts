import { describe, it, expect } from 'vitest';
import { serializeDocument, deserializeDocument } from './jsonIO';
import { createDefaultDocument, createDefaultIndividual } from '../stores/pedigreeStore';

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
    const individual = createDefaultIndividual({ investigations: ['BRCA1 +'] });
    doc.individuals[individual.id] = individual;

    const loaded = deserializeDocument(serializeDocument(doc));
    expect(loaded.individuals[individual.id].investigations).toEqual(['BRCA1 +']);
  });
});
