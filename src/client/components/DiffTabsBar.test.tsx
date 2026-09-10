import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { DiffTabState } from '../../types/diff';

import { DiffTabsBar } from './DiffTabsBar';

const createTab = (id: string, title: string): DiffTabState => ({
  id,
  title,
  selection: { baseCommitish: 'base', targetCommitish: id },
  ignoreWhitespace: true,
  data: null,
  loading: false,
  error: null,
  viewState: { scrollTop: 0, collapsedFiles: [], expandedState: {}, cursor: null },
  commitDetailsExpanded: false,
});

describe('DiffTabsBar', () => {
  it('activates and closes diff tabs', async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    const onClose = vi.fn();
    render(
      <DiffTabsBar
        tabs={[createTab('one', 'First'), createTab('two', 'Second')]}
        activeTabId="one"
        commitLookupAvailable={false}
        onActivate={onActivate}
        onClose={onClose}
        onOpenHash={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('tab', { name: /Second/ }));
    await user.click(screen.getByRole('button', { name: 'Close First' }));

    expect(onActivate).toHaveBeenCalledWith('two');
    expect(onClose).toHaveBeenCalledWith('one');
  });

  it('validates and opens a commit SHA', async () => {
    const user = userEvent.setup();
    const onOpenHash = vi.fn().mockResolvedValue(undefined);
    render(
      <DiffTabsBar
        tabs={[createTab('one', 'First')]}
        activeTabId="one"
        commitLookupAvailable
        onActivate={vi.fn()}
        onClose={vi.fn()}
        onOpenHash={onOpenHash}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Commit/ }));
    const input = screen.getByRole('textbox', { name: 'Commit SHA' });
    await user.type(input, 'HEAD');
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByText(/4–40 character/)).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'abc1234');
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(onOpenHash).toHaveBeenCalledWith('abc1234');
  });
});
