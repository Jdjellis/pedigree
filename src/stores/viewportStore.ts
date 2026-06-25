import { create } from 'zustand';
import { MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM } from '../utils/constants';

interface ViewportState {
  scale: number;
  position: { x: number; y: number };

  setScale: (scale: number) => void;
  setPosition: (pos: { x: number; y: number }) => void;
  zoomToPoint: (
    point: { x: number; y: number },
    newScale: number
  ) => void;
  fitToContent: (bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }, stageWidth: number, stageHeight: number) => void;
  resetView: () => void;

  screenToCanvas: (screenPt: { x: number; y: number }) => {
    x: number;
    y: number;
  };
  canvasToScreen: (canvasPt: { x: number; y: number }) => {
    x: number;
    y: number;
  };
}

export const useViewportStore = create<ViewportState>()((set, get) => ({
  scale: DEFAULT_ZOOM,
  position: { x: 0, y: 0 },

  setScale: (scale) => {
    set({ scale: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale)) });
  },

  setPosition: (position) => {
    set({ position });
  },

  zoomToPoint: (point, newScale) => {
    const { scale, position } = get();
    const clampedScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));

    const mousePointTo = {
      x: (point.x - position.x) / scale,
      y: (point.y - position.y) / scale,
    };

    set({
      scale: clampedScale,
      position: {
        x: point.x - mousePointTo.x * clampedScale,
        y: point.y - mousePointTo.y * clampedScale,
      },
    });
  },

  fitToContent: (bounds, stageWidth, stageHeight) => {
    const padding = 80;
    const contentWidth = bounds.maxX - bounds.minX + padding * 2;
    const contentHeight = bounds.maxY - bounds.minY + padding * 2;

    const scaleX = stageWidth / contentWidth;
    const scaleY = stageHeight / contentHeight;
    const newScale = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, Math.min(scaleX, scaleY))
    );

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    set({
      scale: newScale,
      position: {
        x: stageWidth / 2 - centerX * newScale,
        y: stageHeight / 2 - centerY * newScale,
      },
    });
  },

  resetView: () => {
    set({ scale: DEFAULT_ZOOM, position: { x: 0, y: 0 } });
  },

  screenToCanvas: (screenPt) => {
    const { scale, position } = get();
    return {
      x: (screenPt.x - position.x) / scale,
      y: (screenPt.y - position.y) / scale,
    };
  },

  canvasToScreen: (canvasPt) => {
    const { scale, position } = get();
    return {
      x: canvasPt.x * scale + position.x,
      y: canvasPt.y * scale + position.y,
    };
  },
}));
