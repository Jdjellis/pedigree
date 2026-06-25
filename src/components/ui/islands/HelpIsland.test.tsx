import { render, screen, fireEvent } from '@testing-library/react';
import { useUIStore } from '../../../stores/uiStore';
import { HelpIsland } from './HelpIsland';

beforeEach(() => {
  // Reset UI store to initial state before each test.
  useUIStore.getState().closeModal();
});

test('renders the ? button by accessible name', () => {
  render(<HelpIsland />);

  expect(screen.getByRole('button', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
});

test('clicking the button opens the shortcuts modal', () => {
  render(<HelpIsland />);

  const btn = screen.getByRole('button', { name: 'Keyboard shortcuts' });
  fireEvent.click(btn);

  expect(useUIStore.getState().activeModal).toBe('shortcuts');
});

test('button has correct title attribute', () => {
  render(<HelpIsland />);

  const btn = screen.getByRole('button', { name: 'Keyboard shortcuts' });
  expect(btn).toHaveAttribute('title', 'Keyboard shortcuts');
});
