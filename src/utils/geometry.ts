import type { Position } from '../types/pedigree';

export function midpoint(a: Position, b: Position): Position {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function distance(a: Position, b: Position): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function boundingBox(positions: Position[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (positions.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  return {
    minX: Math.min(...positions.map((p) => p.x)),
    minY: Math.min(...positions.map((p) => p.y)),
    maxX: Math.max(...positions.map((p) => p.x)),
    maxY: Math.max(...positions.map((p) => p.y)),
  };
}
