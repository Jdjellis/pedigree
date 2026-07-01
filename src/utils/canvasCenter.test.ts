/**
 * Tests for getVisibleCanvasCenter.
 *
 * The function reads the `.konvajs-content` element's measured rect (or a 300,300
 * fallback stage centre) and passes that stage-local point through the viewport
 * store's screenToCanvas. We stub document.querySelector and the viewport store to
 * observe both branches in isolation.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import { getVisibleCanvasCenter } from './canvasCenter';
import { useViewportStore } from '../stores/viewportStore';

afterEach(() => {
  vi.restoreAllMocks();
  useViewportStore.getState().resetView();
});

describe('getVisibleCanvasCenter', () => {
  it('falls back to the 300,300 stage centre when .konvajs-content is absent', () => {
    vi.spyOn(document, 'querySelector').mockReturnValue(null);
    const screenToCanvas = vi.fn((p: { x: number; y: number }) => p);
    vi.spyOn(useViewportStore, 'getState').mockReturnValue({
      screenToCanvas,
    } as unknown as ReturnType<typeof useViewportStore.getState>);

    const center = getVisibleCanvasCenter();

    expect(screenToCanvas).toHaveBeenCalledWith({ x: 300, y: 300 });
    expect(center).toEqual({ x: 300, y: 300 });
  });

  it('uses the element rect centre when .konvajs-content is present', () => {
    const el = {
      getBoundingClientRect: () => ({ width: 800, height: 600 }),
    } as unknown as Element;
    vi.spyOn(document, 'querySelector').mockReturnValue(el);
    const screenToCanvas = vi.fn((p: { x: number; y: number }) => p);
    vi.spyOn(useViewportStore, 'getState').mockReturnValue({
      screenToCanvas,
    } as unknown as ReturnType<typeof useViewportStore.getState>);

    const center = getVisibleCanvasCenter();

    // rect centre = (width/2, height/2) = (400, 300)
    expect(screenToCanvas).toHaveBeenCalledWith({ x: 400, y: 300 });
    expect(center).toEqual({ x: 400, y: 300 });
  });

  it('applies the real viewport transform to the stage-local centre', () => {
    // With no element, stage centre is 300,300. Pan/zoom the real store and
    // confirm screenToCanvas transforms the fallback point correctly.
    vi.spyOn(document, 'querySelector').mockReturnValue(null);
    useViewportStore.getState().setScale(2);
    useViewportStore.getState().setPosition({ x: 100, y: 40 });

    const center = getVisibleCanvasCenter();

    // screenToCanvas: (screen - position) / scale
    expect(center).toEqual({ x: (300 - 100) / 2, y: (300 - 40) / 2 });
  });
});
