import { describe, expect, it } from 'vitest';

import { type GitGraphCommit } from '../../types/diff';

import { buildGitGraphRows } from './GitGraphModal';

const commit = (hash: string, parents: string[] = []): GitGraphCommit => ({
  hash,
  shortHash: hash.slice(0, 7),
  parents,
  message: hash,
  authorName: 'Test Author',
  authorEmail: 'test@example.com',
  authoredAt: '2026-01-01T00:00:00Z',
  refs: [],
});

describe('buildGitGraphRows', () => {
  it('creates and rejoins lanes for a merge commit', () => {
    const rows = buildGitGraphRows([
      commit('merge', ['left', 'right']),
      commit('left', ['root']),
      commit('right', ['root']),
      commit('root'),
    ]);

    expect(rows.map((row) => row.column)).toEqual([0, 0, 1, 0]);
    expect(rows[0]?.outgoing.map(({ from, to }) => [from, to])).toEqual([
      [0, 0],
      [0, 1],
    ]);
    expect(rows[2]?.outgoing).toEqual(
      expect.arrayContaining([expect.objectContaining({ from: 1, to: 0 })]),
    );
  });

  it('starts a separate lane for an unrelated selected branch', () => {
    const rows = buildGitGraphRows([
      commit('main-tip', ['main-root']),
      commit('other-tip', ['other-root']),
      commit('main-root'),
      commit('other-root'),
    ]);

    expect(rows[0]?.hasIncomingLine).toBe(false);
    expect(rows[1]?.column).toBe(1);
    expect(rows[1]?.hasIncomingLine).toBe(false);
  });
});
