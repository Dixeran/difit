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
      className="absolute right-[-4.5rem] top-1/2 z-20 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded border border-github-border bg-github-bg-primary text-github-text-muted hover:bg-github-bg-tertiary hover:text-github-accent"
    >
      <History size={12} />
    </button>
  );
}
