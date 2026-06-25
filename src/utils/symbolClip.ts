import type { Context } from 'konva/lib/Context';
import { GenderIdentity } from '../types/enums';

/**
 * Draw a clipping path matching the base symbol shape on the given 2D context.
 * Used to constrain fills (quarter shading, affected overlays) within the symbol boundary.
 */
export function clipSymbolPath(ctx: Context, size: number, gender: GenderIdentity) {
  const half = size / 2;
  const nativeCtx = ctx._context;

  nativeCtx.beginPath();

  switch (gender) {
    case GenderIdentity.Woman:
      nativeCtx.arc(0, 0, half, 0, Math.PI * 2);
      break;

    case GenderIdentity.Man:
      nativeCtx.rect(-half, -half, size, size);
      break;

    case GenderIdentity.NonBinary:
    case GenderIdentity.Unknown:
    default:
      // Diamond path
      nativeCtx.moveTo(0, -half);
      nativeCtx.lineTo(half, 0);
      nativeCtx.lineTo(0, half);
      nativeCtx.lineTo(-half, 0);
      nativeCtx.closePath();
      break;
  }
}
