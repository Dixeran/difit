import { GitCommit, Plus, X } from 'lucide-react';
import { useState } from 'react';

import type { DiffTabState } from '../../types/diff';

interface DiffTabsBarProps {
  tabs: DiffTabState[];
  activeTabId: string;
  commitLookupAvailable: boolean;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onOpenHash: (hash: string) => Promise<void>;
}

export function DiffTabsBar({
  tabs,
  activeTabId,
  commitLookupAvailable,
  onActivate,
  onClose,
  onOpenHash,
}: DiffTabsBarProps) {
  const [showInput, setShowInput] = useState(false);
  const [hash, setHash] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const value = hash.trim();
    if (!/^[0-9a-f]{4,40}$/i.test(value)) {
      setError('Enter a 4–40 character commit SHA');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onOpenHash(value);
      setHash('');
      setShowInput(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to open commit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-10 items-stretch border-b border-github-border bg-github-bg-secondary">
      <div className="flex min-w-0 flex-1 overflow-x-auto" role="tablist" aria-label="Diff tabs">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`group flex max-w-64 shrink-0 items-center border-r border-github-border ${
                active
                  ? 'border-t-2 border-t-github-accent bg-github-bg-primary'
                  : 'border-t-2 border-t-transparent bg-github-bg-secondary'
              }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                title={tab.title}
                onClick={() => onActivate(tab.id)}
                className="flex min-w-0 items-center gap-2 px-3 py-2 text-sm text-github-text-primary"
              >
                <GitCommit size={14} className="shrink-0 text-github-text-muted" />
                <span className="truncate">{tab.title}</span>
              </button>
              {tabs.length > 1 && (
                <button
                  type="button"
                  aria-label={`Close ${tab.title}`}
                  onClick={() => onClose(tab.id)}
                  className="mr-1 rounded p-1 text-github-text-muted opacity-60 hover:bg-github-bg-tertiary hover:text-github-text-primary group-hover:opacity-100"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {commitLookupAvailable && (
        <div className="relative flex shrink-0 items-center border-l border-github-border px-2">
          {showInput ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <input
                autoFocus
                value={hash}
                onChange={(event) => {
                  setHash(event.target.value);
                  setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setShowInput(false);
                    setError(null);
                  }
                }}
                className="w-52 rounded border border-github-border bg-github-bg-primary px-2 py-1 text-xs font-mono text-github-text-primary outline-none focus:border-github-accent"
                placeholder="Commit SHA"
                aria-label="Commit SHA"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded bg-github-accent px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
              >
                {loading ? 'Opening…' : 'Open'}
              </button>
              {error && (
                <div className="absolute right-2 top-full z-50 mt-1 max-w-80 rounded border border-github-danger bg-github-bg-primary px-2 py-1 text-xs text-github-danger shadow-lg">
                  {error}
                </div>
              )}
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowInput(true)}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-github-text-secondary hover:bg-github-bg-tertiary hover:text-github-text-primary"
              title="Open commit by SHA"
            >
              <Plus size={14} />
              Commit
            </button>
          )}
        </div>
      )}
    </div>
  );
}
