import { describe, it, expect } from 'vitest';
import { exportToPed, importFromPed } from './pedIO';
import { GenderIdentity, RelationshipType } from '../types/enums';
import { createDefaultDocument, createDefaultIndividual } from '../stores/pedigreeStore';

describe('exportToPed', () => {
  it('emits one tab-separated row per individual with the family title', () => {
    const doc = createDefaultDocument();
    doc.metadata.title = 'SmithFamily';
    const man = createDefaultIndividual({ genderIdentity: GenderIdentity.Man });
    doc.individuals[man.id] = man;

    const ped = exportToPed(doc);
    const lines = ped.trimEnd().split('\n');
    expect(lines).toHaveLength(1);

    const cols = lines[0].split('\t');
    expect(cols[0]).toBe('SmithFamily'); // family id
    expect(cols[1]).toBe(man.id); // individual id
    expect(cols[2]).toBe('0'); // father missing
    expect(cols[3]).toBe('0'); // mother missing
    expect(cols[4]).toBe('1'); // sex: male
    expect(cols[5]).toBe('1'); // phenotype: unaffected
  });

  it('marks an individual with conditions as affected (phenotype 2)', () => {
    const doc = createDefaultDocument();
    const affected = createDefaultIndividual({ conditionIds: ['c1'] });
    doc.individuals[affected.id] = affected;

    const cols = exportToPed(doc).trimEnd().split('\t');
    expect(cols[5]).toBe('2');
  });

  it('maps gender identity to PED sex codes', () => {
    const doc = createDefaultDocument();
    const woman = createDefaultIndividual({ genderIdentity: GenderIdentity.Woman });
    const nb = createDefaultIndividual({ genderIdentity: GenderIdentity.NonBinary });
    doc.individuals[woman.id] = woman;
    doc.individuals[nb.id] = nb;

    const sexById = new Map(
      exportToPed(doc)
        .trimEnd()
        .split('\n')
        .map((line) => {
          const c = line.split('\t');
          return [c[1], c[4]];
        }),
    );
    expect(sexById.get(woman.id)).toBe('2');
    expect(sexById.get(nb.id)).toBe('0'); // unknown/non-binary -> 0
  });

  it('resolves father/mother columns from a partnership', () => {
    const doc = createDefaultDocument();
    const father = createDefaultIndividual({ genderIdentity: GenderIdentity.Man });
    const mother = createDefaultIndividual({ genderIdentity: GenderIdentity.Woman });
    const child = createDefaultIndividual({ genderIdentity: GenderIdentity.Man });
    for (const i of [father, mother, child]) doc.individuals[i.id] = i;

    doc.partnerships['p1'] = {
      id: 'p1',
      type: RelationshipType.Partnership,
      partner1Id: father.id,
      partner2Id: mother.id,
      childrenIds: [child.id],
    };
    doc.parentChildLinks['l1'] = {
      id: 'l1',
      type: RelationshipType.ParentChild,
      parentPartnershipId: 'p1',
      childId: child.id,
      isAdopted: false,
    };

    const childRow = exportToPed(doc)
      .trimEnd()
      .split('\n')
      .map((l) => l.split('\t'))
      .find((c) => c[1] === child.id)!;
    expect(childRow[2]).toBe(father.id); // father column
    expect(childRow[3]).toBe(mother.id); // mother column
  });
});

