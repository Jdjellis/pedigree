import React from 'react';
import { Line } from 'react-konva';

export interface TriangleShapeProps {
  size: number;
  strokeColor: string;
  strokeWidth: number;
  fill: string;
}

export const TriangleShape: React.FC<TriangleShapeProps> = React.memo(
  ({ size, strokeColor, strokeWidth, fill }) => {
    const half = size / 2;
    // Pointing-up triangle: top, bottom-right, bottom-left
    const points = [0, -half, half, half, -half, half];

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

TriangleShape.displayName = 'TriangleShape';
