import { type Token } from 'prism-react-renderer';
import { useEffect, useMemo, useState } from 'react';

import { type DiffFile } from '../../types/diff';
import { getTreeSitterLanguageFromFilename } from '../utils/languageDetection';
import { tokenizeWithTreeSitter } from '../utils/treeSitterTokenizer';

type LineTokensGetter = (lineNumber: number) => Token[] | null;

export interface FileLevelTokens {
  getOldTokens: LineTokensGetter | null;
  getNewTokens: LineTokensGetter | null;
}

const EMPTY: FileLevelTokens = { getOldTokens: null, getNewTokens: null };

async function fetchBlobText(filePath: string, ref: string): Promise<string | null> {
  try {
    const response = await fetch(
      `/api/blob/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(ref)}`,
    );
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

interface UseFileLevelTokensParams {
  file: DiffFile;
  enabled: boolean;
  baseCommitish?: string;
  targetCommitish?: string;
  reloadKey?: string | number;
}

export function useFileLevelTokens({
  file,
  enabled,
  baseCommitish,
  targetCommitish,
  reloadKey,
}: UseFileLevelTokensParams): FileLevelTokens {
  const language = useMemo(() => getTreeSitterLanguageFromFilename(file.path), [file.path]);
  const treeSitterEnabled = enabled && language !== undefined;
  const isStdinDiff = baseCommitish === 'stdin' || targetCommitish === 'stdin';

  const [oldContent, setOldContent] = useState<string | null>(null);
  const [newContent, setNewContent] = useState<string | null>(null);
  const [oldTokens, setOldTokens] = useState<Token[][] | null>(null);
  const [newTokens, setNewTokens] = useState<Token[][] | null>(null);

  useEffect(() => {
    if (!treeSitterEnabled || isStdinDiff) {
      setOldContent(null);
      setNewContent(null);
      return;
    }
    let cancelled = false;
    const needOld = file.status !== 'added' && !!baseCommitish;
    const needNew = file.status !== 'deleted' && !!targetCommitish;
    setOldContent(null);
    setNewContent(null);

    if (needOld) {
      const oldPath = file.oldPath || file.path;
      void fetchBlobText(oldPath, baseCommitish as string).then((text) => {
        if (!cancelled) setOldContent(text);
      });
    }
    if (needNew) {
      void fetchBlobText(file.path, targetCommitish as string).then((text) => {
        if (!cancelled) setNewContent(text);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [
    treeSitterEnabled,
    file.path,
    file.oldPath,
    file.status,
    baseCommitish,
    targetCommitish,
    reloadKey,
    isStdinDiff,
  ]);

  useEffect(() => {
    if (!enabled || language === undefined || oldContent == null) {
      setOldTokens(null);
      return;
    }
    let cancelled = false;
    void tokenizeWithTreeSitter(oldContent, language).then((tokens) => {
      if (!cancelled) setOldTokens(tokens);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, language, oldContent, treeSitterEnabled]);

  useEffect(() => {
    if (!enabled || language === undefined || newContent == null) {
      setNewTokens(null);
      return;
    }
    let cancelled = false;
    void tokenizeWithTreeSitter(newContent, language).then((tokens) => {
      if (!cancelled) setNewTokens(tokens);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, language, newContent, treeSitterEnabled]);

  return useMemo<FileLevelTokens>(() => {
    if (!treeSitterEnabled) return EMPTY;
    const getOldTokens: LineTokensGetter | null = oldTokens
      ? (lineNumber: number) => oldTokens[lineNumber - 1] ?? null
      : null;
    const getNewTokens: LineTokensGetter | null = newTokens
      ? (lineNumber: number) => newTokens[lineNumber - 1] ?? null
      : null;
    return { getOldTokens, getNewTokens };
  }, [treeSitterEnabled, oldTokens, newTokens]);
}
