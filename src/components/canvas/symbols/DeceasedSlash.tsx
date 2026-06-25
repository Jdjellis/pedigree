import React from 'react';
import { Line } from 'react-konva';
import { DECEASED_SLASH_OVERSHOOT } from '../../../utils/constants';

export interface DeceasedSlashProps {
  size: number;
  strokeColor: string;
  strokeWidth: number;
}

export const DeceasedSlash: React.FC<DeceasedSlashProps> = React.memo(
  ({ size, strokeColor, strokeWidth }) => {
    const half = size / 2;
    const overshoot = DECEASED_SLASH_OVERSHOOT;

    // Diagonal line from bottom-left to top-right, with overshoot past symbol bounds
    const points = [
      -(half + overshoot),
      half + overshoot,
      half + overshoot,
      -(half + overshoot),
    ];

    return (
      <Line
        points={points}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
    );
  }
);

DeceasedSlash.displayName = 'DeceasedSlash';
