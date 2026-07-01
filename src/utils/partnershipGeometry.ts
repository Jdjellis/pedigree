/**
 * Geometry for partnership relationship lines, shared by the Konva renderer
 * (`PartnershipLine.tsx`) and the SVG exporter (`svgExport.ts`) so the two
 * parallel renderers cannot drift.
 *
 * Historically these lines were drawn as a single horizontal segment at the
 * average y of the two partners — which only looks right when both partners
 * sit in the same generation (equal y). A consanguineous or partnership union
 * that spans generations (created by alt-drag between two levels) then rendered
 * as a segment floating between the symbols, touching neither. Connecting the
 * actual symbol positions fixes that while staying pixel-identical for the
 * common same-generation case.
 */

export interface Point {
  x: number;
  y: number;
}

/** The two parallel segments of a consanguinity (double-line) union. */
export interface ConsanguinityLines {
  a: [number, number, number, number];
  b: [number, number, number, number];
}

/**
 * Return the two parallel segments for a consanguineous union between `p1` and
 * `p2`, offset by `gap` perpendicular to the line joining them. For a
 * same-generation union the perpendicular is vertical, so the pair sits
 * above/below the union exactly as before; for a cross-generation union the
 * offset stays perpendicular to the (now diagonal) connector.
 */
export function consanguinityLines(p1: Point, p2: Point, gap: number): ConsanguinityLines {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  // Unit vector perpendicular to the connector. Horizontal union -> (0, 1).
  const px = -dy / len;
  const py = dx / len;
  const ox = (px * gap) / 2;
  const oy = (py * gap) / 2;
  return {
    a: [p1.x + ox, p1.y + oy, p2.x + ox, p2.y + oy],
    b: [p1.x - ox, p1.y - oy, p2.x - ox, p2.y - oy],
  };
}

/** Midpoint of the segment joining two partners. */
export function partnershipMidpoint(p1: Point, p2: Point): Point {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}
