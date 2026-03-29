import fs from 'fs';
import path from 'path';
import { spawnSync, execFileSync } from 'child_process';
import { createRequire } from 'module';
import * as ts from 'typescript';

const require = createRequire(import.meta.url);
const INDEX_TTL_MS = 60 * 1000;
const CODE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.md', '.html']);
const SYMBOL_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const EXCLUDED_SEGMENTS = ['node_modules', '.git', 'dist', '.kautilya-verify'];
const FRONTEND_EXTENSIONS = new Set(['.tsx', '.jsx', '.css', '.html']);
const BACKEND_HINTS = ['/infra/', '/pipeline/', '/models/', '/backened/', '/server', '/api/'];

let TreeSitterParser = null;
let TreeSitterJavaScript = null;
let TreeSitterTypeScript = null;
let TreeSitterTsx = null;
try {
  TreeSitterParser = require('tree-sitter');
  TreeSitterJavaScript = require('tree-sitter-javascript');
  const tsLanguages = require('tree-sitter-typescript');
  TreeSitterTypeScript = tsLanguages.typescript;
  TreeSitterTsx = tsLanguages.tsx;
} catch {
  TreeSitterParser = null;
}
const TREE_SITTER_ENABLED = Boolean(TreeSitterParser && TreeSitterJavaScript && TreeSitterTypeScript && TreeSitterTsx);

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function hasRipgrep() {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(cmd, ['rg'], { encoding: 'utf8' });
  return result.status === 0;
}

function shouldIgnore(relPath) {
  const normalized = toPosix(relPath);
  return EXCLUDED_SEGMENTS.some((segment) => normalized === segment || normalized.startsWith(`${segment}/`));
}

function walkFiles(rootDir, currentDir = rootDir, output = []) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = path.join(currentDir, entry.name);
    const relPath = toPosix(path.relative(rootDir, fullPath));
    if (!relPath || shouldIgnore(relPath)) continue;
    if (entry.isDirectory()) {
      walkFiles(rootDir, fullPath, output);
      continue;
    }
    output.push(relPath);
  }
  return output;
}

function listProjectFiles(projectRoot, ripgrepEnabled) {
  if (!ripgrepEnabled) return walkFiles(projectRoot);
  try {
    const args = ['--files'];
    for (const excluded of EXCLUDED_SEGMENTS) {
      args.push('--glob', `!${excluded}/**`);
    }
    const stdout = execFileSync('rg', args, {
      cwd: projectRoot,
      encoding: 'utf8',
      windowsHide: true,
    });
    return stdout
      .split(/\r?\n/)
      .map((line) => toPosix(line.trim()))
      .filter(Boolean)
      .filter((relPath) => !shouldIgnore(relPath));
  } catch {
    return walkFiles(projectRoot);
  }
}

function extractSymbolEntries(relPath, content) {
  if (!SYMBOL_EXTENSIONS.has(path.extname(relPath).toLowerCase())) return [];
  try {
    const sourceFile = ts.createSourceFile(relPath, content, ts.ScriptTarget.Latest, true);
    const symbols = [];

    for (const statement of sourceFile.statements) {
      if ('name' in statement && statement.name && ts.isIdentifier(statement.name)) {
        symbols.push({
          name: statement.name.text,
          kind: ts.SyntaxKind[statement.kind] || 'Unknown',
        });
        continue;
      }

      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            symbols.push({
              name: declaration.name.text,
              kind: 'VariableDeclaration',
            });
          }
        }
      }
    }

    return symbols;
  } catch {
    return [];
  }
}

function treeSitterLanguageForFile(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  if (ext === '.tsx') return TreeSitterTsx;
  if (ext === '.ts') return TreeSitterTypeScript;
  if (ext === '.jsx' || ext === '.js') return TreeSitterJavaScript;
  return null;
}

