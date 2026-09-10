import { History } from 'lucide-react';

interface HistoryButtonProps {
  onClick: () => void;
  label?: string;
}

export function HistoryButton({ onClick, label = 'Show line history' }: HistoryButtonProps) {
  return (
    <button
      type="button"
      data-history-button="true"
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center rounded p-1 text-github-text-muted hover:bg-github-bg-tertiary hover:text-github-accent"
    >
      <History size={13} />
    </button>
  );
}
