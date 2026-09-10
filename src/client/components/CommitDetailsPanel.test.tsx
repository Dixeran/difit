import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { GitCommitDetails } from '../../types/diff';

import { CommitDetailsPanel } from './CommitDetailsPanel';

const details: GitCommitDetails = {
  hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  shortHash: 'aaaaaaa',
  parents: ['bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
  subject: 'Add history workspace',
  body: 'Detailed commit body',
  refs: ['HEAD -> main'],
  authorName: 'Ada',
  authorEmail: 'ada@example.com',
  authoredAt: '2026-01-02T00:00:00Z',
  committerName: 'Grace',
  committerEmail: 'grace@example.com',
  committedAt: '2026-01-02T00:01:00Z',
  filesChanged: 3,
  additions: 12,
  deletions: 4,
  selection: { baseCommitish: 'bbbbbbb', targetCommitish: 'aaaaaaa' },
};

describe('CommitDetailsPanel', () => {
  it('keeps extended metadata folded until expanded', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = render(
      <CommitDetailsPanel details={details} expanded={false} onToggle={onToggle} />,
    );

    expect(screen.queryByText('Detailed commit body')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { expanded: false }));
    expect(onToggle).toHaveBeenCalledOnce();

    rerender(<CommitDetailsPanel details={details} expanded onToggle={onToggle} />);
    expect(screen.getByText('Detailed commit body')).toBeInTheDocument();
    expect(screen.getByText(/3 files changed/)).toBeInTheDocument();
  });
});
