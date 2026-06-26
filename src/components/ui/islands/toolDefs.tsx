import { MousePointer2, Minus, Type, Eraser } from 'lucide-react';
import type { ActiveTool } from '../../../stores/uiStore';
import { SquareIcon, CircleIcon, DiamondIcon } from './toolIcons';

/**
 * The subset of tools that get a top-level button + number badge in the tool
 * island. Excludes `hand`, which is a modal helper rendered separately with no
 * badge. Used to type the badge row and its activator lookup exhaustively.
 */
export type PlacementToolId = Exclude<ActiveTool, 'hand'>;

/** A single placeable tool's display metadata. */
export interface ToolDef {
  id: PlacementToolId;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
}

/** Placeable tools, in toolbar display order, with their number shortcuts. */
export const PLACEMENT_TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select', shortcut: '1', icon: <MousePointer2 size={19} /> },
  { id: 'male', label: 'Add male', shortcut: '2', icon: <SquareIcon /> },
  { id: 'female', label: 'Add female', shortcut: '3', icon: <CircleIcon /> },
  { id: 'unknown', label: 'Add unknown sex', shortcut: '4', icon: <DiamondIcon /> },
  { id: 'partnership', label: 'Partnership', shortcut: '5', icon: <Minus size={19} /> },
  { id: 'text', label: 'Text', shortcut: '6', icon: <Type size={19} /> },
  { id: 'eraser', label: 'Eraser', shortcut: '7', icon: <Eraser size={19} /> },
];
