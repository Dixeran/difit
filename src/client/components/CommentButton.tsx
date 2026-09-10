import { MessageSquare } from 'lucide-react';
import React from 'react';

interface CommentButtonProps {
  onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
}

export const CommentButton: React.FC<CommentButtonProps> = React.memo(
  ({ onMouseDown, title = 'Add a comment' }) => {
    return (
      <button
        type="button"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
        data-comment-button="true"
        style={{
          backgroundColor: 'var(--color-yellow-btn-bg)',
          color: 'var(--color-yellow-btn-text)',
          border: '1px solid var(--color-yellow-btn-border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-yellow-btn-hover-bg)';
          e.currentTarget.style.borderColor = 'var(--color-yellow-btn-hover-border)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-yellow-btn-bg)';
          e.currentTarget.style.borderColor = 'var(--color-yellow-btn-border)';
        }}
        onMouseDown={onMouseDown}
        onClick={(e) => e.stopPropagation()}
        title={title}
      >
        <MessageSquare className="h-3.5 w-3.5" />
      </button>
    );
  },
);

CommentButton.displayName = 'CommentButton';