describe('importFromPed', () => {
  it('throws on content with no data rows', () => {
    expect(() => importFromPed('# only a comment\n\n')).toThrow();
  });

  it('parses individuals and assigns the family id as the title', () => {
    const ped = [
      'FAM1\t1\t0\t0\t1\t1',
      'FAM1\t2\t0\t0\t2\t1',
      'FAM1\t3\t1\t2\t1\t2',
    ].join('\n');

    const doc = importFromPed(ped);
    expect(doc.metadata.title).toBe('FAM1');
    expect(Object.keys(doc.individuals)).toHaveLength(3);
  });

  it('prefers an explicit document title over the family id', () => {
    const doc = importFromPed('FAM1\t1\t0\t0\t1\t1', 'My Pedigree');
    expect(doc.metadata.title).toBe('My Pedigree');
  });

  it('derives a partnership and parent-child links from parent columns', () => {
    const ped = [
      'FAM1\t1\t0\t0\t1\t1', // father
      'FAM1\t2\t0\t0\t2\t1', // mother
      'FAM1\t3\t1\t2\t2\t2', // child of 1 & 2
      'FAM1\t4\t1\t2\t1\t1', // sibling
    ].join('\n');

    const doc = importFromPed(ped);
    const partnerships = Object.values(doc.partnerships);
    expect(partnerships).toHaveLength(1);
    expect(partnerships[0].childrenIds).toHaveLength(2);
    expect(Object.values(doc.parentChildLinks)).toHaveLength(2);
  });

  it('skips comments, blank lines, and malformed (short) rows', () => {
    const ped = [
      '# header comment',
      '',
      'FAM1\t1\t0\t0\t1\t1',
      'too few columns',
      '   ',
      'FAM1\t2\t0\t0\t2\t1',
    ].join('\n');

    const doc = importFromPed(ped);
    expect(Object.keys(doc.individuals)).toHaveLength(2);
  });

  it('imports individuals with empty conditionIds regardless of phenotype', () => {
    // Import intentionally does not synthesize condition records from the
    // phenotype column — affected status is re-entered in the editor.
    const ped = ['FAM1\t1\t0\t0\t1\t2', 'FAM1\t2\t0\t0\t2\t1'].join('\n');
    const doc = importFromPed(ped);
    for (const ind of Object.values(doc.individuals)) {
      expect(ind.conditionIds).toEqual([]);
    }
  });

  it('creates a stub parent when a parent id is referenced but absent', () => {
    // Child references father "9" which never appears as its own row.
    const ped = 'FAM1\t3\t9\t0\t1\t1';
    const doc = importFromPed(ped);
    // 3 itself + the synthesized stub for father 9.
    expect(Object.keys(doc.individuals).length).toBeGreaterThanOrEqual(2);
  });

  it('lays out generations top-to-bottom (parents above children)', () => {
    const ped = [
      'FAM1\t1\t0\t0\t1\t1',
      'FAM1\t2\t0\t0\t2\t1',
      'FAM1\t3\t1\t2\t1\t1',
    ].join('\n');
    const doc = importFromPed(ped);

    const founders = Object.values(doc.individuals).filter(
      (i) => i.generation === 0,
    );
    const children = Object.values(doc.individuals).filter(
      (i) => i.generation === 1,
    );
    expect(founders).toHaveLength(2);
    expect(children).toHaveLength(1);
    expect(children[0].position.y).toBeGreaterThan(founders[0].position.y);
  });
});

describe('PED round-trip', () => {
  it('preserves individual count and parent structure through export -> import', () => {
    const doc = createDefaultDocument();
    doc.metadata.title = 'RoundTrip';
    const father = createDefaultIndividual({ genderIdentity: GenderIdentity.Man });
    const mother = createDefaultIndividual({ genderIdentity: GenderIdentity.Woman });
    const child = createDefaultIndividual({ genderIdentity: GenderIdentity.Woman });
    for (const i of [father, mother, child]) doc.individuals[i.id] = i;
    doc.partnerships['p1'] = {
      id: 'p1',
      type: RelationshipType.Partnership,
      partner1Id: father.id,
      partner2Id: mother.id,
      childrenIds: [child.id],
    };
    doc.parentChildLinks['l1'] = {
      id: 'l1',
      type: RelationshipType.ParentChild,
      parentPartnershipId: 'p1',
      childId: child.id,
      isAdopted: false,
    };

    const reimported = importFromPed(exportToPed(doc));
    expect(Object.keys(reimported.individuals)).toHaveLength(3);
    expect(Object.values(reimported.partnerships)).toHaveLength(1);
    expect(Object.values(reimported.parentChildLinks)).toHaveLength(1);
  });
});
