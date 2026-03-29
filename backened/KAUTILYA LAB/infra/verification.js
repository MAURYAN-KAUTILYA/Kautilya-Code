import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { execFile, spawnSync } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const NPX_CMD = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const NPM_CMD = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const SEMGREP_CMD = process.platform === 'win32' ? 'semgrep.exe' : 'semgrep';
const VERIFY_ROOT = '.kautilya-verify';
const EXCLUDED_SEGMENTS = ['node_modules', '.git', 'dist', VERIFY_ROOT];

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function shouldIgnore(relPath) {
  const normalized = toPosix(relPath);
  return EXCLUDED_SEGMENTS.some((segment) => normalized === segment || normalized.startsWith(`${segment}/`));
}

function listProjectFiles(projectRoot) {
  const files = [];
  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = toPosix(path.relative(projectRoot, fullPath));
      if (!relPath || shouldIgnore(relPath)) continue;
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      files.push(relPath);
    }
  }
  walk(projectRoot);
  return files;
}

function parsePackageScripts(projectRoot) {
  const packagePath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(packagePath)) return {};
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return pkg.scripts || {};
  } catch {
    return {};
  }
}

function hasSemgrep() {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(cmd, [SEMGREP_CMD], { encoding: 'utf8' });
  return result.status === 0;
}

function normalizeCheckResult(name, status, output = '', error = '') {
  return {
    name,
    status,
    output: String(output || '').slice(0, 16000),
    error: String(error || '').slice(0, 4000),
  };
}

async function runExecFile(file, args, cwd, timeout = 120000) {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      cwd,
      windowsHide: true,
      timeout,
      env: process.env,
      maxBuffer: 1024 * 1024 * 16,
    });
    return {
      status: 'passed',
      stdout: stdout || '',
      stderr: stderr || '',
    };
  } catch (error) {
    return {
      status: 'failed',
      stdout: error?.stdout || '',
      stderr: error?.stderr || '',
      error: error?.message || 'command_failed',
    };
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function copyWorkspaceSnapshot(projectRoot, targetDir) {
  ensureDir(targetDir);
  for (const relPath of listProjectFiles(projectRoot)) {
    const src = path.join(projectRoot, relPath);
    const dest = path.join(targetDir, relPath);
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

function writePatchSet(targetDir, patchSet) {
  for (const file of patchSet?.files || []) {
    const fullPath = path.join(targetDir, toPosix(file.path));
    ensureDir(path.dirname(fullPath));
    fs.writeFileSync(fullPath, file.after || '', 'utf8');
  }
}

function parseDiagnostics(text, fileFilter = '') {
  const normalizedFilter = toPosix(fileFilter);
  const lines = String(text || '').split(/\r?\n/);
  const diagnostics = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let match = trimmed.match(/^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s*([A-Z0-9_-]+)?:?\s*(.*)$/i);
    if (!match) {
      match = trimmed.match(/^(.+?):(\d+):(\d+):\s*(error|warning)\s*(.*)$/i);
    }
    if (!match) continue;

    const filePath = toPosix(match[1]);
    if (normalizedFilter && filePath !== normalizedFilter && !filePath.endsWith(normalizedFilter)) continue;
    diagnostics.push({
      file: filePath,
      line: Number(match[2]),
      column: Number(match[3]),
      level: String(match[4] || 'info').toLowerCase(),
      message: (match[6] || match[5] || '').trim(),
      raw: trimmed,
    });
  }

  return diagnostics.slice(0, 200);
}

export function createVerificationService({ projectRoot }) {
  const scripts = parsePackageScripts(projectRoot);
  const semgrepAvailable = hasSemgrep();

  async function runChecks(cwd, { includeTests = true, includeSemgrep = true } = {}) {
    const checks = [];

    if (fs.existsSync(path.join(cwd, 'tsconfig.json'))) {
      const tsc = await runExecFile(NPX_CMD, ['tsc', '-b', '--pretty', 'false'], cwd);
      checks.push(normalizeCheckResult('tsc', tsc.status, tsc.stdout, tsc.stderr || tsc.error));
    } else {
      checks.push(normalizeCheckResult('tsc', 'skipped', '', 'tsconfig.json not found'));
    }

    if (scripts.lint) {
      const lint = await runExecFile(NPM_CMD, ['run', 'lint'], cwd);
      checks.push(normalizeCheckResult('lint', lint.status, lint.stdout, lint.stderr || lint.error));
    } else {
      checks.push(normalizeCheckResult('lint', 'skipped', '', 'lint script missing'));
    }

    if (includeTests && scripts.test) {
      const tests = await runExecFile(NPM_CMD, ['run', 'test'], cwd);
      checks.push(normalizeCheckResult('test', tests.status, tests.stdout, tests.stderr || tests.error));
    } else {
      checks.push(normalizeCheckResult('test', 'skipped', '', scripts.test ? 'tests skipped by policy' : 'test script missing'));
    }

    if (includeSemgrep && semgrepAvailable) {
      const semgrep = await runExecFile(SEMGREP_CMD, ['--config', 'auto', '--error', '--quiet', '.'], cwd);
      checks.push(normalizeCheckResult('semgrep', semgrep.status, semgrep.stdout, semgrep.stderr || semgrep.error));
    } else {
      checks.push(normalizeCheckResult('semgrep', semgrepAvailable ? 'skipped' : 'unavailable', '', semgrepAvailable ? 'semgrep skipped by policy' : 'semgrep not installed'));
    }

    const failing = checks.filter((check) => check.status === 'failed');
    return {
      overall: failing.length ? 'failed' : 'passed',
      checks,
    };
  }

  return {
    async verifyWorkspace({ file = '', includeTests = true, includeSemgrep = true } = {}) {
      const report = await runChecks(projectRoot, { includeTests, includeSemgrep });
      return {
        ...report,
        diagnostics: report.checks.flatMap((check) => parseDiagnostics(`${check.output}\n${check.error}`, file)),
      };
    },

    async verifyPatchSet(patchSet) {
      const verifyDir = path.join(projectRoot, VERIFY_ROOT, randomUUID());
      try {
        copyWorkspaceSnapshot(projectRoot, verifyDir);
        writePatchSet(verifyDir, patchSet);
        const report = await runChecks(verifyDir, { includeTests: true, includeSemgrep: true });
        return {
          ...report,
          changedFiles: (patchSet?.files || []).map((file) => toPosix(file.path)),
        };
      } finally {
        fs.rmSync(verifyDir, { recursive: true, force: true });
      }
    },

    async getDiagnostics({ file } = {}) {
      return this.verifyWorkspace({ file, includeTests: false, includeSemgrep: true });
    },
  };
}
