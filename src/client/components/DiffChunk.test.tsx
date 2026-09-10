import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { DiffChunk as DiffChunkData } from '../../types/diff';
import { DEFAULT_DIFF_VIEW_MODE } from '../../utils/diffMode';
import { WordHighlightProvider } from '../contexts/WordHighlightContext';

import { DiffChunk } from './DiffChunk';
import { SideBySideDiffChunk } from './SideBySideDiffChunk';

const testChunk: DiffChunkData = {
  header: '@@ -10,3 +10,3 @@',
  oldStart: 10,
  oldLines: 2,
  newStart: 10,
  newLines: 3,
  lines: [
    {
      type: 'normal',
      content: 'const first = 1;',
      oldLineNumber: 10,
      newLineNumber: 10,
    },
    {
      type: 'normal',
      content: 'const second = 2;',
      oldLineNumber: 11,
      newLineNumber: 11,
    },
    {
      type: 'add',
      content: 'const third = 3;',
      newLineNumber: 12,
    },
  ],
};

const noop = () => {};
const asyncNoop = async () => {};
const renderWithProviders = (ui: ReactNode) =>
  render(<WordHighlightProvider>{ui}</WordHighlightProvider>);

describe('DiffChunk range comments', () => {
  it('renders independently scrollable no-wrap panes for unified and split views', () => {
    const sharedProps = {
      chunk: testChunk,
      chunkIndex: 0,
      threads: [],
      wrapCodeLines: false,
      onAddComment: asyncNoop,
      onGenerateThreadPrompt: () => '',
      onRemoveThread: noop,
      onReplyToThread: asyncNoop,
      onRemoveMessage: noop,
      onUpdateMessage: noop,
      filename: 'src/example.ts',
    };
    const unified = renderWithProviders(<DiffChunk {...sharedProps} mode="unified" />);

    const unifiedPanes = unified.container.querySelectorAll('[data-diff-scroll-pane="unified"]');
    expect(unifiedPanes).toHaveLength(testChunk.lines.length);
    expect(unifiedPanes[0]).toHaveClass('diff-code-scroll-pane');
    expect(unifiedPanes[0]?.firstElementChild).toHaveClass('whitespace-pre');
    expect(unifiedPanes[0]?.firstElementChild).toHaveClass('diff-code-scroll-content');
    unified.unmount();

    const split = renderWithProviders(<SideBySideDiffChunk {...sharedProps} />);
    const leftPane = split.container.querySelector('[data-diff-scroll-pane="left"]');
    const rightPane = split.container.querySelector('[data-diff-scroll-pane="right"]');
    expect(leftPane).toHaveClass('diff-code-scroll-pane');
    expect(rightPane).toHaveClass('diff-code-scroll-pane');
    expect(leftPane?.firstElementChild).toHaveClass('whitespace-pre');
    expect(rightPane?.firstElementChild).toHaveClass('whitespace-pre');
    expect(leftPane?.firstElementChild).toHaveClass('diff-code-scroll-content');
    expect(rightPane?.firstElementChild).toHaveClass('diff-code-scroll-content');
  });

  it('keeps line actions in a dedicated lane outside line numbers and code', () => {
    const sharedProps = {
      chunk: testChunk,
      chunkIndex: 0,
      threads: [],
      onAddComment: asyncNoop,
      onGenerateThreadPrompt: () => '',
      onRemoveThread: noop,
      onReplyToThread: asyncNoop,
      onRemoveMessage: noop,
      onUpdateMessage: noop,
      onShowLineHistory: vi.fn(),
      onOpenInEditor: vi.fn(),
      filename: 'src/example.ts',
    };

    const unified = renderWithProviders(<DiffChunk {...sharedProps} mode="unified" />);
    const unifiedRow = unified.container.querySelector('[data-diff-line-row="true"]')!;
    fireEvent.mouseEnter(unifiedRow);

    const unifiedActionCell = unifiedRow.children[1]!;
    expect(unifiedActionCell).toHaveClass(
      'w-[calc(var(--line-number-width)+var(--line-actions-width))]',
    );
    expect(unifiedActionCell.querySelector('span')).toHaveClass('w-[var(--line-number-width)]');
    expect(unifiedActionCell.querySelector('[data-line-actions="true"]')).not.toBeNull();
    expect(unifiedRow.children[2]!.querySelector('[data-line-actions="true"]')).toBeNull();
    unified.unmount();

    const split = renderWithProviders(<SideBySideDiffChunk {...sharedProps} />);
    const splitRow = split.container.querySelector('[data-diff-line-row="true"]')!;
    fireEvent.mouseMove(splitRow.children[0]!);

    const splitActionCell = splitRow.children[0]!;
    expect(splitActionCell).toHaveClass(
      'w-[calc(var(--line-number-width)+var(--line-actions-width))]',
    );
    expect(splitActionCell.querySelector('span')).toHaveClass('w-[var(--line-number-width)]');
    expect(splitActionCell.querySelector('[data-line-actions="true"]')).not.toBeNull();
    expect(splitRow.children[1]!.querySelector('[data-line-actions="true"]')).toBeNull();
  });

  it('opens a unified range comment with shift-click', async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined);
    const { container } = renderWithProviders(
      <DiffChunk
        chunk={testChunk}
        chunkIndex={0}
        threads={[]}
        mode="unified"
        onAddComment={onAddComment}
        onGenerateThreadPrompt={() => ''}
        onRemoveThread={noop}
        onReplyToThread={asyncNoop}
        onRemoveMessage={noop}
        onUpdateMessage={noop}
        filename="src/example.ts"
      />,
    );

    const rows = container.querySelectorAll('[data-diff-line-row="true"]');
    fireEvent.click(rows[0]!);
    fireEvent.click(rows[2]!, { shiftKey: true });

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Please revisit this range' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(onAddComment).toHaveBeenCalledWith(
        [10, 12],
        'Please revisit this range',
        ['const first = 1;', 'const second = 2;', 'const third = 3;'].join('\n'),
        'new',
      );
    });
  });

  it('opens a split-view range comment with shift-click on the same side', async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined);
    const { container } = renderWithProviders(
      <SideBySideDiffChunk
        chunk={testChunk}
        chunkIndex={0}
        threads={[]}
        onAddComment={onAddComment}
        onGenerateThreadPrompt={() => ''}
        onRemoveThread={noop}
        onReplyToThread={asyncNoop}
        onRemoveMessage={noop}
        onUpdateMessage={noop}
        filename="src/example.ts"
      />,
    );

    const rows = container.querySelectorAll('[data-diff-line-row="true"]');
    fireEvent.click(rows[0]!.children[2]!);
    fireEvent.click(rows[2]!.children[2]!, { shiftKey: true });

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Please revisit this range' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(onAddComment).toHaveBeenCalledWith(
        [10, 12],
        'Please revisit this range',
        ['const first = 1;', 'const second = 2;', 'const third = 3;'].join('\n'),
        'new',
      );
    });
  });

  it('falls back to a single-line comment when shift-click has no anchor', async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined);
    const { container } = renderWithProviders(
      <DiffChunk
        chunk={testChunk}
        chunkIndex={0}
        threads={[]}
        mode={DEFAULT_DIFF_VIEW_MODE}
        onAddComment={onAddComment}
        onGenerateThreadPrompt={() => ''}
        onRemoveThread={noop}
        onReplyToThread={asyncNoop}
        onRemoveMessage={noop}
        onUpdateMessage={noop}
        filename="src/example.ts"
      />,
    );

    const rows = container.querySelectorAll('[data-diff-line-row="true"]');
    fireEvent.click(rows[2]!.children[2]!, { shiftKey: true });

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Single line only' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(onAddComment).toHaveBeenCalledWith(12, 'Single line only', 'const third = 3;', 'new');
    });
  });

  it('keeps a unified range when shift-clicking the comment button', async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined);
    const { container } = renderWithProviders(
      <DiffChunk
        chunk={testChunk}
        chunkIndex={0}
        threads={[]}
        mode="unified"
        onAddComment={onAddComment}
        onGenerateThreadPrompt={() => ''}
        onRemoveThread={noop}
        onReplyToThread={asyncNoop}
        onRemoveMessage={noop}
        onUpdateMessage={noop}
        filename="src/example.ts"
      />,
    );

    const rows = container.querySelectorAll('[data-diff-line-row="true"]');
    fireEvent.click(rows[0]!);
    fireEvent.mouseEnter(rows[2]!);
    const commentButton = screen.getByRole('button', { name: 'Add a comment' });
    fireEvent.mouseDown(commentButton, { shiftKey: true });
    fireEvent.click(commentButton, { shiftKey: true });

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Please revisit this range' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(onAddComment).toHaveBeenCalledWith(
        [10, 12],
        'Please revisit this range',
        ['const first = 1;', 'const second = 2;', 'const third = 3;'].join('\n'),
        'new',
      );
    });
  });

  it('keeps a split-view range when shift-clicking the comment button', async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined);
    const { container } = renderWithProviders(
      <SideBySideDiffChunk
        chunk={testChunk}
        chunkIndex={0}
        threads={[]}
        onAddComment={onAddComment}
        onGenerateThreadPrompt={() => ''}
        onRemoveThread={noop}
        onReplyToThread={asyncNoop}
        onRemoveMessage={noop}
        onUpdateMessage={noop}
        filename="src/example.ts"
      />,
    );

    const rows = container.querySelectorAll('[data-diff-line-row="true"]');
    fireEvent.click(rows[0]!.children[2]!);
    fireEvent.mouseEnter(rows[2]!.children[2]!);
    const commentButton = screen.getByRole('button', { name: 'Add a comment' });
    fireEvent.mouseDown(commentButton, { shiftKey: true });
    fireEvent.click(commentButton, { shiftKey: true });

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Please revisit this range' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(onAddComment).toHaveBeenCalledWith(
        [10, 12],
        'Please revisit this range',
        ['const first = 1;', 'const second = 2;', 'const third = 3;'].join('\n'),
        'new',
      );
    });
  });
});
