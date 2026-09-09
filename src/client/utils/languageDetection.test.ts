import { describe, expect, it } from 'vitest';

import { getTreeSitterLanguageFromFilename } from './languageDetection';

describe('getTreeSitterLanguageFromFilename', () => {
  it('maps source and component extensions to their parsing grammars', () => {
    expect(getTreeSitterLanguageFromFilename('src/app.ts')).toBe('typescript');
    expect(getTreeSitterLanguageFromFilename('src/App.tsx')).toBe('tsx');
    expect(getTreeSitterLanguageFromFilename('src/App.jsx')).toBe('tsx');
    expect(getTreeSitterLanguageFromFilename('src/App.vue')).toBe('vue');
    expect(getTreeSitterLanguageFromFilename('src/App.svelte')).toBe('svelte');
    expect(getTreeSitterLanguageFromFilename('pages/index.astro')).toBe('astro');
    expect(getTreeSitterLanguageFromFilename('native/main.cpp')).toBe('cpp');
  });

  it('is case-insensitive and supports extensionless well-known files', () => {
    expect(getTreeSitterLanguageFromFilename('Component.VUE')).toBe('vue');
    expect(getTreeSitterLanguageFromFilename('Dockerfile')).toBe('dockerfile');
    expect(getTreeSitterLanguageFromFilename('Makefile')).toBe('make');
  });

  it('returns undefined so unsupported files retain the line-level fallback', () => {
    expect(getTreeSitterLanguageFromFilename('README.md')).toBeUndefined();
    expect(getTreeSitterLanguageFromFilename('archive.bin')).toBeUndefined();
    expect(getTreeSitterLanguageFromFilename('')).toBeUndefined();
  });
});
