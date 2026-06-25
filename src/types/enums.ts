/**
 * Gender identity determines the pedigree SYMBOL shape per NSGC 2022:
 *   man -> square, woman -> circle, nonBinary/unknown -> diamond
 */
export enum GenderIdentity {
  Man = 'man',
  Woman = 'woman',
  NonBinary = 'nonBinary',
  Unknown = 'unknown',
}

/**
 * Sex assigned at birth — clinically relevant for risk assessment.
 * Shown as annotation text below the symbol (AMAB, AFAB).
 * Omitted for cisgender individuals (implied by symbol).
 */
export enum SexAssignedAtBirth {
  AMAB = 'AMAB',
  AFAB = 'AFAB',
  UAAB = 'UAAB',
}

export enum VitalStatus {
  Alive = 'alive',
  Deceased = 'deceased',
  Stillborn = 'stillborn',
}

export enum PregnancyOutcome {
  SAB = 'SAB',
  TOP = 'TOP',
  ECT = 'ECT',
  SB = 'SB',
}

export enum RelationshipType {
  Partnership = 'partnership',
  Consanguinity = 'consanguinity',
  Separation = 'separation',
  ParentChild = 'parentChild',
  Adoption = 'adoption',
}

export enum TwinType {
  Monozygotic = 'monozygotic',
  Dizygotic = 'dizygotic',
  Unknown = 'unknown',
}
