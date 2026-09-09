import {
  ArrowRight,
  Check,
  Copy,
  FileDiff,
  GitBranch,
  GitCompareArrows,
  LoaderCircle,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHotkeysContext } from 'react-hotkeys-hook';

import { type DiffSelection, type GitGraphCommit, type GitGraphResponse } from '../../types/diff';
import { createDiffSelection, EMPTY_TREE_COMMITISH } from '../../utils/diffSelection';
import { copyTextToClipboard } from '../utils/clipboard';

const GRAPH_COLORS = ['#58a6ff', '#f778ba', '#a371f7', '#3fb950', '#d29922', '#f85149'];
const LANE_WIDTH = 18;
const ROW_HEIGHT = 54;
const ROW_CENTER = ROW_HEIGHT / 2;

interface GraphSegment {
  from: number;
  to: number;
  color: number;
}

interface GraphLane {
  hash: string;
  color: number;
}

interface IncomingSegment {
  column: number;
  color: number;
}

export interface GitGraphRow {
  commit: GitGraphCommit;
  column: number;
  color: number;
  laneCount: number;
  hasIncomingLine: boolean;
  incoming: IncomingSegment[];
  outgoing: GraphSegment[];
}

export function buildGitGraphRows(commits: GitGraphCommit[]): GitGraphRow[] {
  const visibleHashes = new Set(commits.map((commit) => commit.hash));
  const lanes: GraphLane[] = [];
  let nextColor = 0;

  return commits.map((commit) => {
    let column = lanes.findIndex((lane) => lane.hash === commit.hash);
    const hasIncomingLine = column >= 0;
    if (column < 0) {
      lanes.push({ hash: commit.hash, color: nextColor++ });
      column = lanes.length - 1;
    }

    const before = lanes.map((lane) => ({ ...lane }));
    const currentLane = before[column];
    if (!currentLane) throw new Error(`Missing graph lane for commit ${commit.hash}`);
    const parents = commit.parents.filter((parent) => visibleHashes.has(parent));
    const after = before.filter((lane) => lane.hash !== commit.hash);

    parents.forEach((parent, parentIndex) => {
      if (after.some((lane) => lane.hash === parent)) return;
      const insertAt = Math.min(column + parentIndex, after.length);
      after.splice(insertAt, 0, {
        hash: parent,
        color: parentIndex === 0 ? currentLane.color : nextColor++,
      });
    });

    const outgoing: GraphSegment[] = [];
    before.forEach((lane, from) => {
      if (lane.hash === commit.hash) return;
      const to = after.findIndex((nextLane) => nextLane.hash === lane.hash);
      if (to >= 0) outgoing.push({ from, to, color: lane.color });
    });
    parents.forEach((parent, parentIndex) => {
      const to = after.findIndex((lane) => lane.hash === parent);
      if (to >= 0) {
        const parentLane = after[to];
        if (!parentLane) return;
        outgoing.push({
          from: column,
          to,
          color: parentIndex === 0 ? currentLane.color : parentLane.color,
        });
      }
    });

    lanes.splice(0, lanes.length, ...after);
    return {
      commit,
      column,
      color: currentLane.color,
      laneCount: Math.max(before.length, after.length, 1),
      hasIncomingLine,
      incoming: before
        .map((lane, index) => ({ column: index, color: lane.color }))
        .filter(({ column: incomingColumn }) => incomingColumn !== column || hasIncomingLine),
      outgoing,
    };
  });
}

export function createCommitDiffSelection(commit: GitGraphCommit): DiffSelection {
  return createDiffSelection(commit.parents[0] ?? EMPTY_TREE_COMMITISH, commit.hash);
}

interface GitGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompare: (selection: DiffSelection) => void;
}

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const sameStringSet = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value) => right.includes(value));

