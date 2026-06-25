import { describe, it, expect } from 'vitest';
import { filterCommands } from './filterCommands';
import type { Command, CommandContext } from './types';

describe('filterCommands', () => {
  // Inline test fixtures
  const testCommands: Command[] = [
    {
      id: 'document.export',
      title: 'Export…',
      category: 'document',
      keywords: ['save', 'download', 'pdf', 'png'],
      run: () => {},
    },
    {
      id: 'document.new',
      title: 'New document',
      category: 'document',
      keywords: ['create', 'reset'],
      run: () => {},
    },
    {
      id: 'edit.undo',
      title: 'Undo',
      category: 'edit',
      keywords: ['revert'],
      run: () => {},
    },
    {
      id: 'edit.delete',
      title: 'Delete selected',
      category: 'edit',
      keywords: ['remove'],
      isAvailable: (ctx: CommandContext) => ctx.selectedIds.size > 0,
      run: () => {},
    },
    {
      id: 'view.zoom',
      title: 'Zoom in',
      category: 'view',
      keywords: ['bigger', 'larger'],
      run: () => {},
    },
  ];

  const emptyContext: CommandContext = { selectedIds: new Set() };
  const contextWithSelection: CommandContext = { selectedIds: new Set(['person1']) };

  it('empty query returns all available commands in registry order', () => {
    const result = filterCommands('', testCommands, emptyContext);
    // All commands should be available (only delete.selected requires selection)
    expect(result).toHaveLength(4);
    expect(result[0].id).toBe('document.export');
    expect(result[1].id).toBe('document.new');
    expect(result[2].id).toBe('edit.undo');
    expect(result[3].id).toBe('view.zoom');
  });

  it('whitespace-only query treated as empty', () => {
    const result = filterCommands('   ', testCommands, emptyContext);
    expect(result).toHaveLength(4);
  });

  it('excludes unavailable commands', () => {
    // Without selection, delete.selected should be excluded
    const result = filterCommands('', testCommands, emptyContext);
    const ids = result.map((c) => c.id);
    expect(ids).not.toContain('edit.delete');

    // With selection, it should be included
    const resultWithSelection = filterCommands('', testCommands, contextWithSelection);
    const idsWithSelection = resultWithSelection.map((c) => c.id);
    expect(idsWithSelection).toContain('edit.delete');
  });

  it('excludes unavailable commands even when they match the query', () => {
    // 'delete' matches 'Delete selected' but should be excluded when unavailable
    const result = filterCommands('delete', testCommands, emptyContext);
    const ids = result.map((c) => c.id);
    expect(ids).not.toContain('edit.delete');

    // With selection, it should be included
    const resultWithSelection = filterCommands('delete', testCommands, contextWithSelection);
    const idsWithSelection = resultWithSelection.map((c) => c.id);
    expect(idsWithSelection).toContain('edit.delete');
  });

  it('matches query substring in title', () => {
    const result = filterCommands('exp', testCommands, emptyContext);
    const ids = result.map((c) => c.id);
    expect(ids).toContain('document.export');
  });

  it('case-insensitive matching', () => {
    const resultLower = filterCommands('exp', testCommands, emptyContext);
    const resultUpper = filterCommands('EXP', testCommands, emptyContext);
    const resultMixed = filterCommands('ExP', testCommands, emptyContext);

    expect(resultLower.map((c) => c.id)).toEqual(resultUpper.map((c) => c.id));
    expect(resultLower.map((c) => c.id)).toEqual(resultMixed.map((c) => c.id));
  });

  it('matches query substring in keywords', () => {
    const result = filterCommands('download', testCommands, emptyContext);
    const ids = result.map((c) => c.id);
    expect(ids).toContain('document.export'); // 'download' is in keywords
  });

  it('ranks prefix matches before substring matches', () => {
    const commands: Command[] = [
      {
        id: 'cmd1',
        title: 'Existing command',
        category: 'edit',
        run: () => {},
      },
      {
        id: 'cmd2',
        title: 'Export settings',
        category: 'document',
        keywords: ['save'],
        run: () => {},
      },
      {
        id: 'cmd3',
        title: 'My export tool',
        category: 'document',
        keywords: ['download'],
        run: () => {},
      },
    ];

    const result = filterCommands('exp', commands, emptyContext);
    // cmd2 starts with 'exp', cmd3 only contains it in the title
    // so cmd2 should come first (prefix match before substring match)
    expect(result[0].id).toBe('cmd2');
    expect(result[1].id).toBe('cmd3');
  });

  it('preserves registry order within same rank tier', () => {
    const commands: Command[] = [
      {
        id: 'cmd1',
        title: 'Zoom in',
        category: 'view',
        keywords: ['zoom'],
        run: () => {},
      },
      {
        id: 'cmd2',
        title: 'Zoom out',
        category: 'view',
        keywords: ['zoom'],
        run: () => {},
      },
      {
        id: 'cmd3',
        title: 'Settings zoom',
        category: 'view',
        keywords: ['zoom'],
        run: () => {},
      },
    ];

    const result = filterCommands('zoom', commands, emptyContext);
    // cmd1 and cmd2 start with 'zoom', should preserve order
    expect(result[0].id).toBe('cmd1');
    expect(result[1].id).toBe('cmd2');
    // cmd3 only contains 'zoom' in substring
    expect(result[2].id).toBe('cmd3');
  });

  it('no matches returns empty array', () => {
    const result = filterCommands('nonexistent', testCommands, emptyContext);
    expect(result).toHaveLength(0);
  });
});
