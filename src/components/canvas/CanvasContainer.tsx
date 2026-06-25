import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Stage, Layer } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useViewportStore } from '../../stores/viewportStore';
import { useUIStore } from '../../stores/uiStore';
import { usePedigreeStore } from '../../stores/pedigreeStore';
import { GridLayer } from './GridLayer';
import { ConnectionsLayer } from '../connections/ConnectionsLayer';
import { PedigreeSymbol } from './symbols/PedigreeSymbol';
import { DragLinkLayer } from './DragLinkLayer';
import { LegendLayer } from './LegendLayer';
import { BoundsLayer } from './BoundsLayer';
import { computeBounds } from '../../utils/boundsCalculation';
import type { ActiveQuarter } from './symbols/ConditionOverlay';
import type { Individual } from '../../types/pedigree';
import { ZOOM_STEP, MIN_ZOOM, MAX_ZOOM } from '../../utils/constants';
import styles from './CanvasContainer.module.css';

export interface CanvasContainerHandle {
  getStage: () => Konva.Stage | null;
}

export const CanvasContainer = forwardRef<CanvasContainerHandle>(
  (_props, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage>(null);

    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [isDragging, setIsDragging] = useState(false);

    const scale = useViewportStore((s) => s.scale);
    const position = useViewportStore((s) => s.position);
    const setPosition = useViewportStore((s) => s.setPosition);
    const zoomToPoint = useViewportStore((s) => s.zoomToPoint);

    const activeTool = useUIStore((s) => s.activeTool);
    const clearSelection = useUIStore((s) => s.clearSelection);
    const selectedIds = useUIStore((s) => s.selectedIds);
    const hoveredId = useUIStore((s) => s.hoveredId);
    const dragLink = useUIStore((s) => s.dragLink);
    const updateDragLinkCursor = useUIStore((s) => s.updateDragLinkCursor);
    const endDragLink = useUIStore((s) => s.endDragLink);

    // Lift store subscriptions to react-dom context so Konva layers re-render
    const individuals = usePedigreeStore((s) => s.document.individuals);
    const partnerships = usePedigreeStore((s) => s.document.partnerships);
    const parentChildLinks = usePedigreeStore((s) => s.document.parentChildLinks);
    const twinGroups = usePedigreeStore((s) => s.document.twinGroups);
    const legendConfig = usePedigreeStore((s) => s.document.legendConfig);
    const moveLegend = usePedigreeStore((s) => s.moveLegend);

    useImperativeHandle(ref, () => ({
      getStage: () => stageRef.current,
    }));

    // --------------- Resize Observer ---------------
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setDimensions({ width, height });
        }
      });

      observer.observe(container);

      const rect = container.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });

      return () => {
        observer.disconnect();
      };
    }, []);

    // --------------- Wheel / Zoom ---------------
    const handleWheel = useCallback(
      (e: KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();

        const stage = stageRef.current;
        if (!stage) return;

        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const direction = e.evt.deltaY < 0 ? 1 : -1;
        const newScale =
          direction > 0 ? scale * ZOOM_STEP : scale / ZOOM_STEP;

        const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));

        zoomToPoint(pointer, clamped);
      },
      [scale, zoomToPoint]
    );

    // --------------- Stage Drag (Pan) ---------------
    const handleDragStart = useCallback(() => {
      setIsDragging(true);
    }, []);

    const handleDragEnd = useCallback(
      (e: KonvaEventObject<DragEvent>) => {
        setIsDragging(false);
        const stage = e.target;
        if (stage !== stageRef.current) return;
        setPosition({ x: stage.x(), y: stage.y() });
      },
      [setPosition]
    );

    const handleDragMove = useCallback(
      (e: KonvaEventObject<DragEvent>) => {
        const stage = e.target;
        if (stage !== stageRef.current) return;
        setPosition({ x: stage.x(), y: stage.y() });
      },
      [setPosition]
    );

    // --------------- Click on Empty Canvas ---------------
    const handleStageClick = useCallback(
      (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
        const clickedOnEmpty = e.target === e.target.getStage();
        if (clickedOnEmpty) {
          clearSelection();
        }
      },
      [clearSelection]
    );

    const handleStageMouseMove = useCallback(
      (_e: KonvaEventObject<MouseEvent>) => {
        if (!dragLink.active) return;
        const stage = stageRef.current;
        if (!stage) return;
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const { screenToCanvas } = useViewportStore.getState();
        const canvasPos = screenToCanvas(pointer);
        updateDragLinkCursor(canvasPos);
      },
      [dragLink.active, updateDragLinkCursor],
    );

    const handleStageMouseUp = useCallback(() => {
      if (dragLink.active) {
        endDragLink();
      }
    }, [dragLink.active, endDragLink]);

    const isDraggable = activeTool === 'pan';

    const individualsList = Object.values(individuals);

    const bounds = useMemo(() => computeBounds(individualsList), [individualsList]);

    const individualNumbers = useMemo(() => {
      const numbers = new Map<string, number>();
      const genGroups = new Map<number, Individual[]>();
      for (const ind of individualsList) {
        const gen = ind.generation ?? 0;
        if (!genGroups.has(gen)) genGroups.set(gen, []);
        genGroups.get(gen)!.push(ind);
      }
      for (const [, group] of genGroups) {
        group.sort((a, b) => a.position.x - b.position.x);
        group.forEach((ind, idx) => {
          numbers.set(ind.id, idx + 1);
        });
      }
      return numbers;
    }, [individualsList]);

    const getActiveQuarters = useCallback(
      (individual: Individual): ActiveQuarter[] => {
        if (!legendConfig || !individual.conditionIds) return [];
        return legendConfig.entries
          .filter((entry) => individual.conditionIds.includes(entry.id))
          .map((entry) => ({
            quarter: entry.quarter,
            fillColor: entry.fillColor,
            fillPattern: entry.fillPattern,
          }));
      },
      [legendConfig],
    );

    return (
      <div
        ref={containerRef}
        className={styles.container}
        data-tool={activeTool}
        data-dragging={isDragging}
      >
        {dimensions.width > 0 && dimensions.height > 0 && (
          <Stage
            ref={stageRef}
            width={dimensions.width}
            height={dimensions.height}
            scaleX={scale}
            scaleY={scale}
            x={position.x}
            y={position.y}
            draggable={isDraggable}
            onWheel={handleWheel}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragMove={handleDragMove}
            onClick={handleStageClick}
            onTap={handleStageClick}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
          >
            <Layer>
              <BoundsLayer bounds={bounds} individuals={individualsList} />
            </Layer>

            <GridLayer
              width={dimensions.width}
              height={dimensions.height}
              scale={scale}
              position={position}
            />

            <ConnectionsLayer
              partnerships={partnerships}
              parentChildLinks={parentChildLinks}
              twinGroups={twinGroups}
              individuals={individuals}
            />

            <Layer>
              {individualsList.map((individual) => (
                <PedigreeSymbol
                  key={individual.id}
                  individual={individual}
                  isSelected={selectedIds.has(individual.id)}
                  isHovered={hoveredId === individual.id}
                  activeQuarters={getActiveQuarters(individual)}
                  individualNumber={individualNumbers.get(individual.id)}
                />
              ))}
            </Layer>

            <Layer name="selection" />

            <Layer>
              <DragLinkLayer
                active={dragLink.active}
                sourceId={dragLink.sourceId}
                cursorPos={dragLink.cursorPos}
                individuals={individuals}
              />
            </Layer>

            <Layer>
              <LegendLayer
                legendConfig={legendConfig}
                onMove={moveLegend}
                bounds={bounds}
              />
            </Layer>
          </Stage>
        )}
      </div>
    );
  }
);

CanvasContainer.displayName = 'CanvasContainer';
