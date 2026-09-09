import { type PrismTheme, themes } from 'prism-react-renderer';

const vscodeModernDark: PrismTheme = {
  plain: { color: '#D4D4D4' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#6A9955' } },
    { types: ['string', 'char', 'attr-value'], style: { color: '#CE9178' } },
    { types: ['number'], style: { color: '#B5CEA8' } },
    { types: ['boolean', 'constant', 'builtin'], style: { color: '#4FC1FF' } },
    { types: ['keyword', 'atrule'], style: { color: '#569CD6' } },
    { types: ['class-name'], style: { color: '#4EC9B0' } },
    { types: ['function'], style: { color: '#DCDCAA' } },
    { types: ['variable', 'property', 'attr-name'], style: { color: '#9CDCFE' } },
    { types: ['tag'], style: { color: '#569CD6' } },
    { types: ['regex'], style: { color: '#D16969' } },
    { types: ['operator', 'punctuation', 'symbol'], style: { color: '#D4D4D4' } },
    { types: ['deleted'], style: { color: '#CE9178' } },
    { types: ['inserted'], style: { color: '#B5CEA8' } },
  ],
};

const vscodeModernLight: PrismTheme = {
  plain: { color: '#000000' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#008000' } },
    { types: ['string', 'char', 'attr-value'], style: { color: '#A31515' } },
    { types: ['number'], style: { color: '#098658' } },
    { types: ['boolean', 'constant', 'builtin'], style: { color: '#0070C1' } },
    { types: ['keyword', 'atrule'], style: { color: '#0000FF' } },
    { types: ['class-name'], style: { color: '#267F99' } },
    { types: ['function'], style: { color: '#795E26' } },
    { types: ['variable', 'property'], style: { color: '#001080' } },
    { types: ['tag'], style: { color: '#800000' } },
    { types: ['attr-name'], style: { color: '#FF0000' } },
    { types: ['regex'], style: { color: '#811F3F' } },
    { types: ['operator', 'punctuation', 'symbol'], style: { color: '#000000' } },
    { types: ['deleted'], style: { color: '#A31515' } },
    { types: ['inserted'], style: { color: '#098658' } },
  ],
};

// Helper function to remove background colors from theme
function removeBackgrounds(theme: PrismTheme) {
  return {
    ...theme,
    styles: theme.styles.map((style: PrismTheme['styles'][number]) => ({
      ...style,
      style: {
        ...style.style,
        background: undefined,
        backgroundColor: undefined,
      },
    })),
  };
}

export function getSyntaxTheme(syntaxTheme: string) {
  let baseTheme;

  // Map theme IDs to prism-react-renderer built-in themes
  switch (syntaxTheme) {
    case 'vscodeModernLight':
      baseTheme = vscodeModernLight;
      break;
    case 'vscodeModernDark':
      baseTheme = vscodeModernDark;
      break;
    case 'github':
      baseTheme = themes.github;
      break;
    case 'vsLight':
      baseTheme = themes.vsLight;
      break;
    case 'oneLight':
      baseTheme = themes.oneLight;
      break;
    case 'gruvboxMaterialLight':
      baseTheme = themes.gruvboxMaterialLight;
      break;
    case 'nightOwlLight':
      baseTheme = themes.nightOwlLight;
      break;
    case 'vsDark':
      baseTheme = themes.vsDark;
      break;
    case 'oneDark':
      baseTheme = themes.oneDark;
      break;
    case 'gruvboxMaterialDark':
      baseTheme = themes.gruvboxMaterialDark;
      break;
    case 'nightOwl':
      baseTheme = themes.nightOwl;
      break;
    case 'dracula':
      baseTheme = themes.dracula;
      break;
    case 'okaidia':
      baseTheme = themes.okaidia;
      break;
    default:
      baseTheme = vscodeModernDark;
  }

  return removeBackgrounds(baseTheme);
}
