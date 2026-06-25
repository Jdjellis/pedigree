import { useState, useRef, useEffect, useCallback } from 'react';
import { usePedigreeStore } from '../../stores/pedigreeStore';
import { useUIStore } from '../../stores/uiStore';
import type { LegendEntry } from '../../types/pedigree';
import { createPatternCanvas } from '../../utils/fillPatterns';
import styles from './LegendOverlay.module.css';

const SWATCH_SIZE = 16;

function drawSwatch(
  canvas: HTMLCanvasElement,
  entry: LegendEntry,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const showBoth = !entry.applicableTo;
  const showCircle = entry.applicableTo === 'woman' || showBoth;
  const showSquare = entry.applicableTo === 'man' || showBoth;

  const totalWidth = showBoth ? SWATCH_SIZE * 2 + 2 : SWATCH_SIZE;
  canvas.width = totalWidth;
  canvas.height = SWATCH_SIZE;
  ctx.clearRect(0, 0, totalWidth, SWATCH_SIZE);

  const half = SWATCH_SIZE / 2;
  const qx = entry.quarter === 'topLeft' || entry.quarter === 'bottomLeft' ? 0 : half;
  const qy = entry.quarter === 'topLeft' || entry.quarter === 'topRight' ? 0 : half;

  function applyFill(c: CanvasRenderingContext2D) {
    if (entry.fillPattern === 'solid') {
      c.fillStyle = entry.fillColor;
    } else {
      const patternCanvas = createPatternCanvas(entry.fillPattern, entry.fillColor);
      const pattern = c.createPattern(patternCanvas, 'repeat');
      c.fillStyle = pattern ?? entry.fillColor;
    }
  }

  if (showSquare) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0.5, 0.5, SWATCH_SIZE - 1, SWATCH_SIZE - 1);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, SWATCH_SIZE, SWATCH_SIZE);
    ctx.clip();
    applyFill(ctx);
    ctx.fillRect(qx, qy, half, half);
    ctx.restore();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, SWATCH_SIZE - 1, SWATCH_SIZE - 1);
  }

  if (showCircle) {
    const ox = showBoth ? SWATCH_SIZE + 2 : 0;
    const cx = ox + half;
    const cy = half;
    const r = half - 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    applyFill(ctx);
    ctx.fillRect(ox + qx, qy, half, half);
    ctx.restore();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function SwatchCanvas({ entry }: { entry: LegendEntry }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      drawSwatch(canvasRef.current, entry);
    }
  }, [entry]);

  const width = !entry.applicableTo ? SWATCH_SIZE * 2 + 2 : SWATCH_SIZE;

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={SWATCH_SIZE}
      className={styles.swatch}
      style={{ width, height: SWATCH_SIZE }}
    />
  );
}

export function LegendOverlay() {
  const [collapsed, setCollapsed] = useState(false);
  const legendConfig = usePedigreeStore((s) => s.document.legendConfig);
  const openModal = useUIStore((s) => s.openModal);

  const handleEdit = useCallback(() => {
    openModal('legendEditor');
  }, [openModal]);

  if (!legendConfig || legendConfig.entries.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <button
        className={styles.toggleButton}
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Show legend' : 'Hide legend'}
      >
        {collapsed ? 'Key ▸' : 'Key ▾'}
      </button>

      {!collapsed && (
        <div className={styles.content}>
          {legendConfig.entries.map((entry) => (
            <div key={entry.id} className={styles.row}>
              <SwatchCanvas entry={entry} />
              <span className={styles.label}>
                {entry.name}
              </span>
            </div>
          ))}
          <button className={styles.editButton} onClick={handleEdit}>
            Edit Legend
          </button>
        </div>
      )}
    </div>
  );
}
