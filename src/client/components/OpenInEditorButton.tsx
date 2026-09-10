import { ExternalLink } from 'lucide-react';
import React from 'react';

interface OpenInEditorButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  className?: string;
}

export const OpenInEditorButton: React.FC<OpenInEditorButtonProps> = React.memo(
  ({ onClick, title = 'Open in editor', className }) => {
    return (
      <button
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${className || ''}`}
        data-open-in-editor-button="true"
        style={{
          backgroundColor: 'var(--color-editor-btn-bg)',
          color: 'var(--color-editor-btn-text)',
          border: '1px solid var(--color-editor-btn-border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-editor-btn-hover-bg)';
          e.currentTarget.style.borderColor = 'var(--color-editor-btn-hover-border)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-editor-btn-bg)';
          e.currentTarget.style.borderColor = 'var(--color-editor-btn-border)';
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(e);
        }}
        title={title}
      >
        <ExternalLink className="h-3.5 w-3.5 opacity-80" />
      </button>
    );
  },
);

OpenInEditorButton.displayName = 'OpenInEditorButton';
