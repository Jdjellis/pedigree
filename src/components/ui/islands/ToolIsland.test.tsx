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
    for (const label of ['Lock editing', 'Hand', 'Select', 'Text', 'Eraser']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('marks the active tool pressed', () => {
    useUIStore.setState({ activeTool: 'text' });
    render(<ToolIsland />);
    expect(screen.getByRole('button', { name: 'Text' })).toHaveAttribute(
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
    screen.getByRole('button', { name: 'Text' }).click();
    expect(useUIStore.getState().activeTool).toBe('text');
  });

  it('reflects the lock toggle state', () => {
    useUIStore.setState({ editingLocked: true });
    render(<ToolIsland />);
    expect(screen.getByRole('button', { name: 'Lock editing' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('renders the default-sex control buttons', () => {
    render(<ToolIsland />);
    for (const label of ['Male', 'Female', 'Unknown']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });
});
