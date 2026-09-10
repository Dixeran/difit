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
      className="absolute -right-18 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-github-text-muted transition-all duration-150 hover:scale-110 hover:bg-github-bg-tertiary hover:text-github-accent"
    >
      <History size={13} />
    </button>
  );
}
