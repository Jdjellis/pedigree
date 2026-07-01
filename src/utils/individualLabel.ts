import type { Individual } from '../types/pedigree';
import { toRomanNumeral } from './boundsCalculation';

/**
 * A short, human-readable label for an individual, used where a person must be
 * named in UI chrome (e.g. the union picker) rather than drawn on the canvas.
 *
 * Prefers the explicit {@link Individual.displayName}. When absent, falls back
 * to the same pedigree coordinate the canvas shows next to each symbol — the
 * generation Roman numeral plus the 1-based index within that generation ordered
 * left-to-right by x (e.g. `"I-4"`). The numbering mirrors `computeGenerationNumerals`
 * (topmost generation ranked "I") and the per-symbol index in `CanvasContainer`,
 * so the label a user sees in a dialog matches the number beside the node.
 */
export function individualDisplayLabel(
  individuals: Record<string, Individual>,
  id: string,
): string {
  const target = individuals[id];
  if (!target) return 'Unknown';

  const name = target.displayName?.trim();
  if (name) return name;

  const all = Object.values(individuals);
  const minGen = Math.min(...all.map((i) => i.generation ?? 0));
  const gen = target.generation ?? 0;
  const roman = toRomanNumeral(gen - minGen);

  // 1-based index within the generation, ordered by x — the same scheme
  // CanvasContainer uses to number symbols, so labels line up with the canvas.
  const memberNumber =
    all
      .filter((i) => (i.generation ?? 0) === gen)
      .sort((a, b) => a.position.x - b.position.x)
      .findIndex((i) => i.id === id) + 1;

  return `${roman}-${memberNumber}`;
}
