import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HistoryButton } from './HistoryButton';

describe('HistoryButton', () => {
  it('is absolutely positioned so appearing on hover does not change the row height', () => {
    render(<HistoryButton onClick={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Show line history' })).toHaveClass(
      'absolute',
      'top-1/2',
      'h-5',
      'w-5',
      'right-[-4.5rem]',
    );
  });
});
