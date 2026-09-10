import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HistoryButton } from './HistoryButton';
import { LineActions } from './LineActions';

describe('HistoryButton', () => {
  it('uses the fixed-height line action toolbar without affecting row layout', () => {
    render(
      <LineActions>
        <HistoryButton onClick={vi.fn()} />
      </LineActions>,
    );

    expect(screen.getByRole('button', { name: 'Show line history' })).toHaveClass('h-5', 'w-5');
    expect(screen.getByRole('button', { name: 'Show line history' })).not.toHaveClass('absolute');
    expect(document.querySelector('[data-line-actions="true"]')).toHaveClass(
      'absolute',
      'left-full',
      'top-0',
      'h-5',
      'opacity-40',
      'hover:opacity-100',
      'focus-within:opacity-100',
    );
  });
});
