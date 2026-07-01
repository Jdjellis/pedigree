/**
 * RTL tests for DocumentDetails — a plain props-driven popover (no store), so it
 * renders directly with stub `onChange`/`onClose` handlers.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { PedigreeMetadata } from '../../types/pedigree';
import { DocumentDetails } from './DocumentDetails';

function makeMetadata(overrides: Partial<PedigreeMetadata> = {}): PedigreeMetadata {
  return {
    id: 'doc-1',
    title: 'Untitled',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-06-15T00:00:00.000Z',
    version: '1',
    ...overrides,
  };
}

describe('DocumentDetails', () => {
  it('populates fields from metadata and shows the date read-only', () => {
    render(
      <DocumentDetails
        metadata={makeMetadata({
          author: 'Dr. Jane Smith',
          institution: 'RMH',
          referenceCondition: 'HBOC',
        })}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue('Dr. Jane Smith')).toBeInTheDocument();
    expect(screen.getByDisplayValue('RMH')).toBeInTheDocument();
    expect(screen.getByDisplayValue('HBOC')).toBeInTheDocument();
    expect(
      screen.getByText(new Date('2024-06-15T00:00:00.000Z').toLocaleDateString()),
    ).toBeInTheDocument();
  });

  it('commits author, institution, and reference-condition edits via onChange', () => {
    const onChange = vi.fn();
    render(
      <DocumentDetails metadata={makeMetadata()} onChange={onChange} onClose={vi.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText('e.g. Dr. Jane Smith'), {
      target: { value: 'A. Author' },
    });
    expect(onChange).toHaveBeenCalledWith({ author: 'A. Author' });

    fireEvent.change(screen.getByPlaceholderText('e.g. Royal Melbourne Hospital'), {
      target: { value: 'Hospital X' },
    });
    expect(onChange).toHaveBeenCalledWith({ institution: 'Hospital X' });

    fireEvent.change(screen.getByPlaceholderText('e.g. Hereditary breast cancer'), {
      target: { value: 'Cystic fibrosis' },
    });
    expect(onChange).toHaveBeenCalledWith({ referenceCondition: 'Cystic fibrosis' });
  });

  it('closes via the Done button', () => {
    const onClose = vi.fn();
    render(
      <DocumentDetails metadata={makeMetadata()} onChange={vi.fn()} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <DocumentDetails metadata={makeMetadata()} onChange={vi.fn()} onClose={onClose} />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on an outside pointer down but not on an inside one', () => {
    const onClose = vi.fn();
    render(
      <DocumentDetails metadata={makeMetadata()} onChange={vi.fn()} onClose={onClose} />,
    );

    // Inside click does not close.
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();

    // Outside click closes.
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
