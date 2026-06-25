import { render, screen, fireEvent } from '@testing-library/react';
import { useViewportStore } from '../../../stores/viewportStore';
import { ZoomIsland } from './ZoomIsland';

beforeEach(() => {
  // Reset viewport to default zoom (scale = 1) before each test.
  useViewportStore.getState().resetView();
});

test('renders Zoom Out, zoom display, Zoom In, and Fit buttons', () => {
  render(<ZoomIsland />);

  expect(screen.getByRole('button', { name: 'Zoom Out' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Zoom In' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Fit' })).toBeInTheDocument();
});

test('shows "100%" when viewport scale is 1', () => {
  render(<ZoomIsland />);
  expect(screen.getByText('100%')).toBeInTheDocument();
});

test('clicking Zoom In updates scale in the viewport store', () => {
  const initialScale = useViewportStore.getState().scale;

  render(<ZoomIsland />);
  fireEvent.click(screen.getByRole('button', { name: 'Zoom In' }));

  expect(useViewportStore.getState().scale).toBeGreaterThan(initialScale);
});

test('clicking Zoom Out updates scale in the viewport store', () => {
  const initialScale = useViewportStore.getState().scale;

  render(<ZoomIsland />);
  fireEvent.click(screen.getByRole('button', { name: 'Zoom Out' }));

  expect(useViewportStore.getState().scale).toBeLessThan(initialScale);
});

test('clicking Fit resets scale to 1', () => {
  // Set a non-default scale first.
  useViewportStore.getState().setScale(2);

  render(<ZoomIsland />);
  fireEvent.click(screen.getByRole('button', { name: 'Fit' }));

  expect(useViewportStore.getState().scale).toBe(1);
});
