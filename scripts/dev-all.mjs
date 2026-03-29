import net from 'node:net';
import process from 'node:process';
import { spawn } from 'node:child_process';
const childProcesses = [];
let shuttingDown = false;

function writePrefixedLine(target, name, line) {
  target.write(`[${name}] ${line}\n`);
}

function pipeWithPrefix(stream, name, target) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, '');
      buffer = buffer.slice(newlineIndex + 1);
      writePrefixedLine(target, name, line);
      newlineIndex = buffer.indexOf('\n');
    }
  });

  stream.on('end', () => {
    const tail = buffer.replace(/\r$/, '');
    if (tail) writePrefixedLine(target, name, tail);
  });
}

function terminateChildren(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of childProcesses) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 200).unref();
}

function spawnScript(name, scriptName, extraEnv = {}) {
  const child = spawn(`npm run ${scriptName}`, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
  });

  childProcesses.push(child);
  pipeWithPrefix(child.stdout, name, process.stdout);
  pipeWithPrefix(child.stderr, name, process.stderr);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const normalizedCode = typeof code === 'number' ? code : signal ? 1 : 0;
    const suffix = signal ? ` (signal ${signal})` : '';
    writePrefixedLine(
      normalizedCode === 0 ? process.stdout : process.stderr,
      name,
      `process exited with code ${normalizedCode}${suffix}`,
    );
    terminateChildren(normalizedCode);
  });

  child.on('error', (error) => {
    if (shuttingDown) return;
    writePrefixedLine(process.stderr, name, `failed to start: ${error.message}`);
    terminateChildren(1);
  });

  return child;
}

function waitForPort(name, port, timeoutMs = 45000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (shuttingDown) {
        reject(new Error(`${name} startup aborted`));
        return;
      }

      const socket = net.createConnection({ host: '127.0.0.1', port });
      let settled = false;

      const finish = (ready, error = null) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        if (ready) {
          resolve();
          return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          reject(error || new Error(`${name} did not open port ${port} in time`));
          return;
        }
        setTimeout(attempt, 300);
      };

      socket.once('connect', () => finish(true));
      socket.once('error', (error) => finish(false, error));
      socket.setTimeout(1200, () => finish(false, new Error(`${name} timed out while opening port ${port}`)));
    };

    attempt();
  });
}

function assertPortFree(name, port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    let settled = false;

    const finish = (isFree) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (isFree) {
        resolve();
        return;
      }
      reject(new Error(`${name} cannot start because port ${port} is already in use. Stop the old process and run dev:all again.`));
    };

    socket.once('connect', () => finish(false));
    socket.once('error', () => finish(true));
    socket.setTimeout(1200, () => finish(true));
  });
}

process.on('SIGINT', () => terminateChildren(0));
process.on('SIGTERM', () => terminateChildren(0));

async function main() {
  await assertPortFree('code', 3002);
  await assertPortFree('legacy', 3001);
  writePrefixedLine(process.stdout, 'stack', 'starting code and legacy backends');
  spawnScript('code', 'dev:code', { CODE_SERVER_PORT: '3002' });
  spawnScript('legacy', 'dev:legacy-server', { PORT: '3001' });

  await Promise.all([
    waitForPort('code', 3002),
    waitForPort('legacy', 3001),
  ]);

  writePrefixedLine(process.stdout, 'stack', 'backends are ready; starting Vite');
  spawnScript('web', 'dev');
}

main().catch((error) => {
  writePrefixedLine(process.stderr, 'stack', error.message);
  terminateChildren(1);
});
