import type { ReactNode } from 'react';

interface LineActionsProps {
  children: ReactNode;
}

export function LineActions({ children }: LineActionsProps) {
  return (
    <div
      data-line-actions="true"
      className="absolute left-full top-0 z-20 flex h-5 w-max items-center gap-0.5 rounded bg-github-bg-secondary opacity-40 transition-opacity hover:opacity-100 focus-within:opacity-100"
    >
      {children}
    </div>
  );
}
