import React from 'react';
import { Rect } from 'react-konva';

export interface SquareShapeProps {
  size: number;
  strokeColor: string;
  strokeWidth: number;
  fill: string;
}

export const SquareShape: React.FC<SquareShapeProps> = React.memo(
  ({ size, strokeColor, strokeWidth, fill }) => (
    <Rect
      x={-size / 2}
      y={-size / 2}
      width={size}
      height={size}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      fill={fill}
    />
  )
);

SquareShape.displayName = 'SquareShape';
