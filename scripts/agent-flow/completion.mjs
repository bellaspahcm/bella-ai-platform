import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
function execute(file, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(here, file), ...args], { windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', timedOut = false;
    const terminateTree = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') execFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {});
      else { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* close handler reports outcome */ } }
    };
    const timer = setTimeout(() => { timedOut = true; terminateTree(); }, 240000);
    child.on('error', () => { clearTimeout(timer); reject(new Error('CHILD_START_FAILED')); });
    child.stdout.on('data', b => { stdout += b.toString(); if (stdout.length > 2 * 1024 * 1024) { timedOut = true; terminateTree(); } });
    child.stderr.on('data', () => {});
    child.on('close', code => {
      clearTimeout(timer);
      if (timedOut) { reject(new Error('CHILD_TIMEOUT')); return; }
      if (code !== 0) { reject(new Error(`CHILD_FAILED_EXIT_${code}`)); return; }
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error('INVALID_CHILD_RESULT')); }
    });
  });
}

// Writer exits before reader starts. Each case uses its own session/run/turn.
const results = [];
try {
  for (const scenario of ['success', 'failed-tool']) {
    const writer = await execute('probe.mjs', ['--retain', ...(scenario === 'failed-tool' ? ['--failed-tool'] : [])]);
    console.log(JSON.stringify({ phase: 'writer_completed', scenario, evidenceDirectory: writer.evidenceDirectory }));
    const reader = await execute('readback.mjs', [writer.evidenceDirectory]);
    results.push({ scenario, writerResult: writer.result, readerResult: reader.result, evidenceDirectory: writer.evidenceDirectory, readerArtifact: reader.readerArtifact, binding: writer.binding, commandExitCode: writer.command.exitCode });
    console.log(JSON.stringify({ phase: 'independent_read_completed', ...results.at(-1) }));
  }
  console.log(JSON.stringify({ result: 'PASS_RUNTIME_CHAIN_PENDING_REVIEW', scenarios: results, production: 'UNTOUCHED' }));
} catch (error) {
  console.error(/^[A-Z_0-9]{3,80}$/.test(error.message) ? error.message : 'COMPLETION_FAILED'); process.exitCode = 1;
}
