import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tscEntry = resolve(packageRoot, 'node_modules', 'typescript', 'bin', 'tsc');
const viteEntry = resolve(packageRoot, 'node_modules', 'vite', 'bin', 'vite.js');

const runNode = (entry, args, description) => {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd: packageRoot,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${description} failed with exit code ${result.status ?? 'unknown'}`);
  }
};

const installBuildDependencies = () => {
  const packageManagerEntry = process.env.npm_execpath;
  if (!packageManagerEntry) {
    throw new Error('Cannot install build dependencies: npm_execpath is not available');
  }

  const isPnpm = packageManagerEntry.toLowerCase().includes('pnpm');
  const installArgs = isPnpm
    ? ['install', '--ignore-scripts', '--frozen-lockfile']
    : ['install', '--ignore-scripts', '--include=dev', '--no-save', '--no-audit', '--no-fund'];

  runNode(packageManagerEntry, installArgs, 'Installing build dependencies');
};

if (!existsSync(tscEntry) || !existsSync(viteEntry)) {
  installBuildDependencies();
}

runNode(tscEntry, ['--project', 'tsconfig.cli.json'], 'TypeScript build');
runNode(viteEntry, ['build'], 'Client build');

const initialDirectory = resolve(process.env.INIT_CWD ?? packageRoot);
if (initialDirectory === packageRoot) {
  runNode(resolve(packageRoot, 'scripts', 'install-git-hooks.js'), [], 'Installing Git hooks');
}
