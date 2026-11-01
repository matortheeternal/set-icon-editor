import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);

function run(command, args) {
    console.log(`$ ${command} ${args.join(' ')}`);
    const result = spawnSync(command, args, {
        cwd: projectRoot,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}

try {
    for (const arg of args) {
        if (arg !== '--skip-build') throw new Error(`Unknown option: ${arg}`);
    }
    if (!args.includes('--skip-build')) run('npm', ['run', 'build']);
    run('neu', ['build', '--embed-resources']);
    console.log('[release] Standalone executables generated in dist/setIconEditor/');
} catch (error) {
    console.error(`[release] ${error.message}`);
    process.exitCode = 1;
}
