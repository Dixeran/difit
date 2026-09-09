import { describe, expect, it } from 'vitest';

import { treeSitterCapturesToTokens } from './treeSitterTokenizer';

describe('treeSitterCapturesToTokens', () => {
  it('keeps syntax context from lines outside the rendered diff range', () => {
    const source = '/* hidden context\nvisible continuation */\nconst value = 1;';
    const tokens = treeSitterCapturesToTokens(source, [
      {
        name: 'comment',
        patternIndex: 0,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 1, column: 23 },
      },
    ]);

    expect(tokens[1]).toEqual([{ types: ['comment'], content: 'visible continuation */' }]);
    expect(tokens[2]).toEqual([{ types: ['plain'], content: 'const value = 1;' }]);
  });

  it('lets later, more specific query captures override generic captures', () => {
    const tokens = treeSitterCapturesToTokens('run()', [
      {
        name: 'variable',
        patternIndex: 0,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 3 },
      },
      {
        name: 'function.call',
        patternIndex: 1,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 3 },
      },
    ]);

    expect(tokens[0]).toEqual([
      { types: ['function'], content: 'run' },
      { types: ['plain'], content: '()' },
    ]);
  });

  it('converts Tree-sitter UTF-8 byte columns to JavaScript string indexes', () => {
    const tokens = treeSitterCapturesToTokens('const 名称 = "值";', [
      {
        name: 'variable',
        patternIndex: 0,
        startPosition: { row: 0, column: 6 },
        endPosition: { row: 0, column: 12 },
      },
      {
        name: 'string',
        patternIndex: 1,
        startPosition: { row: 0, column: 15 },
        endPosition: { row: 0, column: 20 },
      },
    ]);

    expect(tokens[0]).toContainEqual({ types: ['variable'], content: '名称' });
    expect(tokens[0]).toContainEqual({ types: ['string'], content: '"值"' });
  });
});
