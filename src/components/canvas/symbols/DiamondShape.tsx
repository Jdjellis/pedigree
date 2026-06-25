import React from 'react';
import { Line } from 'react-konva';

export interface DiamondShapeProps {
  size: number;
  strokeColor: string;
  strokeWidth: number;
  fill: string;
}

export const DiamondShape: React.FC<DiamondShapeProps> = React.memo(
  ({ size, strokeColor, strokeWidth, fill }) => {
    const half = size / 2;
    // Diamond vertices: top, right, bottom, left
    const points = [0, -half, half, 0, 0, half, -half, 0];

    return (
      <Line
        points={points}
        closed={true}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        fill={fill}
      />
    );
  }
);

DiamondShape.displayName = 'DiamondShape';
