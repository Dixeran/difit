import { ChevronDown, ChevronRight, Copy, GitCommit } from 'lucide-react';

import type { GitCommitDetails } from '../../types/diff';
import { copyTextToClipboard } from '../utils/clipboard';

interface CommitDetailsPanelProps {
  details: GitCommitDetails;
  expanded: boolean;
  onToggle: () => void;
}

export function CommitDetailsPanel({ details, expanded, onToggle }: CommitDetailsPanelProps) {
  return (
    <section className="border-b border-github-border bg-github-bg-primary">
      <div className="flex min-w-0 items-center gap-2 px-4 py-2 text-sm">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="rounded p-1 text-github-text-muted hover:bg-github-bg-tertiary hover:text-github-text-primary"
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <GitCommit size={15} className="shrink-0 text-github-accent" />
        <strong className="truncate text-github-text-primary">{details.subject}</strong>
        <code className="shrink-0 text-xs text-github-text-muted">{details.shortHash}</code>
        <span className="hidden truncate text-xs text-github-text-secondary sm:inline">
          {details.authorName} · {new Date(details.authoredAt).toLocaleString()}
        </span>
        <span className="ml-auto flex shrink-0 gap-2 text-xs">
          <span className="text-github-accent">+{details.additions}</span>
          <span className="text-github-danger">-{details.deletions}</span>
        </span>
        <button
          type="button"
          title="Copy commit hash"
          onClick={() => void copyTextToClipboard(details.hash)}
          className="rounded p-1 text-github-text-muted hover:bg-github-bg-tertiary hover:text-github-text-primary"
        >
          <Copy size={14} />
        </button>
      </div>
      {expanded && (
        <div className="grid gap-3 border-t border-github-border px-11 py-3 text-xs text-github-text-secondary md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            {details.body && (
              <pre className="mb-3 whitespace-pre-wrap font-sans text-sm text-github-text-primary">
                {details.body}
              </pre>
            )}
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
              <dt>Author</dt>
              <dd>
                {details.authorName} &lt;{details.authorEmail}&gt;
              </dd>
              <dt>Committer</dt>
              <dd>
                {details.committerName} &lt;{details.committerEmail}&gt;
              </dd>
              <dt>Parents</dt>
              <dd className="break-all font-mono">
                {details.parents.length ? details.parents.join(' ') : 'Root commit'}
              </dd>
              {details.refs.length > 0 && (
                <>
                  <dt>Refs</dt>
                  <dd className="break-words">{details.refs.join(', ')}</dd>
                </>
              )}
            </dl>
          </div>
          <div className="whitespace-nowrap text-right">
            {details.filesChanged} files changed
            <br />
            Authored {new Date(details.authoredAt).toLocaleString()}
            <br />
            Committed {new Date(details.committedAt).toLocaleString()}
          </div>
        </div>
      )}
    </section>
  );
}
