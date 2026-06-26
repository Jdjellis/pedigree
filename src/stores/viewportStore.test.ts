import { describe, it, expect, beforeEach } from 'vitest';
import { useViewportStore } from './viewportStore';
import { MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM } from '../utils/constants';

const reset = () => useViewportStore.getState().resetView();

describe('viewportStore', () => {
  beforeEach(reset);

  describe('setScale', () => {
    it('clamps below MIN_ZOOM', () => {
      useViewportStore.getState().setScale(MIN_ZOOM - 1);
      expect(useViewportStore.getState().scale).toBe(MIN_ZOOM);
    });

    it('clamps above MAX_ZOOM', () => {
      useViewportStore.getState().setScale(MAX_ZOOM + 100);
      expect(useViewportStore.getState().scale).toBe(MAX_ZOOM);
    });

    it('keeps an in-range value as-is', () => {
      useViewportStore.getState().setScale(2);
      expect(useViewportStore.getState().scale).toBe(2);
    });
  });

  describe('panBy', () => {
    it('accumulates deltas onto the current position', () => {
      const { setPosition, panBy } = useViewportStore.getState();
      setPosition({ x: 10, y: 10 });
      panBy({ x: 5, y: -3 });
      panBy({ x: 1, y: 1 });
      expect(useViewportStore.getState().position).toEqual({ x: 16, y: 8 });
    });
  });

  describe('zoomToPoint', () => {
    it('keeps the focal point fixed in screen space', () => {
      const point = { x: 200, y: 150 };
      useViewportStore.getState().zoomToPoint(point, 2.5);

      // The canvas coordinate under `point` must map back to `point`.
      const screen = useViewportStore.getState().canvasToScreen(
        useViewportStore.getState().screenToCanvas(point),
      );
      expect(screen.x).toBeCloseTo(point.x, 6);
      expect(screen.y).toBeCloseTo(point.y, 6);
      expect(useViewportStore.getState().scale).toBe(2.5);
    });

    it('clamps the target scale to the zoom range', () => {
      useViewportStore.getState().zoomToPoint({ x: 0, y: 0 }, MAX_ZOOM + 10);
      expect(useViewportStore.getState().scale).toBe(MAX_ZOOM);
    });
  });

  describe('screenToCanvas / canvasToScreen', () => {
    it('are inverses of each other', () => {
      const { setScale, setPosition } = useViewportStore.getState();
      setScale(1.75);
      setPosition({ x: 42, y: -17 });

      const canvasPt = { x: 123, y: 456 };
      const roundTrip = useViewportStore
        .getState()
        .screenToCanvas(useViewportStore.getState().canvasToScreen(canvasPt));
      expect(roundTrip.x).toBeCloseTo(canvasPt.x, 6);
      expect(roundTrip.y).toBeCloseTo(canvasPt.y, 6);
    });
  });

  describe('fitToContent', () => {
    it('centers the content within the stage', () => {
      const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      useViewportStore.getState().fitToContent(bounds, 800, 600);

      const { scale, position } = useViewportStore.getState();
      const center = { x: 50, y: 50 };
      const onScreen = {
        x: center.x * scale + position.x,
        y: center.y * scale + position.y,
      };
      expect(onScreen.x).toBeCloseTo(400, 6); // stageWidth / 2
      expect(onScreen.y).toBeCloseTo(300, 6); // stageHeight / 2
    });

    it('never exceeds the zoom bounds', () => {
      // A tiny content box would otherwise scale far past MAX_ZOOM.
      useViewportStore
        .getState()
        .fitToContent({ minX: 0, minY: 0, maxX: 1, maxY: 1 }, 4000, 4000);
      expect(useViewportStore.getState().scale).toBeLessThanOrEqual(MAX_ZOOM);
      expect(useViewportStore.getState().scale).toBeGreaterThanOrEqual(MIN_ZOOM);
    });
  });

  describe('resetView', () => {
    it('restores the default scale and origin', () => {
      const { setScale, setPosition, resetView } = useViewportStore.getState();
      setScale(3);
      setPosition({ x: 99, y: 99 });
      resetView();
      expect(useViewportStore.getState().scale).toBe(DEFAULT_ZOOM);
      expect(useViewportStore.getState().position).toEqual({ x: 0, y: 0 });
    });
  });
});
