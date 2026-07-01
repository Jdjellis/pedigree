import type { JSX } from 'react';
import { Line, Text } from 'react-konva';
import type { Individual, PartnershipRelationship } from '../../types/pedigree';
import {
  LINE_COLOR,
  LINE_WIDTH,
  CHILDLESS_STUB,
  CHILDLESS_BAR_HALF,
  CHILDLESS_BAR_GAP,
  LABEL_FONT_SIZE,
  LABEL_FONT_FAMILY,
  LABEL_COLOR,
  RELATIONSHIP_LABEL_OFFSET,
} from '../../utils/constants';
import { childlessMarks } from '../../utils/partnershipGeometry';
import { individualChildlessAnchor, individualHasChildren } from '../../utils/childlessness';

interface IndividualChildlessLineProps {
  individual: Individual;
  partnerships: Record<string, PartnershipRelationship>;
}

/**
 * Marks for an individual documented as childless (infertility / no children by
 * choice) with no partner drawn, hung straight below the symbol. The no-partner
 * analogue of {@link childlessMarkElements} in `PartnershipLine.tsx`: identical
 * stub + cross-bar(s) geometry, anchored at the symbol's bottom edge instead of
 * a relationship-line midpoint. Non-interactive — the individual symbol carries
 * selection and drives the properties panel.
 *
 * Suppressed once the individual has children on the canvas: the marker would
 * contradict the descent line, and the panel control is disabled there, so a
 * stale marker would otherwise be unremovable (mirrors svgExport.ts).
 */
export function IndividualChildlessLine({
  individual,
  partnerships,
}: IndividualChildlessLineProps): JSX.Element | null {
  if (!individual.childlessStatus) return null;
  if (individualHasChildren(partnerships, individual.id)) return null;

  const anchor = individualChildlessAnchor(individual);
  const { stub, bars } = childlessMarks(anchor, individual.childlessStatus, {
    stub: CHILDLESS_STUB,
    barHalf: CHILDLESS_BAR_HALF,
    barGap: CHILDLESS_BAR_GAP,
  });

  const els: JSX.Element[] = [
    <Line
      key={`icl-stub-${individual.id}`}
      points={stub}
      stroke={LINE_COLOR}
      strokeWidth={LINE_WIDTH}
      listening={false}
    />,
    ...bars.map((b, i) => (
      <Line
        key={`icl-bar-${individual.id}-${i}`}
        points={b}
        stroke={LINE_COLOR}
        strokeWidth={LINE_WIDTH}
        listening={false}
      />
    )),
  ];

  const reason = individual.childlessReason?.trim();
  if (reason) {
    els.push(
      <Text
        key={`icl-reason-${individual.id}`}
        text={reason}
        x={anchor.x - 100}
        y={anchor.y + CHILDLESS_STUB + RELATIONSHIP_LABEL_OFFSET}
        width={200}
        align="center"
        fontSize={LABEL_FONT_SIZE}
        fontFamily={LABEL_FONT_FAMILY}
        fill={LABEL_COLOR}
        listening={false}
      />,
    );
  }

  return <>{els}</>;
}