function mergeSymbolEntries(primary = [], secondary = []) {
  const seen = new Set();
  return [...primary, ...secondary].filter((entry) => {
    const key = `${entry.name}:${entry.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractTreeSitterSymbols(relPath, content) {
  if (!TREE_SITTER_ENABLED || !SYMBOL_EXTENSIONS.has(path.extname(relPath).toLowerCase())) return [];
  const language = treeSitterLanguageForFile(relPath);
  if (!language) return [];

  try {
    const parser = new TreeSitterParser();
    parser.setLanguage(language);
    const tree = parser.parse(content);
    const symbols = [];
    const seen = new Set();
    const stack = [tree.rootNode];
    const interestingTypes = new Set([
      'function_declaration',
      'generator_function_declaration',
      'class_declaration',
      'method_definition',
      'lexical_declaration',
      'variable_declaration',
      'interface_declaration',
      'type_alias_declaration',
      'enum_declaration',
      'abstract_class_declaration',
    ]);

    while (stack.length > 0 && symbols.length < 250) {
      const node = stack.pop();
      if (!node) continue;

      if (interestingTypes.has(node.type)) {
        if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
          for (const child of node.namedChildren || []) {
            const nameNode = child.childForFieldName?.('name');
            const name = nameNode?.text;
            const kind = child.type || node.type;
            if (name && !seen.has(`${name}:${kind}`)) {
              seen.add(`${name}:${kind}`);
              symbols.push({ name, kind });
            }
          }
        } else {
          const nameNode = node.childForFieldName?.('name');
          const name = nameNode?.text;
          const kind = node.type;
          if (name && !seen.has(`${name}:${kind}`)) {
            seen.add(`${name}:${kind}`);
            symbols.push({ name, kind });
          }
        }
      }

      for (let index = node.namedChildCount - 1; index >= 0; index -= 1) {
        const child = node.namedChild(index);
        if (child) stack.push(child);
      }
    }

    return symbols;
  } catch {
    return [];
  }
}

function extractImportEntries(relPath, content) {
  if (!SYMBOL_EXTENSIONS.has(path.extname(relPath).toLowerCase())) return [];
  try {
    const parsed = ts.preProcessFile(content, true, true);
    return parsed.importedFiles.map((entry) => entry.fileName);
  } catch {
    return [];
  }
}

function resolveImportTarget(relPath, specifier, fileSet) {
  const normalizedSpecifier = String(specifier || '').trim();
  if (!normalizedSpecifier.startsWith('.')) return null;

  const baseDir = path.posix.dirname(toPosix(relPath));
  const candidates = [
    path.posix.normalize(path.posix.join(baseDir, normalizedSpecifier)),
    path.posix.normalize(path.posix.join(baseDir, `${normalizedSpecifier}.ts`)),
    path.posix.normalize(path.posix.join(baseDir, `${normalizedSpecifier}.tsx`)),
    path.posix.normalize(path.posix.join(baseDir, `${normalizedSpecifier}.js`)),
    path.posix.normalize(path.posix.join(baseDir, `${normalizedSpecifier}.jsx`)),
    path.posix.normalize(path.posix.join(baseDir, normalizedSpecifier, 'index.ts')),
    path.posix.normalize(path.posix.join(baseDir, normalizedSpecifier, 'index.tsx')),
    path.posix.normalize(path.posix.join(baseDir, normalizedSpecifier, 'index.js')),
    path.posix.normalize(path.posix.join(baseDir, normalizedSpecifier, 'index.jsx')),
  ].map(toPosix);

  return candidates.find((candidate) => fileSet.has(candidate)) || null;
}

function safeReadUtf8(fullPath) {
  try {
    return fs.readFileSync(fullPath, 'utf8');
  } catch {
    return '';
  }
}

function directoryDistance(activeFile, candidatePath) {
  if (!activeFile) return 0;
  const activeDir = path.dirname(activeFile);
  const candidateDir = path.dirname(candidatePath);
  if (activeDir === candidateDir) return 4;
  if (candidatePath.startsWith(`${activeDir}/`) || activeDir.startsWith(`${candidateDir}/`)) return 2;
  return 0;
}

function domainBiasScore(relPath, profile = {}) {
  const domainBias = String(profile?.domainBias || 'general').toLowerCase();
  const ext = path.extname(relPath).toLowerCase();
  const normalized = `/${toPosix(relPath)}`;
  if (domainBias === 'frontend') {
    return FRONTEND_EXTENSIONS.has(ext) || normalized.includes('/src/') || normalized.includes('/components/')
      ? 3
      : 0;
  }
  if (domainBias === 'backend') {
    return BACKEND_HINTS.some((hint) => normalized.includes(hint))
      ? 3
      : 0;
  }
  return 0;
}

function createRelatedPathSet(index, context = {}) {
  const related = new Set();
  const anchors = [context.activeFile, ...(Array.isArray(context.openTabs) ? context.openTabs : [])]
    .map(toPosix)
    .filter(Boolean);

  for (const anchor of anchors) {
    related.add(anchor);
    const entry = index.entries.find((item) => item.path === anchor);
    for (const imported of entry?.imports || []) {
      related.add(imported);
    }
    for (const importer of index.importedByMap?.get(anchor) || []) {
      related.add(importer);
    }
  }

  return related;
}

function rankPath(relPath, context = {}) {
  const activeFile = toPosix(context.activeFile);
  const openTabs = Array.isArray(context.openTabs) ? context.openTabs.map(toPosix) : [];
  const relatedPaths = context.relatedPaths instanceof Set ? context.relatedPaths : new Set();
  let score = 0;
  if (activeFile && relPath === activeFile) score += 8;
  if (openTabs.includes(relPath)) score += 5;
  if (relatedPaths.has(relPath)) score += 4;
  score += directoryDistance(activeFile, relPath);
  score += domainBiasScore(relPath, context.profile);
  return score;
}

export function createRepoIndex({ projectRoot, resolveWithinRoot, lspClient = null }) {
  const ripgrepEnabled = hasRipgrep();
  let cache = null;
  let lastError = null;

  async function buildIndex(force = false) {
    if (!force && cache && Date.now() - cache.builtAtMs < INDEX_TTL_MS) return cache;
    try {
      const files = listProjectFiles(projectRoot, ripgrepEnabled);
      const fileSet = new Set(files);
      const entries = files.map((relPath) => {
        const fullPath = resolveWithinRoot(relPath);
        const stat = fullPath && fs.existsSync(fullPath) ? fs.statSync(fullPath) : null;
        const ext = path.extname(relPath).toLowerCase();
        const content = CODE_EXTENSIONS.has(ext) && fullPath ? safeReadUtf8(fullPath) : '';
        const tsSymbols = content ? extractSymbolEntries(relPath, content) : [];
        const treeSitterSymbols = content ? extractTreeSitterSymbols(relPath, content) : [];
        return {
          path: relPath,
          ext,
          size: stat?.size ?? 0,
          mtimeMs: stat?.mtimeMs ?? 0,
          symbols: mergeSymbolEntries(treeSitterSymbols, tsSymbols),
          imports: content
            ? extractImportEntries(relPath, content)
                .map((specifier) => resolveImportTarget(relPath, specifier, fileSet))
                .filter(Boolean)
            : [],
        };
      });

      const importedByMap = new Map();
      for (const entry of entries) {
        for (const imported of entry.imports) {
          if (!importedByMap.has(imported)) importedByMap.set(imported, new Set());
          importedByMap.get(imported).add(entry.path);
        }
      }

      const lspStatus = lspClient ? await lspClient.getStatus() : null;
      cache = {
        builtAt: new Date().toISOString(),
        builtAtMs: Date.now(),
        fileCount: entries.length,
        capabilities: {
          ripgrep: ripgrepEnabled,
          typescriptAst: true,
          treeSitter: TREE_SITTER_ENABLED,
          lsp: Boolean(lspStatus?.available),
        },
        entries,
        importedByMap,
      };
      lastError = null;
      return cache;
    } catch (error) {
      lastError = error?.message || 'index_build_failed';
      throw error;
    }
  }

  async function searchText(query, context = {}, limit = 25) {
    const normalized = String(query || '').trim();
    if (!normalized) return [];
    const index = await buildIndex(false);
    const rankingContext = {
      ...context,
      relatedPaths: createRelatedPathSet(index, context),
    };

    if (ripgrepEnabled) {
      try {
        const args = ['-n', '--no-heading', '--color', 'never', normalized, '.'];
        for (const excluded of EXCLUDED_SEGMENTS) {
          args.push('--glob', `!${excluded}/**`);
        }
        const stdout = execFileSync('rg', args, {
          cwd: projectRoot,
          encoding: 'utf8',
          windowsHide: true,
        });

        return stdout
          .split(/\r?\n/)
          .map((line) => {
            const match = line.match(/^(.+?):(\d+):(.*)$/);
            if (!match) return null;
            const relPath = toPosix(match[1]);
            return {
              path: relPath,
              line: Number(match[2]),
              snippet: match[3].trim(),
              score: 10 + rankPath(relPath, rankingContext),
            };
          })
          .filter(Boolean)
          .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
          .slice(0, limit);
      } catch {
        // fall through to the in-memory index path
      }
    }

    return index.entries
      .map((entry) => {
        const fullPath = resolveWithinRoot(entry.path);
        if (!fullPath || !fs.existsSync(fullPath)) return null;
        const content = safeReadUtf8(fullPath);
        const lower = content.toLowerCase();
        const q = normalized.toLowerCase();
        const contentIndex = lower.indexOf(q);
        const pathHit = entry.path.toLowerCase().includes(q);
        if (!pathHit && contentIndex === -1) return null;
        return {
          path: entry.path,
          line: 0,
          snippet: contentIndex === -1 ? '' : content.slice(Math.max(0, contentIndex - 80), Math.min(content.length, contentIndex + q.length + 80)),
          score: (pathHit ? 4 : 0) + (contentIndex !== -1 ? 2 : 0) + rankPath(entry.path, rankingContext),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
      .slice(0, limit);
  }

  async function findSymbol(query, context = {}, limit = 25) {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) return [];
    const index = await buildIndex(false);
    const rankingContext = {
      ...context,
      relatedPaths: createRelatedPathSet(index, context),
    };
    const localResults = index.entries
      .flatMap((entry) =>
        entry.symbols.map((symbol) => ({
          path: entry.path,
          symbol: symbol.name,
          kind: symbol.kind,
          score: (symbol.name.toLowerCase().includes(normalized) ? 8 : 0) + rankPath(entry.path, rankingContext),
        })),
      )
      .filter((entry) => entry.symbol.toLowerCase().includes(normalized))
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

    let lspResults = [];
    if (lspClient?.isEnabled()) {
      try {
        lspResults = (await lspClient.workspaceSymbol(normalized)).map((entry) => ({
          path: entry.path,
          symbol: entry.symbol,
          kind: `LSP:${entry.kind}`,
          line: entry.line,
          column: entry.column,
          score: 12 + rankPath(entry.path, rankingContext),
        }));
      } catch {
        lspResults = [];
      }
    }

    const deduped = new Map();
    for (const entry of [...lspResults, ...localResults]) {
      const key = `${entry.path}:${entry.symbol}`;
      if (!deduped.has(key)) deduped.set(key, entry);
    }

    return Array.from(deduped.values())
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
      .slice(0, limit);
  }

  return {
    async getStatus() {
      const lspStatus = lspClient ? await lspClient.getStatus() : null;
      const index = cache;
      return {
        ready: Boolean(index),
        builtAt: index?.builtAt ?? null,
        fileCount: index?.fileCount ?? 0,
        capabilities: {
          ripgrep: ripgrepEnabled,
          typescriptAst: true,
          treeSitter: TREE_SITTER_ENABLED,
          lsp: Boolean(lspStatus?.available),
          lspReady: Boolean(lspStatus?.ready),
        },
        stale: index ? Date.now() - index.builtAtMs > INDEX_TTL_MS : true,
        lastError,
      };
    },
    async rebuild() {
      await buildIndex(true);
      return this.getStatus();
    },
    buildIndex,
    searchText,
    findSymbol,
  };
}
