import { describe, it, expect } from 'vitest';
import { resolveCanvasCursor } from './canvasCursor';

describe('resolveCanvasCursor', () => {
  it('shows grabbing while a pan gesture is in progress', () => {
    expect(
      resolveCanvasCursor({
        panning: true,
        spaceHeld: false,
        hovering: false,
        tool: 'select',
      }),
    ).toBe('grabbing');
  });

  it('prioritises the active pan gesture over hover and space-held state', () => {
    expect(
      resolveCanvasCursor({
        panning: true,
        spaceHeld: true,
        hovering: true,
        tool: 'select',
      }),
    ).toBe('grabbing');
  });

  it('shows grab when the spacebar is held but no pan is in progress', () => {
    expect(
      resolveCanvasCursor({
        panning: false,
        spaceHeld: true,
        hovering: false,
        tool: 'select',
      }),
    ).toBe('grab');
  });

  it('keeps the grab (pan-ready) cursor even while hovering a symbol', () => {
    // Space-held is "pan anywhere" mode, so hovering a symbol must not steal
    // the affordance back to a pointer.
    expect(
      resolveCanvasCursor({
        panning: false,
        spaceHeld: true,
        hovering: true,
        tool: 'select',
      }),
    ).toBe('grab');
  });

  it('shows a pointer when hovering a symbol in the select tool', () => {
    expect(
      resolveCanvasCursor({
        panning: false,
        spaceHeld: false,
        hovering: true,
        tool: 'select',
      }),
    ).toBe('pointer');
  });

  it('does NOT show a pointer when hovering in the eraser tool', () => {
    // The eraser has its own custom cursor (see CanvasContainer.module.css); a
    // hover pointer would clobber it. Falling back to '' lets the CSS tool
    // cursor win.
    expect(
      resolveCanvasCursor({
        panning: false,
        spaceHeld: false,
        hovering: true,
        tool: 'eraser',
      }),
    ).toBe('');
  });

  it('does NOT show a pointer when hovering in the text tool', () => {
    // Text/placement tools use a crosshair; hovering a symbol should not change
    // it to a pointer.
    expect(
      resolveCanvasCursor({
        panning: false,
        spaceHeld: false,
        hovering: true,
        tool: 'text',
      }),
    ).toBe('');
  });

  it('does NOT show a pointer when hovering in the hand (pan) tool', () => {
    expect(
      resolveCanvasCursor({
        panning: false,
        spaceHeld: false,
        hovering: true,
        tool: 'hand',
      }),
    ).toBe('');
  });

  it('falls back to the empty string (CSS tool cursor) when nothing applies', () => {
    expect(
      resolveCanvasCursor({
        panning: false,
        spaceHeld: false,
        hovering: false,
        tool: 'select',
      }),
    ).toBe('');
  });
});
