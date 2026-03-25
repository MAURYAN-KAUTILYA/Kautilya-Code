import { randomUUID } from 'crypto';
import { exec, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const E2B_API_KEY = process.env.E2B_API_KEY;
const E2B_API_URL = process.env.E2B_API_URL || '';
const runningCommands = new Map();

function normalizeRuntimeMode(mode = 'auto') {
  if (mode === 'sandbox' || mode === 'local') return mode;
  return 'auto';
}

function buildResult({
  commandId,
  runtime,
  stdout = '',
  stderr = '',
  error = null,
  code = 0,
  startedAt,
  finishedAt,
}) {
  return {
    commandId,
    runtime,
    stdout,
    stderr,
    error,
    code,
    startedAt,
    finishedAt,
  };
}

function execLocal(command, cwd = PROJECT_ROOT, commandId = randomUUID()) {
  const startedAt = new Date().toISOString();
  return new Promise((resolve) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      resolve(buildResult({
        commandId,
        runtime: 'local',
        stdout: stdout || '',
        stderr: stderr || '',
        error: error ? error.message : null,
        code: error ? error.code ?? 1 : 0,
        startedAt,
        finishedAt: new Date().toISOString(),
      }));
    });
  });
}

async function execE2B(command, cwd, commandId = randomUUID(), signal) {
  if (!E2B_API_KEY || !E2B_API_URL) return null;

  const startedAt = new Date().toISOString();
  try {
    const r = await fetch(`${E2B_API_URL.replace(/\/$/, '')}/exec`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${E2B_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command, cwd }),
      signal,
    });

    if (!r.ok) return null;
    const d = await r.json();
    return buildResult({
      commandId,
      runtime: 'e2b',
      stdout: d.stdout || '',
      stderr: d.stderr || '',
      error: d.error || null,
      code: d.code ?? 0,
      startedAt,
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      return buildResult({
        commandId,
        runtime: 'e2b',
        error: 'Command stopped.',
        code: 130,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
    }
    return null;
  }
}

function emit(onEvent, payload) {
  try {
    onEvent?.(payload);
  } catch {
    // Ignore consumer-side streaming errors.
  }
}

function canUseLocal(runtimeMode, allowLocal) {
  if (runtimeMode === 'local') return Boolean(allowLocal);
  return runtimeMode === 'auto' && Boolean(allowLocal);
}

async function tryE2B(command, cwd, commandId, runtimeMode, signal) {
  if (runtimeMode !== 'auto' && runtimeMode !== 'sandbox') return null;
  return execE2B(command, cwd, commandId, signal);
}

export async function runRuntime({
  command,
  cwd,
  allowLocal = true,
  runtimeMode = 'auto',
  commandId = randomUUID(),
}) {
  const normalizedMode = normalizeRuntimeMode(runtimeMode);

  const e2b = await tryE2B(command, cwd, commandId, normalizedMode);
  if (e2b) return e2b;

  if (normalizedMode === 'sandbox') {
    const timestamp = new Date().toISOString();
    return buildResult({
      commandId,
      runtime: 'none',
      error: 'Sandbox execution unavailable.',
      code: 1,
      startedAt: timestamp,
      finishedAt: timestamp,
    });
  }

  if (!canUseLocal(normalizedMode, allowLocal)) {
    const timestamp = new Date().toISOString();
    return buildResult({
      commandId,
      runtime: 'none',
      error: 'Local execution is disabled.',
      code: 1,
      startedAt: timestamp,
      finishedAt: timestamp,
    });
  }

  return execLocal(command, cwd, commandId);
}

export async function runRuntimeStream({
  command,
  cwd,
  allowLocal = true,
  runtimeMode = 'auto',
  commandId = randomUUID(),
  onEvent,
}) {
  const normalizedMode = normalizeRuntimeMode(runtimeMode);
  const startedAt = new Date().toISOString();

  if (normalizedMode === 'sandbox' || normalizedMode === 'auto') {
    if (E2B_API_KEY && E2B_API_URL) {
      const abortController = new AbortController();
      runningCommands.set(commandId, { kind: 'e2b', abortController });

      emit(onEvent, { type: 'start', commandId, runtime: 'e2b', startedAt });
      const result = await execE2B(command, cwd, commandId, abortController.signal);
      runningCommands.delete(commandId);

      if (!result) {
        if (normalizedMode === 'sandbox') {
          emit(onEvent, {
            type: 'error',
            commandId,
            runtime: 'none',
            message: 'Sandbox execution unavailable.',
            startedAt,
            finishedAt: new Date().toISOString(),
          });
          return { commandId, runtime: 'none' };
        }
      } else {
        if (result.stdout) emit(onEvent, { type: 'stdout', commandId, runtime: result.runtime, text: result.stdout });
        if (result.stderr) emit(onEvent, { type: 'stderr', commandId, runtime: result.runtime, text: result.stderr });
        if (result.error && result.code === 130) {
          emit(onEvent, {
            type: 'stopped',
            commandId,
            runtime: result.runtime,
            code: result.code,
            error: result.error,
            startedAt: result.startedAt,
            finishedAt: result.finishedAt,
          });
        } else if (result.error && !result.stdout && !result.stderr) {
          emit(onEvent, {
            type: 'error',
            commandId,
            runtime: result.runtime,
            message: result.error,
            code: result.code,
            startedAt: result.startedAt,
            finishedAt: result.finishedAt,
          });
        } else {
          emit(onEvent, {
            type: 'done',
            commandId,
            runtime: result.runtime,
            code: result.code,
            error: result.error,
            startedAt: result.startedAt,
            finishedAt: result.finishedAt,
          });
        }
        return { commandId, runtime: result.runtime };
      }
    } else if (normalizedMode === 'sandbox') {
      emit(onEvent, {
        type: 'error',
        commandId,
        runtime: 'none',
        message: 'Sandbox execution unavailable.',
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      return { commandId, runtime: 'none' };
    }
  }

  if (!canUseLocal(normalizedMode, allowLocal)) {
    emit(onEvent, {
      type: 'error',
      commandId,
      runtime: 'none',
      message: 'Local execution is disabled.',
      startedAt,
      finishedAt: new Date().toISOString(),
    });
    return { commandId, runtime: 'none' };
  }

  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
      env: process.env,
    });

    runningCommands.set(commandId, { kind: 'local', child });
    emit(onEvent, { type: 'start', commandId, runtime: 'local', startedAt });

    child.stdout.on('data', (chunk) => {
      emit(onEvent, {
        type: 'stdout',
        commandId,
        runtime: 'local',
        text: chunk.toString(),
      });
    });

    child.stderr.on('data', (chunk) => {
      emit(onEvent, {
        type: 'stderr',
        commandId,
        runtime: 'local',
        text: chunk.toString(),
      });
    });

    child.on('error', (error) => {
      runningCommands.delete(commandId);
      emit(onEvent, {
        type: 'error',
        commandId,
        runtime: 'local',
        message: error.message,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      resolve({ commandId, runtime: 'local' });
    });

    child.on('close', (code, signal) => {
      runningCommands.delete(commandId);
      const finishedAt = new Date().toISOString();
      if (signal) {
        emit(onEvent, {
          type: 'stopped',
          commandId,
          runtime: 'local',
          code: code ?? 130,
          signal,
          startedAt,
          finishedAt,
        });
      } else {
        emit(onEvent, {
          type: 'done',
          commandId,
          runtime: 'local',
          code: code ?? 0,
          startedAt,
          finishedAt,
        });
      }
      resolve({ commandId, runtime: 'local' });
    });
  });
}

export function stopRuntimeCommand(commandId) {
  const entry = runningCommands.get(commandId);
  if (!entry) return { stopped: false };

  if (entry.kind === 'local') {
    const stopped = entry.child.kill('SIGTERM');
    if (stopped) runningCommands.delete(commandId);
    return { stopped };
  }

  if (entry.kind === 'e2b') {
    entry.abortController.abort();
    runningCommands.delete(commandId);
    return { stopped: true };
  }

  return { stopped: false };
}
