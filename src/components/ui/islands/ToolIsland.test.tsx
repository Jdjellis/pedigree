import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ToolIsland } from './ToolIsland';
import { useUIStore } from '../../../stores/uiStore';

describe('ToolIsland', () => {
  beforeEach(() => {
    cleanup();
    useUIStore.setState({ activeTool: 'select', editingLocked: false });
  });

  it('renders a button for each tool plus lock and hand', () => {
    render(<ToolIsland />);
    for (const label of [
      'Lock editing', 'Hand', 'Select', 'Add male', 'Add female',
      'Add unknown sex', 'Partnership', 'Text', 'Eraser',
    ]) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('marks the active tool pressed', () => {
    useUIStore.setState({ activeTool: 'male' });
    render(<ToolIsland />);
    expect(screen.getByRole('button', { name: 'Add male' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('activates a tool on click', () => {
    render(<ToolIsland />);
    screen.getByRole('button', { name: 'Add female' }).click();
    expect(useUIStore.getState().activeTool).toBe('female');
  });

  it('reflects the lock toggle state', () => {
    useUIStore.setState({ editingLocked: true });
    render(<ToolIsland />);
    expect(screen.getByRole('button', { name: 'Lock editing' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
