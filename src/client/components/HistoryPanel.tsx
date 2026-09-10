import { Copy, ExternalLink, History, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  DiffHistoryTarget,
  FileHistoryResponse,
  HistoryCommitEntry,
  LineHistoryResponse,
} from '../../types/diff';
import { copyTextToClipboard } from '../utils/clipboard';

export type HistoryTarget = DiffHistoryTarget;

interface HistoryPanelProps {
  target: HistoryTarget;
  mobile: boolean;
  onClose: () => void;
  onOpenCommit: (entry: HistoryCommitEntry) => void;
}

const getHistoryUrl = (target: Exclude<HistoryTarget, { kind: 'unavailable' }>, offset: number) => {
  const params = new URLSearchParams({
    path: target.filePath,
    ref: target.ref,
    offset: String(offset),
  });
  if (target.kind === 'line') {
    params.set('startLine', String(target.startLine));
    params.set('endLine', String(target.endLine));
  }
  return `/api/${target.kind}-history?${params}`;
};

export function HistoryPanel({ target, mobile, onClose, onOpenCommit }: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryCommitEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | undefined>();
  const [renameBoundary, setRenameBoundary] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestGenerationRef = useRef(0);

  const load = useCallback(
    async (offset: number, append: boolean, signal?: AbortSignal) => {
      if (target.kind === 'unavailable') return;
      const requestGeneration = requestGenerationRef.current + 1;
      requestGenerationRef.current = requestGeneration;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(getHistoryUrl(target, offset), { signal });
        const payload = (await response.json().catch(() => null)) as
          | (FileHistoryResponse & { error?: string })
          | null;
        if (!response.ok || !payload) {
          throw new Error(payload?.error ?? 'Failed to load history');
        }
        if (requestGenerationRef.current !== requestGeneration) return;
        setEntries((previous) => (append ? [...previous, ...payload.entries] : payload.entries));
        setHasMore(payload.hasMore);
        setNextOffset(payload.nextOffset);
        setRenameBoundary((payload as LineHistoryResponse).renameBoundary ?? false);
      } catch (loadError) {
        if (
          requestGenerationRef.current === requestGeneration &&
          (loadError as { name?: string }).name !== 'AbortError'
        ) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load history');
        }
      } finally {
        if (requestGenerationRef.current === requestGeneration) {
          setLoading(false);
        }
      }
    },
    [target],
  );

  useEffect(() => {
    requestGenerationRef.current += 1;
    setEntries([]);
    setHasMore(false);
    setNextOffset(undefined);
    setRenameBoundary(false);
    if (target.kind === 'unavailable') return;
    const controller = new AbortController();
    void load(0, false, controller.signal);
    return () => {
      requestGenerationRef.current += 1;
      controller.abort();
    };
  }, [load, target]);

  return (
    <aside
      className={`${
        mobile ? 'fixed inset-0 z-50' : 'relative h-full shrink-0 border-l border-github-border'
      } flex flex-col bg-github-bg-primary shadow-xl`}
      style={mobile ? undefined : { width: 'clamp(320px, 32vw, 520px)' }}
      aria-label="Git history"
    >
      <header className="flex items-center gap-2 border-b border-github-border px-3 py-3">
        <History size={16} className="text-github-accent" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-github-text-primary">
            {target.kind === 'line' ? 'Line history' : 'File history'}
          </div>
          <div className="truncate text-xs font-mono text-github-text-muted">
            {target.filePath}
            {target.kind === 'line' &&
              `:${target.startLine}${target.endLine !== target.startLine ? `–${target.endLine}` : ''}`}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close history"
          className="rounded p-1.5 text-github-text-muted hover:bg-github-bg-tertiary hover:text-github-text-primary"
        >
          <X size={16} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        {target.kind === 'unavailable' ? (
          <div className="rounded border border-github-border bg-github-bg-secondary p-3 text-sm text-github-text-secondary">
            {target.reason}
          </div>
        ) : (
          <>
            {target.kind === 'line' && (
              <p className="mb-3 text-xs text-github-text-muted">
                Line history is exact for the selected committed version and may stop at a file
                rename.
              </p>
            )}
            {error && <div className="mb-3 text-sm text-github-danger">{error}</div>}
            {!loading && !error && entries.length === 0 && (
              <div className="text-sm text-github-text-muted">No committed history found.</div>
            )}
            <div className="space-y-3">
              {entries.map((entry) => (
                <article
                  key={entry.hash}
                  className="rounded border border-github-border bg-github-bg-secondary"
                >
                  <div className="p-3">
                    <button
                      type="button"
                      onClick={() => onOpenCommit(entry)}
                      className="block w-full text-left text-sm font-medium text-github-text-primary hover:text-github-accent"
                    >
                      {entry.subject}
                    </button>
                    <div className="mt-1 flex items-center gap-2 text-xs text-github-text-muted">
                      <code>{entry.shortHash}</code>
                      <span className="truncate">{entry.authorName}</span>
                      <span className="ml-auto shrink-0">
                        {new Date(entry.authoredAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      {entry.additions !== undefined && (
                        <span className="text-github-accent">+{entry.additions}</span>
                      )}
                      {entry.deletions !== undefined && (
                        <span className="text-github-danger">-{entry.deletions}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => void copyTextToClipboard(entry.hash)}
                        className="ml-auto rounded p-1 text-github-text-muted hover:text-github-text-primary"
                        title="Copy commit hash"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenCommit(entry)}
                        className="rounded p-1 text-github-text-muted hover:text-github-accent"
                        title="Open commit diff in new tab"
                      >
                        <ExternalLink size={13} />
                      </button>
                    </div>
                  </div>
                  {entry.patch && entry.patch.length > 0 && (
                    <div className="max-h-64 overflow-auto border-t border-github-border font-mono text-xs">
                      {entry.patch.map((chunk, chunkIndex) => (
                        <div key={`${entry.hash}-${chunkIndex}`}>
                          <div className="bg-diff-hunk-bg px-2 py-1 text-github-text-muted">
                            {chunk.header}
                          </div>
                          {chunk.lines.map((line, lineIndex) => (
                            <pre
                              key={lineIndex}
                              className={`px-2 whitespace-pre ${
                                line.type === 'add'
                                  ? 'bg-diff-addition-bg'
                                  : line.type === 'delete'
                                    ? 'bg-diff-deletion-bg'
                                    : ''
                              }`}
                            >
                              {line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '}
                              {line.content}
                            </pre>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
            {renameBoundary && (
              <div className="mt-3 text-xs text-github-warning">
                History reached a rename boundary.
              </div>
            )}
            {hasMore && nextOffset !== undefined && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void load(nextOffset, true)}
                className="mt-3 w-full rounded border border-github-border px-3 py-2 text-sm text-github-text-secondary hover:bg-github-bg-tertiary disabled:opacity-60"
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            )}
            {loading && entries.length === 0 && (
              <div className="text-sm text-github-text-muted">Loading history…</div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
