export const TREE_SITTER_LANGUAGE_IDS = [
  'astro',
  'bash',
  'c',
  'c_sharp',
  'clojure',
  'cpp',
  'css',
  'dart',
  'dockerfile',
  'elixir',
  'gdscript',
  'go',
  'groovy',
  'haskell',
  'hcl',
  'html',
  'ini',
  'java',
  'javascript',
  'json',
  'kotlin',
  'lua',
  'make',
  'nix',
  'perl',
  'php',
  'proto',
  'python',
  'r',
  'ruby',
  'rust',
  'scala',
  'scss',
  'solidity',
  'sql',
  'svelte',
  'swift',
  'toml',
  'tsx',
  'typescript',
  'vim',
  'vue',
  'xml',
  'yaml',
] as const;

export type TreeSitterLanguageId = (typeof TREE_SITTER_LANGUAGE_IDS)[number];

const TREE_SITTER_LANGUAGE_SET = new Set<string>(TREE_SITTER_LANGUAGE_IDS);

export function isTreeSitterLanguageId(value: string): value is TreeSitterLanguageId {
  return TREE_SITTER_LANGUAGE_SET.has(value);
}
