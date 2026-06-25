/**
 * Snapshot of editor state passed to `Command.isAvailable` so commands
 * can gate themselves on runtime conditions without needing to read the
 * store directly.
 */
export interface CommandContext {
  /** Ids of every currently-selected individual. */
  selectedIds: ReadonlySet<string>;
}

/**
 * A single, palette-dispatchable editor action.
 *
 * Commands are stateless descriptors — they hold no React state and can be
 * created outside the component tree.  The `run` function performs the actual
 * mutation by reading Zustand stores imperatively via `getState()`.
 */
export interface Command {
  /** Stable dot-namespaced identifier, e.g. `"document.export"`. */
  id: string;

  /** Human-readable label shown in the command palette. */
  title: string;

  /** Logical grouping used to organise palette results. */
  category: 'document' | 'edit' | 'view' | 'tools';

  /**
   * Extra search terms that help the palette surface this command even when
   * the user's query does not match `title` exactly.
   */
  keywords?: string[];

  /**
   * Human-readable keyboard shortcut hint displayed alongside the command in
   * the palette (e.g. `"⌘Z"`).  This is display-only — the actual shortcut
   * binding lives in `useKeyboardShortcuts`.
   */
  shortcut?: string;

  /**
   * Returns `false` when the command cannot currently be executed and should
   * be hidden or dimmed in the palette.  Omitting this field means the command
   * is always available.
   */
  isAvailable?: (ctx: CommandContext) => boolean;

  /** Execute the command. Must not be called when `isAvailable` returns false. */
  run: () => void;
}
