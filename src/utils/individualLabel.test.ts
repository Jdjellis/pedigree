import { describe, it, expect } from 'vitest';
import { individualDisplayLabel } from './individualLabel';
import type { Individual } from '../types/pedigree';
import { GenderIdentity, VitalStatus } from '../types/enums';

function person(overrides: Partial<Individual> & { id: string }): Individual {
  return {
    genderIdentity: GenderIdentity.Unknown,
    vitalStatus: VitalStatus.Alive,
    conditionIds: [],
    conditions: [],
    investigations: [],
    annotations: [],
    isProband: false,
    isPregnancy: false,
    position: { x: 0, y: 0 },
    generation: 0,
    ...overrides,
  };
}

function byId(list: Individual[]): Record<string, Individual> {
  return Object.fromEntries(list.map((p) => [p.id, p]));
}

describe('individualDisplayLabel', () => {
  it('prefers an explicit displayName', () => {
    const doc = byId([person({ id: 'a', displayName: 'Jane Doe' })]);
    expect(individualDisplayLabel(doc, 'a')).toBe('Jane Doe');
  });

  it('trims whitespace-only displayName and falls back to a coordinate', () => {
    const doc = byId([person({ id: 'a', displayName: '   ', generation: 0 })]);
    expect(individualDisplayLabel(doc, 'a')).toBe('I-1');
  });

  it('numbers members within a generation left-to-right by x, matching the canvas', () => {
    const doc = byId([
      person({ id: 'right', generation: 0, position: { x: 260, y: 0 } }),
      person({ id: 'left', generation: 0, position: { x: -60, y: 0 } }),
      person({ id: 'mid', generation: 0, position: { x: 140, y: 0 } }),
    ]);
    expect(individualDisplayLabel(doc, 'left')).toBe('I-1');
    expect(individualDisplayLabel(doc, 'mid')).toBe('I-2');
    expect(individualDisplayLabel(doc, 'right')).toBe('I-3');
  });

  it('ranks the topmost generation present as "I" (relative Roman numerals)', () => {
    const doc = byId([
      person({ id: 'gp', generation: -1, position: { x: 0, y: -150 } }),
      person({ id: 'kid', generation: 0, position: { x: 0, y: 0 } }),
    ]);
    expect(individualDisplayLabel(doc, 'gp')).toBe('I-1');
    expect(individualDisplayLabel(doc, 'kid')).toBe('II-1');
  });

  it('returns Unknown for a missing individual', () => {
    expect(individualDisplayLabel({}, 'nope')).toBe('Unknown');
  });
});
