import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tscEntry = resolve(packageRoot, 'node_modules', 'typescript', 'bin', 'tsc');
const viteEntry = resolve(packageRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const prebuiltCliEntry = resolve(packageRoot, 'dist', 'cli', 'index.js');
const prebuiltClientEntry = resolve(packageRoot, 'dist', 'client', 'index.html');

const runNode = (entry, args, description, env = process.env) => {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd: packageRoot,
    stdio: 'inherit',
    env,
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
    : [
        'install',
        '--global=false',
        '--ignore-scripts',
        '--include=dev',
        '--no-save',
        '--no-audit',
        '--no-fund',
      ];

  // npm forwards CLI config through the environment when preparing Git
  // dependencies. In particular, `npm install -g <git-url>` leaks
  // npm_config_global=true into this process. Explicitly reset it so the
  // bootstrap install always populates this clone's node_modules directory.
  const installEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'npm_config_global'),
  );
  installEnvironment.npm_config_global = 'false';

  runNode(packageManagerEntry, installArgs, 'Installing build dependencies', installEnvironment);
};

const hasPrebuiltPackage = existsSync(prebuiltCliEntry) && existsSync(prebuiltClientEntry);

if (!hasPrebuiltPackage) {
  if (!existsSync(tscEntry) || !existsSync(viteEntry)) {
    installBuildDependencies();
  }

  runNode(tscEntry, ['--project', 'tsconfig.cli.json'], 'TypeScript build');
  runNode(viteEntry, ['build'], 'Client build');
}

const initialDirectory = resolve(process.env.INIT_CWD ?? packageRoot);
if (initialDirectory === packageRoot) {
  runNode(resolve(packageRoot, 'scripts', 'install-git-hooks.js'), [], 'Installing Git hooks');
}
