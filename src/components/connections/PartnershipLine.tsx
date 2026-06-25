import { Line } from 'react-konva';
import type { Individual, PartnershipRelationship } from '../../types/pedigree';
import { RelationshipType } from '../../types/enums';
import {
  LINE_COLOR,
  LINE_WIDTH,
  CONSANGUINITY_GAP,
} from '../../utils/constants';

interface PartnershipLineProps {
  partnership: PartnershipRelationship;
  individuals: Record<string, Individual>;
}

export function PartnershipLine({ partnership, individuals }: PartnershipLineProps) {
  const p1 = individuals[partnership.partner1Id];
  const p2 = individuals[partnership.partner2Id];

  if (!p1 || !p2) return null;

  const y = (p1.position.y + p2.position.y) / 2;

  if (partnership.type === RelationshipType.Consanguinity) {
    return (
      <>
        <Line
          points={[p1.position.x, y - CONSANGUINITY_GAP / 2, p2.position.x, y - CONSANGUINITY_GAP / 2]}
          stroke={LINE_COLOR}
          strokeWidth={LINE_WIDTH}
        />
        <Line
          points={[p1.position.x, y + CONSANGUINITY_GAP / 2, p2.position.x, y + CONSANGUINITY_GAP / 2]}
          stroke={LINE_COLOR}
          strokeWidth={LINE_WIDTH}
        />
      </>
    );
  }

  if (partnership.type === RelationshipType.Separation) {
    const midX = (p1.position.x + p2.position.x) / 2;
    const hashSize = 6;
    return (
      <>
        <Line
          points={[p1.position.x, y, p2.position.x, y]}
          stroke={LINE_COLOR}
          strokeWidth={LINE_WIDTH}
        />
        <Line
          points={[midX - 4, y - hashSize, midX + 4, y + hashSize]}
          stroke={LINE_COLOR}
          strokeWidth={LINE_WIDTH}
        />
        <Line
          points={[midX + 2, y - hashSize, midX + 10, y + hashSize]}
          stroke={LINE_COLOR}
          strokeWidth={LINE_WIDTH}
        />
      </>
    );
  }

  // Standard partnership - solid line
  return (
    <Line
      points={[p1.position.x, y, p2.position.x, y]}
      stroke={LINE_COLOR}
      strokeWidth={LINE_WIDTH}
    />
  );
}
