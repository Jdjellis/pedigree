import type { JSX } from 'react';
import { Line } from 'react-konva';
import type {
  Individual,
  PartnershipRelationship,
  ParentChildRelationship,
} from '../../types/pedigree';
import { LINE_COLOR, LINE_WIDTH, DASH_PATTERN } from '../../utils/constants';

interface ParentChildLineProps {
  partnership: PartnershipRelationship;
  individuals: Record<string, Individual>;
  parentChildLinks: Record<string, ParentChildRelationship>;
}

export function ParentChildLine({
  partnership,
  individuals,
  parentChildLinks,
}: ParentChildLineProps) {
  const p1 = individuals[partnership.partner1Id];
  const p2 = individuals[partnership.partner2Id];

  if (!p1 || !p2) return null;
  if (partnership.childrenIds.length === 0) return null;

  const children = partnership.childrenIds
    .map((id) => individuals[id])
    .filter(Boolean);

  if (children.length === 0) return null;

  // Partnership midpoint
  const partnershipY = (p1.position.y + p2.position.y) / 2;
  const partnershipMidX = (p1.position.x + p2.position.x) / 2;

  // Sibship line Y position (halfway between partnership and children)
  const childrenY = Math.min(...children.map((c) => c.position.y));
  const sibshipY = partnershipY + (childrenY - partnershipY) / 2;

  // Sibship line spans from leftmost to rightmost child
  const childXPositions = children.map((c) => c.position.x);
  const minChildX = Math.min(...childXPositions);
  const maxChildX = Math.max(...childXPositions);

  const lines: JSX.Element[] = [];

  // Vertical line from partnership midpoint down to sibship line
  lines.push(
    <Line
      key={`vert-${partnership.id}`}
      points={[partnershipMidX, partnershipY, partnershipMidX, sibshipY]}
      stroke={LINE_COLOR}
      strokeWidth={LINE_WIDTH}
    />
  );

  // Horizontal sibship line (only if more than one child)
  if (children.length > 1) {
    lines.push(
      <Line
        key={`sib-${partnership.id}`}
        points={[minChildX, sibshipY, maxChildX, sibshipY]}
        stroke={LINE_COLOR}
        strokeWidth={LINE_WIDTH}
      />
    );
  }

  // Vertical drops from sibship line to each child
  for (const child of children) {
    const link = Object.values(parentChildLinks).find(
      (l) =>
        l.parentPartnershipId === partnership.id &&
        l.childId === child.id
    );
    const isAdopted = link?.isAdopted ?? false;

    lines.push(
      <Line
        key={`drop-${child.id}`}
        points={[child.position.x, sibshipY, child.position.x, child.position.y]}
        stroke={LINE_COLOR}
        strokeWidth={LINE_WIDTH}
        dash={isAdopted ? DASH_PATTERN : undefined}
      />
    );
  }

  return <>{lines}</>;
}