export function GitGraphModal({ isOpen, onClose, onCompare }: GitGraphModalProps) {
  const [data, setData] = useState<GitGraphResponse | null>(null);
  const [pendingBranches, setPendingBranches] = useState<string[]>([]);
  const [selectedCommits, setSelectedCommits] = useState<GitGraphCommit[]>([]);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [branchQuery, setBranchQuery] = useState('');
  const [commitQuery, setCommitQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const { enableScope, disableScope } = useHotkeysContext();

  const loadGraph = useCallback(async (selectedBranches?: string[]) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (selectedBranches) {
        if (selectedBranches.length === 0) params.append('branch', '');
        selectedBranches.forEach((branch) => params.append('branch', branch));
      }
      const query = params.size > 0 ? `?${params.toString()}` : '';
      const response = await fetch(`/api/git-graph${query}`, { signal: controller.signal });
      if (!response.ok) throw new Error('Failed to load the Git graph');
      const nextData = (await response.json()) as GitGraphResponse;
      setData(nextData);
      setPendingBranches(nextData.selectedBranches);
      setSelectedCommits((current) =>
        current.filter((selected) =>
          nextData.commits.some((commit) => commit.hash === selected.hash),
        ),
      );
    } catch (loadError) {
      if ((loadError as { name?: string }).name !== 'AbortError') {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load the Git graph');
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedCommits([]);
    setBranchQuery('');
    setCommitQuery('');
    void loadGraph();
    disableScope('navigation');

    return () => {
      abortControllerRef.current?.abort();
      enableScope('navigation');
    };
  }, [disableScope, enableScope, isOpen, loadGraph]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(
    () => () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    },
    [],
  );

  const filteredBranches = useMemo(() => {
    const query = branchQuery.trim().toLowerCase();
    if (!data || !query) return data?.branches ?? [];
    return data.branches.filter((branch) => branch.name.toLowerCase().includes(query));
  }, [branchQuery, data]);

  const filteredCommits = useMemo(() => {
    const query = commitQuery.trim().toLowerCase();
    if (!data || !query) return data?.commits ?? [];
    return data.commits.filter((commit) =>
      [commit.hash, commit.message, commit.authorName, ...commit.refs].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [commitQuery, data]);

  const graphRows = useMemo(() => buildGitGraphRows(filteredCommits), [filteredCommits]);
  const graphWidth = Math.max(54, ...graphRows.map((row) => row.laneCount * LANE_WIDTH + 18));
  const branchSelectionChanged = data
    ? !sameStringSet(pendingBranches, data.selectedBranches)
    : false;

  if (!isOpen) return null;

  const toggleBranch = (ref: string) => {
    setPendingBranches((current) =>
      current.includes(ref) ? current.filter((value) => value !== ref) : [...current, ref],
    );
  };

  const toggleCommit = (commit: GitGraphCommit) => {
    setSelectedCommits((current) => {
      if (current.some((selected) => selected.hash === commit.hash)) {
        return current.filter((selected) => selected.hash !== commit.hash);
      }
      return current.length < 2 ? [...current, commit] : [commit];
    });
  };

  const handleCompare = () => {
    const [base, target] = selectedCommits;
    if (!base || !target) return;
    onCompare(createDiffSelection(base.hash, target.hash));
    onClose();
  };

  const handleCopyHash = async (event: React.MouseEvent, hash: string) => {
    event.stopPropagation();
    try {
      await copyTextToClipboard(hash);
      setCopiedHash(hash);
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
      copyResetTimeoutRef.current = window.setTimeout(() => setCopiedHash(null), 1_500);
    } catch (copyError) {
      console.error('Failed to copy commit hash:', copyError);
    }
  };

  const handleViewCommitDiff = (event: React.MouseEvent, commit: GitGraphCommit) => {
    event.stopPropagation();
    onCompare(createCommitDiffSelection(commit));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close Git graph"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="relative flex h-full max-h-[900px] w-full max-w-[1500px] flex-col overflow-hidden rounded-lg border border-github-border bg-github-bg-primary shadow-2xl">
        <div className="flex items-center justify-between border-b border-github-border bg-github-bg-secondary px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <GitBranch size={18} className="shrink-0 text-github-text-secondary" />
            <div>
              <h2 className="font-semibold text-github-text-primary">Git Graph</h2>
              <p className="text-xs text-github-text-muted">
                Select a base commit, then a target commit to compare.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-github-text-secondary hover:bg-github-bg-tertiary hover:text-github-text-primary"
            aria-label="Close Git graph"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-72 shrink-0 flex-col border-r border-github-border bg-github-bg-secondary sm:flex">
            <div className="border-b border-github-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-github-text-secondary">
                  Branches
                </span>
                <span className="text-xs text-github-text-muted">
                  {pendingBranches.length} selected
                </span>
              </div>
              <label className="flex items-center gap-2 rounded border border-github-border bg-github-bg-primary px-2 py-1.5 focus-within:border-blue-500">
                <Search size={13} className="text-github-text-muted" />
                <input
                  value={branchQuery}
                  onChange={(event) => setBranchQuery(event.target.value)}
                  placeholder="Filter branches..."
                  className="min-w-0 flex-1 bg-transparent text-xs text-github-text-primary outline-none placeholder:text-github-text-muted"
                />
              </label>
              <div className="mt-2 flex gap-3 text-xs">
                <button
                  type="button"
                  className="text-blue-400 hover:underline"
                  onClick={() =>
                    setPendingBranches((current) => [
                      ...new Set([...current, ...filteredBranches.map((branch) => branch.ref)]),
                    ])
                  }
                >
                  Select visible
                </button>
                <button
                  type="button"
                  className="text-blue-400 hover:underline"
                  onClick={() =>
                    setPendingBranches((current) =>
                      current.filter(
                        (ref) => !filteredBranches.some((branch) => branch.ref === ref),
                      ),
                    )
                  }
                >
                  Clear visible
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {filteredBranches.map((branch) => {
                const checked = pendingBranches.includes(branch.ref);
                return (
                  <label
                    key={branch.ref}
                    className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-xs hover:bg-github-bg-tertiary"
                  >
                    <span
                      className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
                        checked
                          ? 'border-blue-500 bg-blue-600 text-white'
                          : 'border-github-border bg-github-bg-primary'
                      }`}
                    >
                      {checked && <Check size={11} />}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleBranch(branch.ref)}
                      className="sr-only"
                    />
                    <span
                      className="min-w-0 flex-1 break-all leading-5 text-github-text-primary"
                      title={branch.name}
                    >
                      {branch.name}
                    </span>
                    {branch.current && (
                      <span className="mt-0.5 shrink-0 rounded bg-github-accent/20 px-1 text-[10px] text-green-400">
                        current
                      </span>
                    )}
                    {branch.remote && (
                      <span className="mt-0.5 shrink-0 text-[10px] text-github-text-muted">
                        remote
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            <div className="border-t border-github-border p-3">
              <button
                type="button"
                disabled={!branchSelectionChanged || loading}
                onClick={() => void loadGraph(pendingBranches)}
                className="flex w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <LoaderCircle size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
                Update graph
              </button>
            </div>
          </aside>

          <main className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-3 border-b border-github-border bg-github-bg-secondary px-3 py-2">
              <label className="flex min-w-0 max-w-md flex-1 items-center gap-2 rounded border border-github-border bg-github-bg-primary px-2 py-1.5 focus-within:border-blue-500">
                <Search size={13} className="text-github-text-muted" />
                <input
                  value={commitQuery}
                  onChange={(event) => setCommitQuery(event.target.value)}
                  placeholder="Search commits, authors, or refs..."
                  className="min-w-0 flex-1 bg-transparent text-xs text-github-text-primary outline-none placeholder:text-github-text-muted"
                />
              </label>
              <span className="hidden text-xs text-github-text-muted md:inline">
                {data?.commits.length ?? 0} commits
                {data?.hasMore ? ` (limited to ${data.maxCount})` : ''}
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {loading && !data && (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-github-text-secondary">
                  <LoaderCircle size={17} className="animate-spin" /> Loading graph...
                </div>
              )}
              {error && (
                <div className="m-4 rounded border border-red-900 bg-red-950/30 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              {!loading && !error && data?.commits.length === 0 && (
                <div className="flex h-full items-center justify-center text-sm text-github-text-muted">
                  Select at least one branch to show its commits.
                </div>
              )}
              {graphRows.map((row) => {
                const selectionIndex = selectedCommits.findIndex(
                  (commit) => commit.hash === row.commit.hash,
                );
                const selected = selectionIndex >= 0;
                return (
                  <div
                    role="button"
                    tabIndex={0}
                    key={row.commit.hash}
                    onClick={() => toggleCommit(row.commit)}
                    onKeyDown={(event) => {
                      if (event.currentTarget !== event.target) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleCommit(row.commit);
                      }
                    }}
                    className={`flex w-full min-w-[720px] items-stretch border-b border-github-border/60 text-left transition-colors hover:bg-github-bg-secondary ${
                      selected ? 'bg-blue-950/30' : ''
                    }`}
                    style={{ height: ROW_HEIGHT }}
                    aria-pressed={selected}
                  >
                    <svg
                      width={graphWidth}
                      height={ROW_HEIGHT}
                      className="shrink-0"
                      aria-hidden="true"
                    >
                      {row.incoming.map((segment) => (
                        <line
                          key={`in-${segment.column}`}
                          x1={segment.column * LANE_WIDTH + 14}
                          y1={0}
                          x2={segment.column * LANE_WIDTH + 14}
                          y2={ROW_CENTER}
                          stroke={GRAPH_COLORS[segment.color % GRAPH_COLORS.length]}
                          strokeWidth="2"
                        />
                      ))}
                      {row.outgoing.map((segment, index) => {
                        const fromX = segment.from * LANE_WIDTH + 14;
                        const toX = segment.to * LANE_WIDTH + 14;
                        return (
                          <path
                            key={`out-${index}`}
                            d={`M ${fromX} ${ROW_CENTER} C ${fromX} ${ROW_CENTER + 12}, ${toX} ${ROW_HEIGHT - 12}, ${toX} ${ROW_HEIGHT}`}
                            fill="none"
                            stroke={GRAPH_COLORS[segment.color % GRAPH_COLORS.length]}
                            strokeWidth="2"
                          />
                        );
                      })}
                      <circle
                        cx={row.column * LANE_WIDTH + 14}
                        cy={ROW_CENTER}
                        r={selected ? 6 : 5}
                        fill={selected ? '#0d1117' : GRAPH_COLORS[row.color % GRAPH_COLORS.length]}
                        stroke={
                          selected ? '#f0f6fc' : GRAPH_COLORS[row.color % GRAPH_COLORS.length]
                        }
                        strokeWidth={selected ? 3 : 2}
                      />
                    </svg>
                    <div className="flex min-w-0 flex-1 items-center gap-3 pr-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm text-github-text-primary">
                            {row.commit.message || '(no commit message)'}
                          </span>
                          {row.commit.refs.map((ref) => (
                            <span
                              key={ref}
                              className="shrink-0 rounded-full border border-blue-800 bg-blue-950/50 px-2 py-0.5 text-[10px] text-blue-300"
                            >
                              {ref}
                            </span>
                          ))}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-github-text-muted">
                          <span className="truncate">{row.commit.authorName}</span>
                          <span>·</span>
                          <time dateTime={row.commit.authoredAt}>
                            {formatDate(row.commit.authoredAt)}
                          </time>
                        </div>
                      </div>
                      {selected && (
                        <span className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                          {selectionIndex === 0 ? 'Base' : 'Target'}
                        </span>
                      )}
                      <code className="w-16 shrink-0 text-xs text-github-text-secondary">
                        {row.commit.shortHash}
                      </code>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={(event) => void handleCopyHash(event, row.commit.hash)}
                          className="rounded p-1.5 text-github-text-muted hover:bg-github-bg-tertiary hover:text-github-text-primary"
                          title="Copy full commit hash"
                          aria-label={`Copy commit hash ${row.commit.shortHash}`}
                        >
                          {copiedHash === row.commit.hash ? (
                            <Check size={14} className="text-green-400" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => handleViewCommitDiff(event, row.commit)}
                          className="rounded p-1.5 text-github-text-muted hover:bg-github-bg-tertiary hover:text-github-text-primary"
                          title="View this commit's diff"
                          aria-label={`View diff for commit ${row.commit.shortHash}`}
                        >
                          <FileDiff size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-github-border bg-github-bg-secondary px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 text-xs text-github-text-secondary">
            <GitCompareArrows size={15} className="shrink-0" />
            {selectedCommits.length === 0 && <span>Choose the base commit.</span>}
            {selectedCommits.length === 1 && (
              <>
                <code className="text-github-text-primary">{selectedCommits[0]?.shortHash}</code>
                <ArrowRight size={13} />
                <span>Choose the target commit.</span>
              </>
            )}
            {selectedCommits.length === 2 && (
              <>
                <code className="text-github-text-primary">{selectedCommits[0]?.shortHash}</code>
                <ArrowRight size={13} />
                <code className="text-github-text-primary">{selectedCommits[1]?.shortHash}</code>
                <button
                  type="button"
                  className="ml-1 text-blue-400 hover:underline"
                  onClick={() =>
                    setSelectedCommits((current) =>
                      current.length === 2 ? [...current].reverse() : current,
                    )
                  }
                >
                  Reverse
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-github-border px-3 py-1.5 text-xs font-medium text-github-text-secondary hover:text-github-text-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedCommits.length !== 2}
              onClick={handleCompare}
              className="flex items-center gap-2 rounded bg-github-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-github-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <GitCompareArrows size={14} /> Compare in difit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
