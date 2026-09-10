import { type DiffLine, type ExpandedLine } from '../../types/diff';
import { useFileLevelTokensLookup } from '../contexts/FileLevelTokensContext';
import { type DiffSegment } from '../utils/wordLevelDiff';

import { EnhancedPrismSyntaxHighlighter } from './EnhancedPrismSyntaxHighlighter';
import type { AppearanceSettings } from './SettingsModal';
import { WordLevelDiffHighlighter } from './WordLevelDiffHighlighter';

interface DiffCodeLineProps {
  line: Pick<DiffLine | ExpandedLine, 'type' | 'content' | 'oldLineNumber' | 'newLineNumber'>;
  syntaxTheme?: AppearanceSettings['syntaxTheme'];
  filename?: string;
  diffSegments?: DiffSegment[];
  showPrefixBorder?: boolean;
  wrapCodeLines?: boolean;
}

const getLinePrefix = (type: DiffLine['type']) => {
  switch (type) {
    case 'add':
      return '+';
    case 'delete':
      return '-';
    default:
      return ' ';
  }
};

const getPrefixClass = (type: DiffLine['type']) => {
  switch (type) {
    case 'add':
      return 'text-github-accent bg-diff-addition-bg';
    case 'delete':
      return 'text-github-danger bg-diff-deletion-bg';
    default:
      return 'text-github-text-muted bg-github-bg-secondary';
  }
};

export function DiffCodeLine({
  line,
  syntaxTheme,
  filename,
  diffSegments,
  showPrefixBorder = true,
  wrapCodeLines = true,
}: DiffCodeLineProps) {
  const { getOldTokens, getNewTokens } = useFileLevelTokensLookup();
  const getPrecomputedTokens = () => {
    const oldSideTokens =
      line.oldLineNumber != null ? (getOldTokens?.(line.oldLineNumber) ?? null) : null;
    // Deleted lines exist only on the old side.
    if (line.type === 'delete') {
      return oldSideTokens ? [oldSideTokens] : null;
    }
    // Other lines use the new side, falling back to the old side when there is
    // no new line number.
    const lineTokens =
      line.newLineNumber != null ? (getNewTokens?.(line.newLineNumber) ?? null) : oldSideTokens;
    return lineTokens ? [lineTokens] : null;
  };

  const codeClassName = wrapCodeLines
    ? 'block min-w-0 px-3 text-github-text-primary whitespace-pre-wrap break-all overflow-wrap-break-word select-text'
    : 'diff-code-scroll-content block px-3 text-github-text-primary whitespace-pre select-text';
  const prismClassName = `${codeClassName} [&_pre]:m-0 [&_pre]:p-0 [&_pre]:!bg-transparent [&_pre]:font-inherit [&_pre]:text-inherit [&_pre]:leading-inherit [&_code]:!bg-transparent [&_code]:font-inherit [&_code]:text-inherit [&_code]:leading-inherit`;

  return (
    <div className="relative flex min-h-[16px] min-w-0 items-center">
      <span
        className={`w-5 text-center flex-shrink-0 ${showPrefixBorder ? 'border-r border-github-border' : ''} ${getPrefixClass(
          line.type,
        )}`}
      >
        {getLinePrefix(line.type)}
      </span>
      <div
        data-diff-scroll-pane="unified"
        className={`min-w-0 flex-1 ${wrapCodeLines ? '' : 'diff-code-scroll-pane'}`}
      >
        {diffSegments ? (
          <WordLevelDiffHighlighter segments={diffSegments} className={codeClassName} />
        ) : (
          <EnhancedPrismSyntaxHighlighter
            code={line.content}
            className={prismClassName}
            syntaxTheme={syntaxTheme}
            filename={filename}
            precomputedTokens={getPrecomputedTokens()}
          />
        )}
      </div>
    </div>
  );
}
