import { describe, expect, it } from 'vitest';

import { getSyntaxTheme } from './syntaxThemes';

describe('getSyntaxTheme', () => {
  it('uses VS Code Modern Dark as the default syntax theme', () => {
    const theme = getSyntaxTheme('unknown');
    expect(theme.plain.color).toBe('#D4D4D4');
    expect(theme.styles.find((entry) => entry.types.includes('keyword'))?.style.color).toBe(
      '#569CD6',
    );
  });

  it('provides the VS Code Modern Light palette', () => {
    const theme = getSyntaxTheme('vscodeModernLight');
    expect(theme.plain.color).toBe('#000000');
    expect(theme.styles.find((entry) => entry.types.includes('comment'))?.style.color).toBe(
      '#008000',
    );
  });
});
