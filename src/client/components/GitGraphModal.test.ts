import { describe, expect, it } from 'vitest';

import { type GitGraphCommit } from '../../types/diff';

import { buildGitGraphRows, createCommitDiffSelection } from './GitGraphModal';

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

  it('keeps a branch color when another lane merges and columns shift', () => {
    const rows = buildGitGraphRows([
      commit('merge', ['main-parent', 'feature-tip']),
      commit('other-tip', ['other-parent']),
      commit('feature-tip', ['main-parent']),
      commit('other-parent', ['other-root']),
      commit('main-parent', ['root']),
      commit('other-root'),
      commit('root'),
    ]);

    expect(rows[1]?.column).toBe(2);
    expect(rows[3]?.column).toBe(1);
    expect(rows[3]?.color).toBe(rows[1]?.color);
    expect(rows[3]?.incoming).toContainEqual({ column: 1, color: rows[1]?.color });
  });
});

describe('createCommitDiffSelection', () => {
  it('compares a commit with its first parent', () => {
    expect(createCommitDiffSelection(commit('merge', ['first-parent', 'second-parent']))).toEqual({
      baseCommitish: 'first-parent',
      targetCommitish: 'merge',
    });
  });

  it('compares a root commit with the empty tree', () => {
    expect(createCommitDiffSelection(commit('root'))).toEqual({
      baseCommitish: 'empty-tree',
      targetCommitish: 'root',
    });
  });
});
