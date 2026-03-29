import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { runRuntime, stopRuntimeCommand } from './runtime.js';
import { writeUpstashJson, readUpstashJson, deleteUpstashKey } from './upstash-state.js';
import { inspectManifestRisk, inspectCommandRisk } from './socket-risk.js';

const PATCH_TTL_SECONDS = 60 * 60 * 4;
const DANGEROUS_COMMAND_RE = /\b(rm\s+-rf|del\s+\/s|format\s+[a-z]:|mkfs|shutdown|reboot|restart|git\s+reset\s+--hard|git\s+checkout\s+--)\b/i;

function toPosixPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function normalizeWorkspaceContext(context = {}) {
  const openFiles = new Map();
  for (const entry of context?.openFiles || []) {
    const filePath = toPosixPath(entry?.path);
    if (!filePath) continue;
    openFiles.set(filePath, {
      path: filePath,
      content: typeof entry?.content === 'string' ? entry.content : '',
    });
  }

  return {
    activeFile: toPosixPath(context?.activeFile),
    openTabs: Array.isArray(context?.openTabs) ? context.openTabs.map(toPosixPath).filter(Boolean) : [],
    selection: context?.selection || null,
    diagnostics: Array.isArray(context?.diagnostics) ? context.diagnostics : [],
    profile: context?.profile || null,
    openFiles,
  };
}

function countLines(text) {
  if (!text) return 0;
  return String(text).split('\n').length;
}

