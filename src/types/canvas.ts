export interface ViewportState {
  scale: number;
  position: { x: number; y: number };
}

export interface CanvasBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
