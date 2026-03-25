import fs from 'fs';
import path from 'path';

const JS_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

export function flattenFileTree(tree, base = '') {
  const results = [];
  if (!Array.isArray(tree)) return results;
  for (const node of tree) {
    if (!node) continue;
    const id = node.id || node.path || node.name || '';
    const relPath = id.startsWith(base) ? id : id;
    if (node.type === 'file') {
      results.push({ path: relPath, size: node.size || 0 });
    } else if (node.type === 'folder' && Array.isArray(node.children)) {
      results.push(...flattenFileTree(node.children, base));
    }
  }
  return results;
}

function tokenize(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9_/-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
  );
}

function scorePath(filePath, tokens) {
  const parts = filePath.toLowerCase().split(/[\\/]/g);
  let score = 0;
  for (const part of parts) {
    if (tokens.has(part)) score += 3;
    const stem = part.replace(/\.[^/.]+$/, '');
    if (tokens.has(stem)) score += 2;
  }
  for (const token of tokens) {
    if (filePath.toLowerCase().includes(token)) score += 1;
  }
  return score;
}

export function selectRelevantFiles(message, fileList, max = 8) {
  const tokens = tokenize(message);
  const scored = fileList
    .map(f => ({ ...f, score: scorePath(f.path, tokens) }))
    .filter(f => f.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map(f => f.path);
}

export function buildImportGraph(rootDir, fileList) {
  const graph = new Map();
  const maxFiles = Math.min(fileList.length, 400);
  for (const file of fileList.slice(0, maxFiles)) {
    const ext = path.extname(file.path);
    if (!JS_EXTS.has(ext)) continue;
    const fullPath = path.join(rootDir, file.path);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf-8');
    const deps = extractImports(content)
      .map(p => resolveImport(rootDir, file.path, p))
      .filter(Boolean);
    graph.set(file.path, deps);
  }
  return graph;
}

function extractImports(content) {
  const imports = new Set();
  const importRe = /from\s+['"]([^'"]+)['"]/g;
  const requireRe = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const dynamicRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = importRe.exec(content)) !== null) imports.add(match[1]);
  while ((match = requireRe.exec(content)) !== null) imports.add(match[1]);
  while ((match = dynamicRe.exec(content)) !== null) imports.add(match[1]);
  return Array.from(imports);
}

function resolveImport(rootDir, fromPath, importPath) {
  if (!importPath.startsWith('.')) return null;
  const baseDir = path.dirname(fromPath);
  const base = path.normalize(path.join(baseDir, importPath));
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),
  ];
  for (const candidate of candidates) {
    const abs = path.join(rootDir, candidate);
    if (fs.existsSync(abs)) return candidate;
  }
  return null;
}

export function expandWithDependencies(selected, graph, max = 8) {
  const expanded = new Set(selected);
  for (const file of selected) {
    const deps = graph.get(file) || [];
    for (const dep of deps) {
      if (expanded.size >= max) break;
      expanded.add(dep);
    }
    if (expanded.size >= max) break;
  }
  return Array.from(expanded);
}
