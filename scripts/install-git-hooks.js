import { spawnSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const initialDirectory = resolve(process.env.INIT_CWD ?? packageRoot);

// npm prepares Git dependencies in a temporary checkout. Building is required there,
// but installing repository hooks is useful only when working in this checkout directly.
if (initialDirectory !== packageRoot) {
  process.exit(0);
}

const lefthookEntry = resolve(packageRoot, 'node_modules', 'lefthook', 'bin', 'index.js');
const result = spawnSync(process.execPath, [lefthookEntry, 'install'], {
  cwd: packageRoot,
  stdio: 'inherit',
});

if (result.error || result.status !== 0) {
  console.warn('Could not install lefthook hooks; continuing without Git hooks.');
}
