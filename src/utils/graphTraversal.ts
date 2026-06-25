import type { PedigreeDocument, Individual } from '../types/pedigree';

export function findParents(
  doc: PedigreeDocument,
  individualId: string
): { father?: Individual; mother?: Individual; partnershipId?: string } {
  for (const link of Object.values(doc.parentChildLinks)) {
    if (link.childId === individualId) {
      const partnership = doc.partnerships[link.parentPartnershipId];
      if (!partnership) continue;

      const p1 = doc.individuals[partnership.partner1Id];
      const p2 = doc.individuals[partnership.partner2Id];

      // Return by biological role if possible, otherwise by order
      return {
        father: p1,
        mother: p2,
        partnershipId: partnership.id,
      };
    }
  }
  return {};
}

export function findChildren(
  doc: PedigreeDocument,
  individualId: string
): Individual[] {
  const children: Individual[] = [];

  for (const partnership of Object.values(doc.partnerships)) {
    if (
      partnership.partner1Id === individualId ||
      partnership.partner2Id === individualId
    ) {
      for (const childId of partnership.childrenIds) {
        const child = doc.individuals[childId];
        if (child) children.push(child);
      }
    }
  }

  return children;
}

export function findSiblings(
  doc: PedigreeDocument,
  individualId: string
): Individual[] {
  const { partnershipId } = findParents(doc, individualId);
  if (!partnershipId) return [];

  const partnership = doc.partnerships[partnershipId];
  if (!partnership) return [];

  return partnership.childrenIds
    .filter((id) => id !== individualId)
    .map((id) => doc.individuals[id])
    .filter(Boolean);
}

export function findPartnerships(
  doc: PedigreeDocument,
  individualId: string
): string[] {
  return Object.values(doc.partnerships)
    .filter(
      (p) =>
        p.partner1Id === individualId || p.partner2Id === individualId
    )
    .map((p) => p.id);
}

export function hasParents(
  doc: PedigreeDocument,
  individualId: string
): boolean {
  return Object.values(doc.parentChildLinks).some(
    (link) => link.childId === individualId
  );
}

export function hasPartnership(
  doc: PedigreeDocument,
  individualId: string
): boolean {
  return Object.values(doc.partnerships).some(
    (p) =>
      p.partner1Id === individualId || p.partner2Id === individualId
  );
}
