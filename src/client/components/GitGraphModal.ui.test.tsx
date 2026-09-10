import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HotkeysProvider } from 'react-hotkeys-hook';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GitGraphResponse } from '../../types/diff';

import { GitGraphModal } from './GitGraphModal';

const initialGraph: GitGraphResponse = {
  branches: [
    {
      ref: 'refs/heads/main',
      name: 'main',
      hash: 'main-tip',
      current: true,
      remote: false,
    },
    {
      ref: 'refs/heads/feature',
      name: 'feature',
      hash: 'feature-tip',
      current: false,
      remote: false,
    },
  ],
  selectedBranches: ['refs/heads/main'],
  commits: [
    {
      hash: 'main-tip',
      shortHash: 'main-ti',
      parents: [],
      message: 'main commit',
      authorName: 'Test Author',
      authorEmail: 'test@example.com',
      authoredAt: '2026-01-01T00:00:00Z',
      refs: ['main'],
    },
  ],
  hasMore: false,
  maxCount: 500,
};

const selectedGraph: GitGraphResponse = {
  ...initialGraph,
  selectedBranches: ['refs/heads/main', 'refs/heads/feature'],
  commits: [
    ...initialGraph.commits,
    {
      hash: 'feature-tip',
      shortHash: 'feature',
      parents: [],
      message: 'feature commit',
      authorName: 'Test Author',
      authorEmail: 'test@example.com',
      authoredAt: '2026-01-02T00:00:00Z',
      refs: ['feature'],
    },
  ],
};

const graphResponse = (body: GitGraphResponse) =>
  ({
    ok: true,
    json: async () => body,
  }) as Response;

describe('GitGraphModal branch selection', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset();
  });

  it('updates the graph automatically when a branch is selected', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(graphResponse(initialGraph))
      .mockResolvedValueOnce(graphResponse(selectedGraph));

    render(
      <HotkeysProvider initiallyActiveScopes={['navigation']}>
        <GitGraphModal isOpen onClose={vi.fn()} onCompare={vi.fn()} />
      </HotkeysProvider>,
    );

    const feature = await screen.findByRole('checkbox', { name: /feature/ });
    expect(screen.queryByRole('button', { name: /update graph/i })).not.toBeInTheDocument();

    fireEvent.click(feature);

    await waitFor(() =>
      expect(fetch).toHaveBeenLastCalledWith(
        '/api/git-graph?branch=refs%2Fheads%2Fmain&branch=refs%2Fheads%2Ffeature',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('feature commit')).toBeInTheDocument();
  });
});
