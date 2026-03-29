import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const REQUEST_TIMEOUT_MS = 15_000;

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function languageIdForFile(filePath) {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  switch (ext) {
    case '.ts':
      return 'typescript';
    case '.tsx':
      return 'typescriptreact';
    case '.jsx':
      return 'javascriptreact';
    case '.js':
    default:
      return 'javascript';
  }
}

function normalizeDiagnostics(uri, diagnostics = []) {
  const relPath = toPosix(path.relative(process.cwd(), fileURLToPath(uri)));
  return diagnostics.map((item) => ({
    file: relPath,
    line: Number(item?.range?.start?.line || 0) + 1,
    column: Number(item?.range?.start?.character || 0) + 1,
    endLine: Number(item?.range?.end?.line || 0) + 1,
    endColumn: Number(item?.range?.end?.character || 0) + 1,
    level: item?.severity === 1 ? 'error' : item?.severity === 2 ? 'warning' : 'info',
    message: String(item?.message || ''),
    source: item?.source ? String(item.source) : 'lsp',
    code: item?.code ? String(typeof item.code === 'object' ? item.code.value : item.code) : undefined,
  }));
}

export function createLspClient({ projectRoot, resolveWithinRoot }) {
  const serverEntry = path.join(projectRoot, 'node_modules', 'typescript-language-server', 'lib', 'cli.mjs');
  const tsserverPath = path.join(projectRoot, 'node_modules', 'typescript', 'lib', 'tsserver.js');
  const available = fs.existsSync(serverEntry) && fs.existsSync(tsserverPath);

  let proc = null;
  let startPromise = null;
  let initialized = false;
  let nextId = 1;
  let messageBuffer = '';
  let lastError = null;

  const openDocuments = new Map();
  const pendingRequests = new Map();
  const diagnosticsByUri = new Map();
  const diagnosticsWaiters = new Map();

  function cleanupProcess(errorMessage = 'lsp_process_ended') {
    for (const pending of pendingRequests.values()) {
      pending.reject(new Error(errorMessage));
    }
    pendingRequests.clear();
    openDocuments.clear();
    proc = null;
    initialized = false;
  }

  function writeMessage(message) {
    if (!proc?.stdin || proc.stdin.destroyed) {
      throw new Error('LSP process is not available');
    }
    const payload = JSON.stringify(message);
    proc.stdin.write(`Content-Length: ${Buffer.byteLength(payload, 'utf8')}\r\n\r\n${payload}`);
  }

  function handleMessage(message) {
    if (typeof message?.id !== 'undefined') {
      const pending = pendingRequests.get(message.id);
      if (!pending) return;
      pendingRequests.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message || 'lsp_request_failed'));
        return;
      }
      pending.resolve(message.result);
      return;
    }

    if (message?.method === 'textDocument/publishDiagnostics') {
      const uri = String(message.params?.uri || '');
      const diagnostics = Array.isArray(message.params?.diagnostics) ? message.params.diagnostics : [];
      diagnosticsByUri.set(uri, diagnostics);
      const waiters = diagnosticsWaiters.get(uri) || [];
      diagnosticsWaiters.delete(uri);
      for (const resolve of waiters) resolve(diagnostics);
    }
  }

  function parseStdout(chunk) {
    messageBuffer += chunk.toString('utf8');
    while (true) {
      const headerEnd = messageBuffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      const header = messageBuffer.slice(0, headerEnd);
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) {
        messageBuffer = '';
        return;
      }
      const contentLength = Number(lengthMatch[1]);
      const totalLength = headerEnd + 4 + contentLength;
      if (messageBuffer.length < totalLength) return;
      const body = messageBuffer.slice(headerEnd + 4, totalLength);
      messageBuffer = messageBuffer.slice(totalLength);
      try {
        handleMessage(JSON.parse(body));
      } catch {
        // Ignore malformed LSP payloads.
      }
    }
  }

  function request(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`${method} timed out`));
      }, REQUEST_TIMEOUT_MS);
      pendingRequests.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
      writeMessage({
        jsonrpc: '2.0',
        id,
        method,
        params,
      });
    });
  }

  function notify(method, params) {
    writeMessage({
      jsonrpc: '2.0',
      method,
      params,
    });
  }

  async function ensureStarted() {
    if (!available) return false;
    if (initialized && proc && !proc.killed) return true;
    if (startPromise) return startPromise;

    startPromise = (async () => {
      const child = spawn(process.execPath, [serverEntry, '--stdio'], {
        cwd: projectRoot,
        windowsHide: true,
        env: {
          ...process.env,
          TSSERVER_PATH: tsserverPath,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      proc = child;
      child.stdout.on('data', parseStdout);
      child.stderr.on('data', (chunk) => {
        const text = chunk.toString('utf8').trim();
        if (text) lastError = text;
      });
      child.on('error', (error) => {
        lastError = error?.message || 'lsp_spawn_failed';
        cleanupProcess(lastError);
      });
      child.on('exit', (code) => {
        cleanupProcess(lastError || `lsp_exit_${code ?? 'unknown'}`);
      });

      const rootUri = pathToFileURL(projectRoot).href;
      await request('initialize', {
        processId: process.pid,
        rootUri,
        capabilities: {},
        workspaceFolders: [
          {
            uri: rootUri,
            name: path.basename(projectRoot),
          },
        ],
        initializationOptions: {},
      });
      initialized = true;
      notify('initialized', {});
      return true;
    })();

    try {
      return await startPromise;
    } catch (error) {
      lastError = error?.message || 'lsp_initialize_failed';
      return false;
    } finally {
      startPromise = null;
    }
  }

  async function openDocument(filePath, content) {
    const fullPath = resolveWithinRoot(filePath) || (path.isAbsolute(filePath) ? filePath : null);
    if (!fullPath || !fs.existsSync(fullPath)) return null;
    if (!(await ensureStarted())) return null;

    const uri = pathToFileURL(fullPath).href;
    const nextVersion = (openDocuments.get(uri)?.version || 0) + 1;
    const text = typeof content === 'string' ? content : fs.readFileSync(fullPath, 'utf8');
    const languageId = languageIdForFile(fullPath);

    if (openDocuments.has(uri)) {
      notify('textDocument/didChange', {
        textDocument: {
          uri,
          version: nextVersion,
        },
        contentChanges: [{ text }],
      });
    } else {
      notify('textDocument/didOpen', {
        textDocument: {
          uri,
          languageId,
          version: nextVersion,
          text,
        },
      });
    }

    openDocuments.set(uri, {
      version: nextVersion,
      text,
      filePath: toPosix(filePath),
    });
    return uri;
  }

  async function waitForDiagnostics(uri, timeoutMs = 1500) {
    if (!uri) return [];
    return new Promise((resolve) => {
      const existing = diagnosticsByUri.get(uri);
      if (existing) {
        resolve(existing);
        return;
      }
      const timer = setTimeout(() => {
        const waiters = diagnosticsWaiters.get(uri) || [];
        diagnosticsWaiters.set(uri, waiters.filter((entry) => entry !== onDiagnostics));
        resolve(diagnosticsByUri.get(uri) || []);
      }, timeoutMs);
      const onDiagnostics = (diagnostics) => {
        clearTimeout(timer);
        resolve(diagnostics || []);
      };
      const waiters = diagnosticsWaiters.get(uri) || [];
      waiters.push(onDiagnostics);
      diagnosticsWaiters.set(uri, waiters);
    });
  }

  return {
    isEnabled() {
      return available;
    },

    async ensureStarted() {
      return ensureStarted();
    },

    async getStatus() {
      return {
        available,
        ready: initialized && Boolean(proc) && !proc.killed,
        openDocuments: openDocuments.size,
        lastError,
      };
    },

    async workspaceSymbol(query) {
      if (!(await ensureStarted())) return [];
      const result = await request('workspace/symbol', { query: String(query || '') });
      return Array.isArray(result)
        ? result.map((entry) => ({
          path: toPosix(path.relative(projectRoot, fileURLToPath(entry.location?.uri || pathToFileURL(projectRoot).href))),
          symbol: String(entry.name || ''),
          kind: Number(entry.kind || 0),
          line: Number(entry.location?.range?.start?.line || 0) + 1,
          column: Number(entry.location?.range?.start?.character || 0) + 1,
        }))
        : [];
    },

    async getDiagnostics({ filePath, content } = {}) {
      const relPath = toPosix(filePath);
      if (!relPath) return [];
      const uri = await openDocument(relPath, content);
      if (!uri) return [];
      const diagnostics = await waitForDiagnostics(uri);
      return normalizeDiagnostics(uri, diagnostics).map((entry) => ({
        ...entry,
        file: relPath,
      }));
    },
  };
}
