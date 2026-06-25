import React from 'react';
import { Shape } from 'react-konva';
import { GenderIdentity } from '../../../types/enums';
import type { QuarterPosition, FillPatternType } from '../../../types/pedigree';
import { clipSymbolPath } from '../../../utils/symbolClip';
import { createPatternCanvas } from '../../../utils/fillPatterns';

export interface ActiveQuarter {
  quarter: QuarterPosition;
  fillColor: string;
  fillPattern: FillPatternType;
}

export interface ConditionOverlayProps {
  size: number;
  genderIdentity: GenderIdentity;
  activeQuarters: ActiveQuarter[];
}

function getQuarterRect(quarter: QuarterPosition, half: number) {
  switch (quarter) {
    case 'topLeft':
      return { x: -half, y: -half, w: half, h: half };
    case 'topRight':
      return { x: 0, y: -half, w: half, h: half };
    case 'bottomLeft':
      return { x: -half, y: 0, w: half, h: half };
    case 'bottomRight':
      return { x: 0, y: 0, w: half, h: half };
  }
}

export const ConditionOverlay: React.FC<ConditionOverlayProps> = React.memo(
  ({ size, genderIdentity, activeQuarters }) => {
    if (activeQuarters.length === 0) return null;

    return (
      <Shape
        sceneFunc={(ctx, shape) => {
          const half = size / 2;
          const nativeCtx = ctx._context;

          nativeCtx.save();
          clipSymbolPath(ctx, size, genderIdentity);
          nativeCtx.clip();

          for (const aq of activeQuarters) {
            const rect = getQuarterRect(aq.quarter, half);

            if (aq.fillPattern === 'solid') {
              nativeCtx.fillStyle = aq.fillColor;
            } else {
              const patternCanvas = createPatternCanvas(aq.fillPattern, aq.fillColor);
              const pattern = nativeCtx.createPattern(patternCanvas, 'repeat');
              if (pattern) {
                nativeCtx.fillStyle = pattern;
              } else {
                nativeCtx.fillStyle = aq.fillColor;
              }
            }

            nativeCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
          }

          nativeCtx.restore();
          ctx.fillStrokeShape(shape);
        }}
      />
    );
  },
);

ConditionOverlay.displayName = 'ConditionOverlay';
