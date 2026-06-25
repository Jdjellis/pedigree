import React, { useMemo } from 'react';
import { Group, Text } from 'react-konva';
import type { Individual } from '../../../types/pedigree';
import { VitalStatus } from '../../../types/enums';
import {
  SYMBOL_SIZE,
  LABEL_FONT_SIZE,
  LABEL_FONT_FAMILY,
  LABEL_COLOR,
  LABEL_OFFSET_Y,
} from '../../../utils/constants';

export interface SymbolLabelProps {
  individual: Individual;
  individualNumber?: number;
}

const LINE_HEIGHT = LABEL_FONT_SIZE + 4;

export const SymbolLabel: React.FC<SymbolLabelProps> = React.memo(
  ({ individual, individualNumber }) => {
    const lines = useMemo(() => {
      const result: string[] = [];

      // Line 1: individual number within generation
      if (individualNumber != null) {
        result.push(`${individualNumber}`);
      }

      // Line 2: display name
      if (individual.displayName) {
        result.push(individual.displayName);
      }

      // Line 2: age (or "d. [age]" if deceased)
      if (individual.age != null) {
        if (
          individual.vitalStatus === VitalStatus.Deceased ||
          individual.vitalStatus === VitalStatus.Stillborn
        ) {
          result.push(`d. ${individual.age}`);
        } else {
          result.push(`${individual.age}`);
        }
      }

      // Line 3: sex assigned at birth annotation (AMAB / AFAB)
      if (individual.sexAssignedAtBirth) {
        result.push(individual.sexAssignedAtBirth);
      }

      // Subsequent lines: conditions with age of onset
      for (const condition of individual.conditions) {
        if (condition.ageOfOnset != null) {
          result.push(`${condition.name} (dx ${condition.ageOfOnset})`);
        } else {
          result.push(condition.name);
        }
      }

      return result;
    }, [individual, individualNumber]);

    if (lines.length === 0) {
      return null;
    }

    const startY = SYMBOL_SIZE / 2 + LABEL_OFFSET_Y;

    return (
      <Group>
        {lines.map((line, index) => (
          <Text
            key={index}
            text={line}
            y={startY + index * LINE_HEIGHT}
            fontSize={LABEL_FONT_SIZE}
            fontFamily={LABEL_FONT_FAMILY}
            fill={LABEL_COLOR}
            align="center"
            width={200}
            x={-100}
          />
        ))}
      </Group>
    );
  }
);

SymbolLabel.displayName = 'SymbolLabel';
