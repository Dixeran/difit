import type { Token } from 'prism-react-renderer';
import { Language, Parser, Query, type QueryCapture, type QueryMatch } from 'web-tree-sitter';

import { isTreeSitterLanguageId, type TreeSitterLanguageId } from '../../utils/treeSitterLanguages';

const QUERY_PLAN: Partial<Record<TreeSitterLanguageId, Array<[TreeSitterLanguageId, string]>>> = {
  astro: [
    ['html', 'highlights'],
    ['astro', 'highlights'],
  ],
  cpp: [
    ['c', 'highlights'],
    ['cpp', 'highlights'],
  ],
  scss: [
    ['css', 'highlights'],
    ['scss', 'highlights'],
  ],
  svelte: [
    ['html', 'highlights'],
    ['svelte', 'highlights'],
  ],
  tsx: [
    ['javascript', 'highlights'],
    ['javascript', 'highlights-jsx'],
    ['tsx', 'highlights'],
  ],
  typescript: [
    ['javascript', 'highlights'],
    ['typescript', 'highlights'],
  ],
  vue: [
    ['html', 'highlights'],
    ['vue', 'highlights'],
  ],
};

const INJECTION_QUERY_PLAN: Partial<
  Record<TreeSitterLanguageId, Array<[TreeSitterLanguageId, string]>>
> = {
  astro: [
    ['html', 'injections'],
    ['astro', 'injections'],
  ],
  html: [['html', 'injections']],
  svelte: [
    ['html', 'injections'],
    ['svelte', 'injections'],
  ],
  vue: [
    ['html', 'injections'],
    ['vue', 'injections'],
  ],
};

const INJECTION_LANGUAGE_ALIASES: Record<string, TreeSitterLanguageId> = {
  js: 'javascript',
  javascript: 'javascript',
  jsx: 'tsx',
  ts: 'typescript',
  tsx: 'tsx',
  typescript: 'typescript',
};

const MAX_INJECTION_DEPTH = 3;

interface LoadedTreeSitterLanguage {
  language: Language;
  query: Query;
  injectionQuery: Query | null;
}

export interface TreeSitterCaptureRange {
  name: string;
  patternIndex: number;
  priority?: number;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
}

interface LineCapture {
  start: number;
  end: number;
  type: string;
  priority: number;
  order: number;
}

let parserInitialization: Promise<void> | null = null;
const languageCache = new Map<TreeSitterLanguageId, Promise<LoadedTreeSitterLanguage>>();