function diffWindow(before, after) {
  const beforeLines = String(before || '').split('\n');
  const afterLines = String(after || '').split('\n');

  let prefix = 0;
  while (
    prefix < beforeLines.length &&
    prefix < afterLines.length &&
    beforeLines[prefix] === afterLines[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < beforeLines.length - prefix &&
    suffix < afterLines.length - prefix &&
    beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const beforeChanged = Math.max(0, beforeLines.length - prefix - suffix);
  const afterChanged = Math.max(0, afterLines.length - prefix - suffix);

  return {
    startLine: prefix + 1,
    beforeLineCount: beforeChanged,
    afterLineCount: afterChanged,
    beforeExcerpt: beforeLines.slice(prefix, prefix + Math.min(beforeChanged || 1, 20)).join('\n'),
    afterExcerpt: afterLines.slice(prefix, prefix + Math.min(afterChanged || 1, 20)).join('\n'),
    stats: {
      added: Math.max(0, afterLines.length - beforeLines.length),
      removed: Math.max(0, beforeLines.length - afterLines.length),
      changed: Math.max(beforeChanged, afterChanged),
      beforeLines: beforeLines.length,
      afterLines: afterLines.length,
    },
  };
}

function buildPatchSet({ file, before, after, approvalPolicy = 'review_required', verification = null }) {
  const patchId = `patch_${randomUUID()}`;
  const hunk = diffWindow(before, after);
  return {
    patchId,
    createdAt: new Date().toISOString(),
    approvalPolicy,
    status: 'preview',
    verification,
    files: [
      {
        path: toPosixPath(file),
        kind: 'replace',
        before,
        after,
        stats: hunk.stats,
        hunks: [
          {
            kind: 'replace',
            startLine: hunk.startLine,
            beforeLineCount: hunk.beforeLineCount,
            afterLineCount: hunk.afterLineCount,
            beforeExcerpt: hunk.beforeExcerpt,
            afterExcerpt: hunk.afterExcerpt,
          },
        ],
      },
    ],
  };
}

function createSearchResults(query, items, limit = 25) {
  const normalized = String(query || '').toLowerCase().trim();
  if (!normalized) return [];
  return items
    .map((item) => {
      const pathHit = item.path.toLowerCase().includes(normalized) ? 2 : 0;
      const contentIndex = item.content.toLowerCase().indexOf(normalized);
      if (!pathHit && contentIndex === -1) return null;
      const snippet =
        contentIndex === -1
          ? ''
          : item.content.slice(Math.max(0, contentIndex - 80), Math.min(item.content.length, contentIndex + normalized.length + 80));
      return {
        path: item.path,
        score: pathHit + (contentIndex !== -1 ? 1 : 0),
        snippet,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, limit);
}

function normalizePermissionGrant(grant = {}) {
  return {
    read: grant.read !== false,
    write: Boolean(grant.write || grant.approved),
    exec: Boolean(grant.exec || grant.approved),
    riskyExec: Boolean(grant.riskyExec),
    source: String(grant.source || 'none'),
  };
}

function assertToolPermission(tool, input, permissionGrant) {
  if (tool.permission === 'read') return;
  if (tool.permission === 'write' && !permissionGrant.write) {
    throw new Error(`${tool.name} requires explicit write approval`);
  }
  if (tool.permission === 'exec' && !permissionGrant.exec) {
    throw new Error(`${tool.name} requires explicit exec approval`);
  }
  if (tool.permission === 'exec' && DANGEROUS_COMMAND_RE.test(String(input.command || '')) && !permissionGrant.riskyExec) {
    throw new Error(`${tool.name} blocked a risky command without elevated approval`);
  }
}

export function createToolRegistry({
  projectRoot,
  resolveWithinRoot,
  getFileTree,
  flattenFileTree,
  atomicWrite,
  allowLocalRuntime,
  resolveRuntimeCwd,
  isImageFile,
  isBinaryBuffer,
  getTaskSnapshot = () => [],
  lspClient = null,
  repoIndex = null,
  verificationService = null,
}) {
  const patchCache = new Map();

  async function persistPatchSet(patchSet) {
    patchCache.set(patchSet.patchId, patchSet);
    await writeUpstashJson(`kautilya:patch:${patchSet.patchId}`, patchSet, PATCH_TTL_SECONDS);
  }

  async function loadPatchSet(patchId) {
    if (!patchId) return null;
    if (patchCache.has(patchId)) return patchCache.get(patchId);
    const fromUpstash = await readUpstashJson(`kautilya:patch:${patchId}`);
    if (fromUpstash) patchCache.set(patchId, fromUpstash);
    return fromUpstash;
  }

  async function deletePatchSet(patchId) {
    if (!patchId) return;
    patchCache.delete(patchId);
    await deleteUpstashKey(`kautilya:patch:${patchId}`);
  }

  function readProjectFile(relPath, context, { allowMissing = false } = {}) {
    const normalizedPath = toPosixPath(relPath);
    const inEditor = context.openFiles.get(normalizedPath);
    if (inEditor) {
      return {
        kind: 'text',
        path: normalizedPath,
        content: inEditor.content,
        source: 'editor',
      };
    }

    const fullPath = resolveWithinRoot(normalizedPath);
    if (!fullPath) {
      throw new Error('Access denied');
    }
    if (!fs.existsSync(fullPath)) {
      if (allowMissing) {
        return {
          kind: 'text',
          path: normalizedPath,
          content: '',
          source: 'missing',
        };
      }
      throw new Error('File not found');
    }
    if (fs.statSync(fullPath).isDirectory()) {
      throw new Error('Cannot open a folder in the editor');
    }
    if (isImageFile(fullPath)) {
      return {
        kind: 'image',
        path: normalizedPath,
        url: `/api/fs/raw?path=${encodeURIComponent(normalizedPath)}`,
        source: 'disk',
      };
    }
    const buffer = fs.readFileSync(fullPath);
    if (isBinaryBuffer(buffer)) {
      return {
        kind: 'binary',
        path: normalizedPath,
        content: '',
        message: 'Binary files cannot be edited in the code editor.',
        source: 'disk',
      };
    }
    return {
      kind: 'text',
      path: normalizedPath,
      content: buffer.toString('utf-8'),
      source: 'disk',
    };
  }

  async function applyPatchSet({ patchSet, force = false }) {
    if (!patchSet?.files?.length) {
      throw new Error('Patch set is empty');
    }

    const applied = [];
    for (const file of patchSet.files) {
      const relPath = toPosixPath(file.path);
      const fullPath = resolveWithinRoot(relPath);
      if (!fullPath) throw new Error(`Access denied for ${relPath}`);

      const current = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf-8') : '';
      if (!force && typeof file.before === 'string' && current !== file.before) {
        throw new Error(`Patch conflict for ${relPath}`);
      }

      atomicWrite(fullPath, file.after || '');
      applied.push({
        path: relPath,
        bytes: Buffer.byteLength(file.after || '', 'utf-8'),
      });
    }

    const finalized = {
      ...patchSet,
      status: 'applied',
      appliedAt: new Date().toISOString(),
    };

    if (patchSet.patchId) {
      patchCache.set(patchSet.patchId, finalized);
      await writeUpstashJson(`kautilya:patch:${patchSet.patchId}`, finalized, PATCH_TTL_SECONDS);
    }

    return {
      success: true,
      patchId: patchSet.patchId,
      applied,
      patchSet: finalized,
    };
  }

  const schema = [
    { name: 'list_files', permission: 'read', description: 'List workspace files and folders.', inputSchema: { path: 'string?', recursive: 'boolean?', limit: 'number?' } },
    { name: 'read_file', permission: 'read', description: 'Read a workspace file, preferring editor content when available.', inputSchema: { path: 'string' } },
    { name: 'search_text', permission: 'read', description: 'Search file names and text content in the workspace.', inputSchema: { query: 'string', limit: 'number?' } },
    { name: 'find_symbol', permission: 'read', description: 'Search indexed JS/TS symbols in the workspace.', inputSchema: { query: 'string', limit: 'number?' } },
    { name: 'read_open_tabs', permission: 'read', description: 'Read the current open-tab context from the editor.', inputSchema: {} },
    { name: 'read_selection', permission: 'read', description: 'Read the current editor selection context.', inputSchema: {} },
    { name: 'get_diagnostics', permission: 'read', description: 'Read current diagnostics from the backend or forwarded editor context.', inputSchema: { file: 'string?' } },
    { name: 'get_index_status', permission: 'read', description: 'Read repo index readiness and capabilities.', inputSchema: {} },
    { name: 'rebuild_index', permission: 'read', description: 'Force a repo index rebuild and return the latest status.', inputSchema: {} },
    { name: 'apply_patch_preview', permission: 'write', description: 'Create a structured patch preview for a file update.', inputSchema: { file: 'string', before: 'string?', after: 'string', approvalPolicy: 'string?' } },
    { name: 'apply_patch_apply', permission: 'write', description: 'Apply a previously created patch set.', inputSchema: { patchId: 'string?', patchSet: 'object?', force: 'boolean?', verify: 'boolean?' } },
    { name: 'verify_workspace', permission: 'exec', description: 'Run deterministic verification checks against the current workspace.', inputSchema: { file: 'string?', includeTests: 'boolean?', includeSemgrep: 'boolean?' } },
    { name: 'run_command', permission: 'exec', description: 'Run a command through the runtime execution backend.', inputSchema: { command: 'string', cwd: 'string?', runtimeMode: 'string?' } },
    { name: 'stream_command', permission: 'exec', description: 'Describe how to stream a command through the runtime transport.', inputSchema: { command: 'string', cwd: 'string?', runtimeMode: 'string?' } },
    { name: 'stop_command', permission: 'exec', description: 'Stop a running command by command id.', inputSchema: { commandId: 'string' } },
    { name: 'list_agent_tasks', permission: 'read', description: 'List current agent and runtime tasks.', inputSchema: {} },
  ];

  return {
    getToolSchema() {
      return schema;
    },

    async executeTool({ name, input = {}, context = {} }) {
      const workspaceContext = normalizeWorkspaceContext(context);
      const tool = schema.find((entry) => entry.name === name);
      if (!tool) throw new Error(`Unknown tool: ${name}`);
      const permissionGrant = normalizePermissionGrant(context.permissionGrant);
      assertToolPermission(tool, input, permissionGrant);

      if (name === 'list_files') {
        const tree = getFileTree(projectRoot);
        const flat = flattenFileTree(tree);
        const limit = Math.max(1, Math.min(Number(input.limit) || 200, 1000));
        return {
          tree,
          files: flat.slice(0, limit),
        };
      }

      if (name === 'read_file') {
        return readProjectFile(input.path, workspaceContext, {
          allowMissing: Boolean(input.allowMissing),
        });
      }

      if (name === 'search_text') {
        if (repoIndex) {
          return {
            results: await repoIndex.searchText(input.query, workspaceContext, Math.max(1, Math.min(Number(input.limit) || 25, 200))),
          };
        }
        const tree = getFileTree(projectRoot);
        const flat = flattenFileTree(tree).slice(0, 1000);
        const items = flat
          .map((entry) => {
            try {
              const fullPath = resolveWithinRoot(entry.path);
              if (!fullPath || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) return null;
              const buffer = fs.readFileSync(fullPath);
              if (isBinaryBuffer(buffer)) return null;
              return {
                path: entry.path,
                content: buffer.toString('utf-8').slice(0, 20000),
              };
            } catch {
              return null;
            }
          })
          .filter(Boolean);
        return {
          results: createSearchResults(input.query, items, Math.max(1, Math.min(Number(input.limit) || 25, 200))),
        };
      }

      if (name === 'find_symbol') {
        return {
          results: repoIndex
            ? await repoIndex.findSymbol(input.query, workspaceContext, Math.max(1, Math.min(Number(input.limit) || 25, 200)))
            : [],
        };
      }

      if (name === 'read_open_tabs') {
        return {
          activeFile: workspaceContext.activeFile,
          openTabs: workspaceContext.openTabs,
          openFiles: Array.from(workspaceContext.openFiles.values()),
        };
      }

      if (name === 'read_selection') {
        return {
          selection: workspaceContext.selection,
        };
      }

      if (name === 'get_diagnostics') {
        const diagnosticFile = toPosixPath(input.file || workspaceContext.activeFile || '');
        if ((!workspaceContext.diagnostics || workspaceContext.diagnostics.length === 0) && lspClient?.isEnabled() && diagnosticFile) {
          const editorFile = workspaceContext.openFiles.get(diagnosticFile);
          const lspDiagnostics = await lspClient.getDiagnostics({
            filePath: diagnosticFile,
            content: editorFile?.content,
          });
          if (lspDiagnostics.length > 0) {
            return {
              diagnostics: lspDiagnostics,
              source: 'lsp',
            };
          }
        }
        if ((!workspaceContext.diagnostics || workspaceContext.diagnostics.length === 0) && verificationService) {
          return verificationService.getDiagnostics({ file: input.file || workspaceContext.activeFile || '' });
        }
        return {
          diagnostics: workspaceContext.diagnostics,
        };
      }

      if (name === 'get_index_status') {
        return repoIndex
          ? repoIndex.getStatus()
          : {
            ready: false,
            builtAt: null,
            fileCount: 0,
            capabilities: {
              ripgrep: false,
              typescriptAst: false,
              treeSitter: false,
              lsp: false,
            },
          };
      }

      if (name === 'rebuild_index') {
        return repoIndex
          ? repoIndex.rebuild()
          : {
            ready: false,
            builtAt: null,
            fileCount: 0,
            capabilities: {
              ripgrep: false,
              typescriptAst: false,
              treeSitter: false,
              lsp: false,
            },
          };
      }

      if (name === 'apply_patch_preview') {
        const file = toPosixPath(input.file);
        if (!file) throw new Error('file required');
        const before =
          typeof input.before === 'string'
            ? input.before
            : readProjectFile(file, workspaceContext, { allowMissing: true }).content || '';
        const after = typeof input.after === 'string' ? input.after : '';
        const verification = await inspectManifestRisk({
          filePath: file,
          beforeContent: before,
          afterContent: after,
        });
        const patchSet = buildPatchSet({
          file,
          before,
          after,
          approvalPolicy: input.approvalPolicy || 'review_required',
          verification,
        });
        await persistPatchSet(patchSet);
        return patchSet;
      }

      if (name === 'apply_patch_apply') {
        const patchSet = input.patchSet || (await loadPatchSet(input.patchId));
        if (!patchSet) throw new Error('Patch set not found');
        if (patchSet.verification?.blocked && !input.overrideRisk) {
          return {
            success: false,
            blocked: true,
            reason: 'dependency_risk',
            verificationReport: {
              overall: 'failed',
              checks: [
                {
                  name: 'socket',
                  status: 'failed',
                  output: '',
                  error: patchSet.verification.warning || 'Dependency risk flagged by Socket verification.',
                },
              ],
            },
            patchSet,
          };
        }
        let verificationReport = null;
        if (input.verify !== false && verificationService) {
          verificationReport = await verificationService.verifyPatchSet(patchSet);
          if (verificationReport.overall === 'failed') {
            return {
              success: false,
              blocked: true,
              reason: 'verification_failed',
              verificationReport,
              patchSet,
            };
          }
        }
        const applied = await applyPatchSet({
          patchSet,
          force: Boolean(input.force),
        });
        await deletePatchSet(patchSet.patchId);
        return {
          ...applied,
          verificationReport,
        };
      }

      if (name === 'verify_workspace') {
        if (!verificationService) {
          return {
            overall: 'unavailable',
            checks: [],
            diagnostics: [],
          };
        }
        return verificationService.verifyWorkspace({
          file: input.file || workspaceContext.activeFile || '',
          includeTests: input.includeTests !== false,
          includeSemgrep: input.includeSemgrep !== false,
        });
      }

      if (name === 'run_command') {
        const command = String(input.command || '').trim();
        if (!command) throw new Error('command required');
        const runtimeCwd = resolveRuntimeCwd(input.cwd);
        if (!runtimeCwd) throw new Error('Invalid working directory');
        const commandId = randomUUID();
        const commandRisk = inspectCommandRisk(command);
        const result = await runRuntime({
          command,
          cwd: runtimeCwd,
          runtimeMode: input.runtimeMode || 'auto',
          allowLocal: allowLocalRuntime(),
          commandId,
        });
        return {
          ...result,
          commandRisk,
        };
      }

      if (name === 'stream_command') {
        const command = String(input.command || '').trim();
        if (!command) throw new Error('command required');
        const runtimeCwd = resolveRuntimeCwd(input.cwd);
        if (!runtimeCwd) throw new Error('Invalid working directory');
        return {
          streamable: true,
          transport: {
            endpoint: '/api/runtime/stream',
            method: 'POST',
            body: {
              command,
              cwd: runtimeCwd,
              runtimeMode: input.runtimeMode || 'auto',
            },
          },
          commandRisk: inspectCommandRisk(command),
        };
      }

      if (name === 'stop_command') {
        return stopRuntimeCommand(String(input.commandId || ''));
      }

      if (name === 'list_agent_tasks') {
        return {
          tasks: getTaskSnapshot(),
        };
      }
    },
  };
}
