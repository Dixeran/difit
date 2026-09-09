import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DiffFile } from '../../types/diff';
import { tokenizeWithTreeSitter } from '../utils/treeSitterTokenizer';

import { useFileLevelTokens } from './useFileLevelTokens';

vi.mock('../utils/treeSitterTokenizer', () => ({
  tokenizeWithTreeSitter: vi.fn(async (source: string) =>
    source
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => [{ types: ['tree-sitter'], content: line }]),
  ),
}));

const VUE_FILE_V1 = `<template>
  <div class="greeting">{{ message }}</div>
</template>

<script setup>
const message = 'hello';
</script>
`;

const VUE_FILE_V2 = VUE_FILE_V1.replace("'hello'", "'updated'");

function createFile(path = 'src/Sample.vue'): DiffFile {
  return {
    path,
    status: 'modified',
    additions: 1,
    deletions: 1,
    chunks: [],
  };
}

function mockBlobFetch(payload: Record<string, string>) {
  vi.mocked(global.fetch).mockImplementation((input: string | URL | Request) => {
    const rawUrl =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, 'http://localhost');
    const body = payload[url.searchParams.get('ref') ?? ''];
    return Promise.resolve(
      body === undefined
        ? ({ ok: false, text: async () => '' } as Response)
        : ({ ok: true, text: async () => body } as Response),
    );
  });
}

describe('useFileLevelTokens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tokenizes each complete old and new blob with the detected Tree-sitter grammar', async () => {
    mockBlobFetch({ HEAD: VUE_FILE_V1, '.': VUE_FILE_V1 });
    const { result } = renderHook(() =>
      useFileLevelTokens({
        file: createFile(),
        enabled: true,
        baseCommitish: 'HEAD',
        targetCommitish: '.',
      }),
    );

    await waitFor(() => expect(result.current.getNewTokens).not.toBeNull());
    expect(tokenizeWithTreeSitter).toHaveBeenCalledTimes(2);
    expect(tokenizeWithTreeSitter).toHaveBeenCalledWith(VUE_FILE_V1, 'vue');
    expect(result.current.getNewTokens?.(6)).toEqual([
      { types: ['tree-sitter'], content: "const message = 'hello';" },
    ]);
  });

  it('uses full-file highlighting for ordinary source files too', async () => {
    const source = "const greeting = 'hi';\n";
    mockBlobFetch({ HEAD: source, '.': source });
    const { result } = renderHook(() =>
      useFileLevelTokens({
        file: createFile('src/sample.ts'),
        enabled: true,
        baseCommitish: 'HEAD',
        targetCommitish: '.',
      }),
    );

    await waitFor(() => expect(result.current.getNewTokens).not.toBeNull());
    expect(tokenizeWithTreeSitter).toHaveBeenCalledWith(source, 'typescript');
  });

  it('does not fetch when highlighting is disabled or the grammar is unsupported', () => {
    const disabled = renderHook(() =>
      useFileLevelTokens({
        file: createFile(),
        enabled: false,
        baseCommitish: 'HEAD',
        targetCommitish: '.',
      }),
    );
    const unsupported = renderHook(() =>
      useFileLevelTokens({
        file: createFile('README.md'),
        enabled: true,
        baseCommitish: 'HEAD',
        targetCommitish: '.',
      }),
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(disabled.result.current.getNewTokens).toBeNull();
    expect(unsupported.result.current.getNewTokens).toBeNull();
  });

  it('does not fetch blobs for stdin diffs', () => {
    const { result } = renderHook(() =>
      useFileLevelTokens({
        file: createFile(),
        enabled: true,
        baseCommitish: 'stdin',
        targetCommitish: 'stdin',
      }),
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.getOldTokens).toBeNull();
    expect(result.current.getNewTokens).toBeNull();
  });

  it('keeps full-file context beyond the old 2000-line limit', async () => {
    const source = Array.from(
      { length: 2501 },
      (_, index) => `const value${index} = ${index};`,
    ).join('\n');
    mockBlobFetch({ HEAD: source, '.': source });
    const { result } = renderHook(() =>
      useFileLevelTokens({
        file: createFile('large.ts'),
        enabled: true,
        baseCommitish: 'HEAD',
        targetCommitish: '.',
      }),
    );

    await waitFor(() => expect(result.current.getNewTokens).not.toBeNull());
    expect(tokenizeWithTreeSitter).toHaveBeenCalledWith(source, 'typescript');
    expect(result.current.getNewTokens?.(2501)?.[0]?.content).toBe('const value2500 = 2500;');
  });

  it('re-fetches and re-tokenizes when reloadKey changes', async () => {
    const responses: Record<string, string> = { HEAD: VUE_FILE_V1, '.': VUE_FILE_V1 };
    mockBlobFetch(responses);
    const { result, rerender } = renderHook(
      ({ reloadKey }) =>
        useFileLevelTokens({
          file: createFile(),
          enabled: true,
          baseCommitish: 'HEAD',
          targetCommitish: '.',
          reloadKey,
        }),
      { initialProps: { reloadKey: 1 } },
    );

    await waitFor(() => expect(result.current.getNewTokens?.(6)?.[0]?.content).toContain('hello'));
    responses.HEAD = VUE_FILE_V2;
    responses['.'] = VUE_FILE_V2;
    rerender({ reloadKey: 2 });

    await waitFor(() =>
      expect(result.current.getNewTokens?.(6)?.[0]?.content).toContain('updated'),
    );
    expect(tokenizeWithTreeSitter).toHaveBeenCalledWith(VUE_FILE_V2, 'vue');
  });

  it('fetches only the available side for added and deleted files', async () => {
    mockBlobFetch({ HEAD: VUE_FILE_V1, '.': VUE_FILE_V1 });
    const { result: addedResult, unmount } = renderHook(() =>
      useFileLevelTokens({
        file: { ...createFile(), status: 'added' },
        enabled: true,
        baseCommitish: 'HEAD',
        targetCommitish: '.',
      }),
    );

    await waitFor(() => expect(addedResult.current.getNewTokens).not.toBeNull());
    expect(addedResult.current.getOldTokens).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    unmount();

    vi.clearAllMocks();
    mockBlobFetch({ HEAD: VUE_FILE_V1, '.': VUE_FILE_V1 });
    const { result: deletedResult } = renderHook(() =>
      useFileLevelTokens({
        file: { ...createFile(), status: 'deleted' },
        enabled: true,
        baseCommitish: 'HEAD',
        targetCommitish: '.',
      }),
    );

    await waitFor(() => expect(deletedResult.current.getOldTokens).not.toBeNull());
    expect(deletedResult.current.getNewTokens).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
