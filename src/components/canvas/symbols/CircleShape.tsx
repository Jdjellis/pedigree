import React from 'react';
import { Circle } from 'react-konva';

export interface CircleShapeProps {
  size: number;
  strokeColor: string;
  strokeWidth: number;
  fill: string;
}

export const CircleShape: React.FC<CircleShapeProps> = React.memo(
  ({ size, strokeColor, strokeWidth, fill }) => (
    <Circle
      x={0}
      y={0}
      radius={size / 2}
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      fill={fill}
    />
  )
);

CircleShape.displayName = 'CircleShape';
