import React from 'react';
import { Rect, Text } from 'react-konva';
import type { CanvasBounds } from '../../utils/boundsCalculation';
import type { Individual } from '../../types/pedigree';
import { toRomanNumeral } from '../../utils/boundsCalculation';
import { LABEL_FONT_FAMILY, LABEL_COLOR } from '../../utils/constants';

interface BoundsLayerProps {
  bounds: CanvasBounds | null;
  individuals: Individual[];
}

export const BoundsLayer: React.FC<BoundsLayerProps> = React.memo(
  ({ bounds, individuals }) => {
    if (!bounds) return null;

    const genYMap = new Map<number, number[]>();
    for (const ind of individuals) {
      const gen = ind.generation ?? 0;
      if (!genYMap.has(gen)) genYMap.set(gen, []);
      genYMap.get(gen)!.push(ind.position.y);
    }

    const genLabels: { gen: number; y: number }[] = [];
    for (const [gen, ys] of genYMap) {
      const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
      genLabels.push({ gen, y: avgY });
    }
    genLabels.sort((a, b) => a.gen - b.gen);

    return (
      <>
        <Rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          stroke="#cccccc"
          strokeWidth={1}
          dash={[6, 4]}
          listening={false}
        />
        {genLabels.map(({ gen, y }) => (
          <Text
            key={`gen-${gen}`}
            x={bounds.x + 10}
            y={y - 7}
            text={toRomanNumeral(gen)}
            fontSize={14}
            fontFamily={LABEL_FONT_FAMILY}
            fontStyle="bold"
            fill={LABEL_COLOR}
            listening={false}
          />
        ))}
      </>
    );
  },
);

BoundsLayer.displayName = 'BoundsLayer';
