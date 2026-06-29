import { describe, it, expect } from 'vitest';
import { parentLinksForChild, adoptionModeForLink, parentCoupleLabel } from './adoption';
import { createDefaultDocument, createDefaultIndividual } from '../stores/pedigreeStore';
import { RelationshipType } from '../types/enums';
import type { ParentChildRelationship } from '../types/pedigree';

const link = (over: Partial<ParentChildRelationship>): ParentChildRelationship => ({
  id: 'l', type: RelationshipType.ParentChild, parentPartnershipId: 'u', childId: 'kid', ...over,
});

describe('parentLinksForChild', () => {
  it('returns every link whose childId matches', () => {
    const links = { a: link({ id: 'a' }), b: link({ id: 'b', childId: 'other' }) };
    expect(parentLinksForChild(links, 'kid').map((l) => l.id)).toEqual(['a']);
  });

  it('returns an empty array when no links match', () => {
    const links = { a: link({ id: 'a', childId: 'other' }) };
    expect(parentLinksForChild(links, 'kid')).toEqual([]);
  });
});

describe('adoptionModeForLink', () => {
  it('none when not adopted', () => {
    expect(adoptionModeForLink(false, link({ isAdoptive: true }))).toBe('none');
  });

  it('none when adopted is undefined', () => {
    expect(adoptionModeForLink(undefined, link({ isAdoptive: true }))).toBe('none');
  });

  it('in when adopted and link is adoptive', () => {
    expect(adoptionModeForLink(true, link({ isAdoptive: true }))).toBe('in');
  });

  it('out when adopted and link is biological', () => {
    expect(adoptionModeForLink(true, link({ isAdoptive: false }))).toBe('out');
  });

  it('out when adopted and link isAdoptive is absent (solid = biological)', () => {
    expect(adoptionModeForLink(true, link({}))).toBe('out');
  });
});

describe('parentCoupleLabel', () => {
  it('labels the couple by display names', () => {
    const doc = createDefaultDocument();
    doc.individuals.dad = createDefaultIndividual({ id: 'dad', displayName: 'Dad' });
    doc.individuals.mum = createDefaultIndividual({ id: 'mum', displayName: 'Mum' });
    doc.partnerships.u = {
      id: 'u', type: RelationshipType.Partnership,
      partner1Id: 'dad', partner2Id: 'mum', childrenIds: ['kid'],
    };
    expect(parentCoupleLabel(doc, link({ parentPartnershipId: 'u' }))).toBe('Dad & Mum');
  });

  it('falls back to individual id when displayName is absent', () => {
    const doc = createDefaultDocument();
    doc.individuals.dad = createDefaultIndividual({ id: 'dad' });
    doc.partnerships.u = {
      id: 'u', type: RelationshipType.Partnership,
      partner1Id: 'dad', childrenIds: ['kid'],
    };
    expect(parentCoupleLabel(doc, link({ parentPartnershipId: 'u' }))).toBe('dad');
  });

  it('returns "Parents" when the partnership is not found', () => {
    const doc = createDefaultDocument();
    expect(parentCoupleLabel(doc, link({ parentPartnershipId: 'missing' }))).toBe('Parents');
  });
});
