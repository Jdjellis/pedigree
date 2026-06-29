import type { PedigreeDocument } from '../types/pedigree';

/**
 * Resolve the parent partnership (sibship) shared by every individual in `ids`.
 *
 * An individual's sibship is the `parentPartnershipId` of any parent-child link
 * whose `childId` is that individual. Returns the partnership id common to all
 * given individuals, or `null` when there are fewer than two ids, when any id is
 * a founder with no parent links, or when the ids do not all share a single
 * common sibship. When more than one common sibship exists, the
 * lexicographically-first partnership id is returned for determinism.
 */
export function commonSibshipId(
  doc: Pick<PedigreeDocument, 'parentChildLinks'>,
  ids: string[],
): string | null {
  if (ids.length < 2) return null;
  const links = Object.values(doc.parentChildLinks);
  let common: Set<string> | null = null;
  for (const id of ids) {
    const partnerships = new Set(
      links.filter((l) => l.childId === id).map((l) => l.parentPartnershipId),
    );
    if (partnerships.size === 0) return null;
    common =
      common === null
        ? partnerships
        : new Set([...common].filter((p) => partnerships.has(p)));
    if (common.size === 0) return null;
  }
  if (!common || common.size === 0) return null;
  return [...common].sort()[0];
}
