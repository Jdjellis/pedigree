import type { FillPatternType } from '../types/pedigree';

const patternCache = new Map<string, HTMLCanvasElement>();

export function createPatternCanvas(
  patternType: FillPatternType,
  color: string,
  tileSize = 8,
): HTMLCanvasElement {
  const key = `${patternType}-${color}-${tileSize}`;
  const cached = patternCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = tileSize;
  canvas.height = tileSize;
  const ctx = canvas.getContext('2d')!;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;

  switch (patternType) {
    case 'solid':
      ctx.fillRect(0, 0, tileSize, tileSize);
      break;

    case 'diagonalLines':
      // 45-degree lines repeating across the tile
      ctx.beginPath();
      ctx.moveTo(0, tileSize);
      ctx.lineTo(tileSize, 0);
      ctx.moveTo(-tileSize / 2, tileSize / 2);
      ctx.lineTo(tileSize / 2, -tileSize / 2);
      ctx.moveTo(tileSize / 2, tileSize + tileSize / 2);
      ctx.lineTo(tileSize + tileSize / 2, tileSize / 2);
      ctx.stroke();
      break;

    case 'dots': {
      const dotRadius = tileSize / 5;
      ctx.beginPath();
      ctx.arc(tileSize / 2, tileSize / 2, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'crosshatch':
      // Two sets of diagonal lines (45° and -45°)
      ctx.beginPath();
      // Forward diagonal
      ctx.moveTo(0, tileSize);
      ctx.lineTo(tileSize, 0);
      ctx.moveTo(-tileSize / 2, tileSize / 2);
      ctx.lineTo(tileSize / 2, -tileSize / 2);
      ctx.moveTo(tileSize / 2, tileSize + tileSize / 2);
      ctx.lineTo(tileSize + tileSize / 2, tileSize / 2);
      // Back diagonal
      ctx.moveTo(0, 0);
      ctx.lineTo(tileSize, tileSize);
      ctx.moveTo(-tileSize / 2, tileSize / 2);
      ctx.lineTo(tileSize / 2, tileSize + tileSize / 2);
      ctx.moveTo(tileSize / 2, -tileSize / 2);
      ctx.lineTo(tileSize + tileSize / 2, tileSize / 2);
      ctx.stroke();
      break;

    case 'horizontalStripes':
      ctx.beginPath();
      ctx.moveTo(0, tileSize / 2);
      ctx.lineTo(tileSize, tileSize / 2);
      ctx.stroke();
      break;

    case 'verticalStripes':
      ctx.beginPath();
      ctx.moveTo(tileSize / 2, 0);
      ctx.lineTo(tileSize / 2, tileSize);
      ctx.stroke();
      break;
  }

  patternCache.set(key, canvas);
  return canvas;
}
