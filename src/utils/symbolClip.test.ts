import { describe, it, expect, vi } from 'vitest';
import type { Context } from 'konva/lib/Context';
import { clipSymbolPath } from './symbolClip';
import { GenderIdentity } from '../types/enums';

/**
 * Builds a fake Konva {@link Context} whose `_context` is a spy-backed native
 * 2D context. clipSymbolPath only ever touches path-building methods, so we
 * only need to record those.
 */
function makeContext() {
  const native = {
    beginPath: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
  };
  const ctx = { _context: native } as unknown as Context;
  return { ctx, native };
}

describe('clipSymbolPath', () => {
  it('always begins a fresh path', () => {
    const { ctx, native } = makeContext();
    clipSymbolPath(ctx, 40, GenderIdentity.Man);
    expect(native.beginPath).toHaveBeenCalledTimes(1);
  });

  it('draws a full circle of radius size/2 for a woman', () => {
    const { ctx, native } = makeContext();
    clipSymbolPath(ctx, 40, GenderIdentity.Woman);
    expect(native.arc).toHaveBeenCalledWith(0, 0, 20, 0, Math.PI * 2);
    expect(native.rect).not.toHaveBeenCalled();
  });

  it('draws a centered square for a man', () => {
    const { ctx, native } = makeContext();
    clipSymbolPath(ctx, 40, GenderIdentity.Man);
    expect(native.rect).toHaveBeenCalledWith(-20, -20, 40, 40);
    expect(native.arc).not.toHaveBeenCalled();
  });

  it('draws a closed diamond for non-binary / unknown', () => {
    for (const gender of [GenderIdentity.NonBinary, GenderIdentity.Unknown]) {
      const { ctx, native } = makeContext();
      clipSymbolPath(ctx, 40, gender);
      expect(native.moveTo).toHaveBeenCalledWith(0, -20);
      expect(native.lineTo).toHaveBeenCalledWith(20, 0);
      expect(native.lineTo).toHaveBeenCalledWith(0, 20);
      expect(native.lineTo).toHaveBeenCalledWith(-20, 0);
      expect(native.closePath).toHaveBeenCalledTimes(1);
    }
  });
});