function initializeParser(): Promise<void> {
  parserInitialization ??= Parser.init({
    locateFile: () => '/api/tree-sitter/runtime.wasm',
  });
  return parserInitialization;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load Tree-sitter asset: ${url}`);
  return response.text();
}

async function loadLanguage(languageId: TreeSitterLanguageId): Promise<LoadedTreeSitterLanguage> {
  const existing = languageCache.get(languageId);
  if (existing) return existing;

  const loading = (async () => {
    await initializeParser();
    const language = await Language.load(`/api/tree-sitter/${languageId}/parser.wasm`);
    const queryParts = QUERY_PLAN[languageId] ?? [[languageId, 'highlights']];
    const sources = await Promise.all(
      queryParts.map(([queryLanguage, queryName]) =>
        fetchText(`/api/tree-sitter/${queryLanguage}/${queryName}.scm`),
      ),
    );
    const injectionParts = INJECTION_QUERY_PLAN[languageId];
    const injectionSources = injectionParts
      ? await Promise.all(
          injectionParts.map(([queryLanguage, queryName]) =>
            fetchText(`/api/tree-sitter/${queryLanguage}/${queryName}.scm`),
          ),
        )
      : null;
    return {
      language,
      query: new Query(language, sources.join('\n')),
      injectionQuery: injectionSources ? new Query(language, injectionSources.join('\n')) : null,
    };
  })();

  languageCache.set(languageId, loading);
  void loading.catch(() => languageCache.delete(languageId));
  return loading;
}

function captureType(name: string): string | null {
  if (name.startsWith('_')) return null;
  const [root = name] = name.split('.');
  switch (root) {
    case 'attribute':
      return 'attr-name';
    case 'boolean':
      return 'boolean';
    case 'character':
      return 'string';
    case 'string':
      return name.includes('special') ? 'regex' : 'string';
    case 'comment':
      return 'comment';
    case 'constant':
      return name.includes('builtin') ? 'builtin' : 'constant';
    case 'constructor':
    case 'module':
    case 'namespace':
    case 'type':
      return name.includes('builtin') ? 'builtin' : 'class-name';
    case 'embedded':
    case 'none':
    case 'text':
      return 'plain';
    case 'escape':
      return 'char';
    case 'function':
    case 'method':
      return 'function';
    case 'keyword':
      return 'keyword';
    case 'label':
      return 'symbol';
    case 'number':
    case 'float':
      return 'number';
    case 'operator':
      return 'operator';
    case 'property':
      return 'property';
    case 'punctuation':
      return 'punctuation';
    case 'tag':
      return name.includes('attribute') ? 'attr-name' : 'tag';
    case 'variable':
      return name.includes('builtin') ? 'builtin' : 'variable';
    default:
      return root;
  }
}

function byteColumnToStringIndex(line: string, byteColumn: number): number {
  if (byteColumn <= 0) return 0;
  let bytes = 0;
  let stringIndex = 0;
  for (const character of line) {
    const characterBytes = new TextEncoder().encode(character).length;
    if (bytes + characterBytes > byteColumn) break;
    bytes += characterBytes;
    stringIndex += character.length;
  }
  return stringIndex;
}

function tokenizeLine(line: string, captures: LineCapture[]): Token[] {
  if (line.length === 0) return [{ types: ['plain'], content: '', empty: true }];
  if (captures.length === 0) return [{ types: ['plain'], content: line }];

  const boundaries = new Set([0, line.length]);
  captures.forEach(({ start, end }) => {
    boundaries.add(start);
    boundaries.add(end);
  });
  const points = [...boundaries].sort((left, right) => left - right);
  const tokens: Token[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (start === undefined || end === undefined || start === end) continue;
    const matching = captures
      .filter((capture) => capture.start <= start && capture.end >= end)
      .sort((left, right) => right.priority - left.priority || right.order - left.order)[0];
    const type = matching?.type ?? 'plain';
    const content = line.slice(start, end);
    const previous = tokens[tokens.length - 1];
    if (previous?.types[0] === type) {
      previous.content += content;
    } else {
      tokens.push({ types: [type], content });
    }
  }

  return tokens;
}

export function treeSitterCapturesToTokens(
  source: string,
  captures: TreeSitterCaptureRange[],
): Token[][] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const capturesByLine = Array.from({ length: lines.length }, () => [] as LineCapture[]);

  captures.forEach((capture, order) => {
    const type = captureType(capture.name);
    if (!type) return;
    const firstRow = Math.max(0, capture.startPosition.row);
    const lastRow = Math.min(
      lines.length - 1,
      capture.endPosition.column === 0 ? capture.endPosition.row - 1 : capture.endPosition.row,
    );

    for (let row = firstRow; row <= lastRow; row += 1) {
      const line = lines[row];
      const lineCaptures = capturesByLine[row];
      if (line === undefined || !lineCaptures) continue;
      const start =
        row === capture.startPosition.row
          ? byteColumnToStringIndex(line, capture.startPosition.column)
          : 0;
      const end =
        row === capture.endPosition.row
          ? byteColumnToStringIndex(line, capture.endPosition.column)
          : line.length;
      if (start >= end) continue;
      lineCaptures.push({
        start,
        end,
        type,
        priority: capture.priority ?? capture.patternIndex,
        order,
      });
    }
  });

  return lines.map((line, index) => tokenizeLine(line, capturesByLine[index] ?? []));
}

function toCaptureRange(capture: QueryCapture): TreeSitterCaptureRange {
  const configuredPriority = Number(capture.setProperties?.priority);
  return {
    name: capture.name,
    patternIndex: capture.patternIndex,
    priority: Number.isFinite(configuredPriority) ? configuredPriority : capture.patternIndex,
    startPosition: capture.node.startPosition,
    endPosition: capture.node.endPosition,
  };
}

function resolveInjectionLanguage(value: string | null | undefined) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return (
    INJECTION_LANGUAGE_ALIASES[normalized] ??
    (isTreeSitterLanguageId(normalized) ? normalized : undefined)
  );
}

function resolveInjection(match: QueryMatch): {
  content: QueryCapture;
  languageId: TreeSitterLanguageId;
} | null {
  const explicitContent = match.captures.find((capture) => capture.name === 'injection.content');
  const namedContent = match.captures.find((capture) => isTreeSitterLanguageId(capture.name));
  const content = explicitContent ?? namedContent;
  if (!content) return null;

  const languageCapture = match.captures.find((capture) => capture.name === 'injection.language');
  const languageId = resolveInjectionLanguage(
    match.setProperties?.['injection.language'] ??
      content.setProperties?.['injection.language'] ??
      languageCapture?.node.text ??
      namedContent?.name,
  );
  return languageId ? { content, languageId } : null;
}

function offsetCaptureRange(
  capture: TreeSitterCaptureRange,
  injection: QueryCapture,
  depth: number,
): TreeSitterCaptureRange {
  const offsetPosition = (position: { row: number; column: number }) => ({
    row: injection.node.startPosition.row + position.row,
    column:
      position.row === 0 ? injection.node.startPosition.column + position.column : position.column,
  });
  return {
    ...capture,
    priority: (capture.priority ?? capture.patternIndex) + depth * 10_000,
    startPosition: offsetPosition(capture.startPosition),
    endPosition: offsetPosition(capture.endPosition),
  };
}

async function collectCaptures(
  source: string,
  languageId: TreeSitterLanguageId,
  depth = 0,
): Promise<TreeSitterCaptureRange[]> {
  const { language, query, injectionQuery } = await loadLanguage(languageId);
  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse(source);
  if (!tree) {
    parser.delete();
    return [];
  }

  try {
    const captures = query.captures(tree.rootNode).map(toCaptureRange);
    if (!injectionQuery || depth >= MAX_INJECTION_DEPTH) return captures;

    for (const match of injectionQuery.matches(tree.rootNode)) {
      const injection = resolveInjection(match);
      if (!injection || injection.languageId === languageId) continue;
      const injectedCaptures = await collectCaptures(
        injection.content.node.text,
        injection.languageId,
        depth + 1,
      );
      captures.push(
        ...injectedCaptures.map((capture) =>
          offsetCaptureRange(capture, injection.content, depth + 1),
        ),
      );
    }
    return captures;
  } finally {
    tree.delete();
    parser.delete();
  }
}

export async function tokenizeWithTreeSitter(
  source: string,
  languageId: TreeSitterLanguageId,
): Promise<Token[][] | null> {
  try {
    const normalizedSource = source.replace(/\r\n?/g, '\n');
    const captures = await collectCaptures(normalizedSource, languageId);
    return treeSitterCapturesToTokens(normalizedSource, captures);
  } catch (error) {
    console.warn(`Tree-sitter highlighting unavailable for ${languageId}:`, error);
    return null;
  }
}

export function resetTreeSitterForTests() {
  parserInitialization = null;
  languageCache.clear();
}
