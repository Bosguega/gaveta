import { spawn } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);
const useHttps = args.includes('--https');
const passthroughArgs = args.filter((arg) => arg !== '--https');

const projectRoot = process.cwd();
const viteBin =
  process.platform === 'win32'
    ? path.join(projectRoot, 'node_modules', '.bin', 'vite.cmd')
    : path.join(projectRoot, 'node_modules', '.bin', 'vite');

const env = { ...process.env };
if (useHttps) env.VITE_BASIC_SSL = 'true';

const child = spawn(viteBin, passthroughArgs, {
  stdio: 'inherit',
  env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
