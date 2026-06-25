import { render, screen } from '@testing-library/react';
import { Island } from './Island';

test('renders children inside an island container', () => {
  render(<Island aria-label="Tools"><button>Hi</button></Island>);
  expect(screen.getByRole('button', { name: 'Hi' })).toBeInTheDocument();
  expect(screen.getByLabelText('Tools')).toBeInTheDocument();
});
