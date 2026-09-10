import type { ReactNode } from 'react';

interface LineActionsProps {
  children: ReactNode;
}

export function LineActions({ children }: LineActionsProps) {
  return (
    <div
      data-line-actions="true"
      className="absolute right-0 top-0 z-20 flex h-5 items-center gap-0.5 rounded bg-github-bg-secondary"
    >
      {children}
    </div>
  );
}
