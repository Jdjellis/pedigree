import React from 'react';
import { Arrow, Text } from 'react-konva';
import { SYMBOL_COLOR, LABEL_FONT_FAMILY } from '../../../utils/constants';

export interface ProbandArrowProps {
  size: number;
  isProband: boolean;
  isConsultand: boolean;
}

export const ProbandArrow: React.FC<ProbandArrowProps> = React.memo(
  ({ size, isProband, isConsultand }) => {
    if (!isProband && !isConsultand) return null;

    const half = size / 2;
    const offset = 8;
    const arrowLen = 14;

    // Arrow starts below-left of symbol, points upper-right toward symbol
    const startX = -(half + offset + arrowLen);
    const startY = half + offset + arrowLen;
    const endX = -(half + offset);
    const endY = half + offset;

    return (
      <>
        <Arrow
          points={[startX, startY, endX, endY]}
          pointerLength={7}
          pointerWidth={7}
          fill={SYMBOL_COLOR}
          stroke={SYMBOL_COLOR}
          strokeWidth={1.5}
        />
        {isProband && (
          <Text
            x={startX - 12}
            y={startY - 6}
            text="P"
            fontSize={11}
            fontFamily={LABEL_FONT_FAMILY}
            fontStyle="bold"
            fill={SYMBOL_COLOR}
          />
        )}
      </>
    );
  },
);

ProbandArrow.displayName = 'ProbandArrow';
