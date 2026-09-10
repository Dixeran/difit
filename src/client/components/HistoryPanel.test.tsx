import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HistoryPanel } from './HistoryPanel';

afterEach(() => vi.unstubAllGlobals());

describe('HistoryPanel', () => {
  it('loads file history and opens a commit entry', async () => {
    const user = userEvent.setup();
    const entry = {
      hash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      shortHash: 'aaaaaaa',
      parents: [],
      subject: 'Update app',
      authorName: 'Ada',
      authorEmail: 'ada@example.com',
      authoredAt: '2026-01-02T00:00:00Z',
      path: 'src/app.ts',
      additions: 2,
      deletions: 1,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ entries: [entry], hasMore: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const onOpenCommit = vi.fn();
    render(
      <HistoryPanel
        target={{ kind: 'file', filePath: 'src/app.ts', ref: 'HEAD' }}
        mobile={false}
        onClose={vi.fn()}
        onOpenCommit={onOpenCommit}
      />,
    );

    await waitFor(() => expect(screen.getByText('Update app')).toBeInTheDocument());
    await user.click(screen.getByText('Update app'));

    expect(fetch).toHaveBeenCalledWith(
      '/api/file-history?path=src%2Fapp.ts&ref=HEAD&offset=0',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(onOpenCommit).toHaveBeenCalledWith(entry);
  });

  it('shows an exact no-history reason without fetching', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <HistoryPanel
        target={{
          kind: 'unavailable',
          filePath: 'src/new.ts',
          reason: 'This line has not been committed yet.',
        }}
        mobile={false}
        onClose={vi.fn()}
        onOpenCommit={vi.fn()}
      />,
    );

    expect(screen.getByText('This line has not been committed yet.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
