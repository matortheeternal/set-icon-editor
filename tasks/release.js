import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncBuilderConfig } from './sync-builder-config.js';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const projectConfigPath = path.join(projectRoot, 'neutralino.config.json');

const APPIMAGE_ARCH_ALIASES = { x64: 'x86_64', x86_64: 'x86_64', arm64: 'aarch64', aarch64: 'aarch64', armhf: 'armhf', ia32: 'i686', i686: 'i686' };

const TARGET_EXTENSIONS = { deb: '.deb', appimage: '.AppImage', nsis: '.exe', dmg: '.dmg' };

const HOST_ARCH = process.arch;

function friendlyName(applicationName) {
    return String(applicationName || 'neutralino-app').replace(/[^A-Za-z0-9]+/g, '');
}

function sanitizeAppId(applicationId) {
    return String(applicationId || 'neutralino-app').trim().toLowerCase()
        .replace(/[^a-z0-9.+-]/g, '-').replace(/-+/g, '-').replace(/^[.-]+|[.-]+$/g, '') || 'neutralino-app';
}

function run(cmd, args, { allowFail = false } = {}) {
    console.log(`\n$ ${cmd} ${args.join(' ')}`);
    const result = spawnSync(cmd, args, { cwd: projectRoot, stdio: 'inherit', shell: process.platform === 'win32' });
    if (result.status !== 0 && !allowFail) {
        throw new Error(`Command failed (${result.status}): ${cmd} ${args.join(' ')}`);
    }
    return result.status === 0;
}

function loadMatrix() {
    const config = JSON.parse(fs.readFileSync(projectConfigPath, 'utf-8'));
    const builder = config.cli?.builder;
    if (!builder) throw new Error(`No cli.builder section in ${projectConfigPath}`);
    const matrix = [];
    for (const platform of Object.keys(builder)) {
        for (const entry of builder[platform].targets || []) {
            for (const arch of entry.arch || [undefined]) {
                matrix.push({ platform, target: entry.target, arch, output: entry.output || './dist' });
            }
        }
    }
    return { config, matrix };
}

function renameAppImages({ config, built }) {
    const appId = sanitizeAppId(config.applicationId);
    const version = config.version || '1.0.0';
    const name = friendlyName(config.applicationName);
    const renamed = [];
    let primary = null;
    for (const { arch, outputDir } of built) {
        const from = path.join(outputDir, `${appId}-${version}-${arch}.AppImage`);
        const alias = APPIMAGE_ARCH_ALIASES[arch] || arch;
        const to = path.join(outputDir, `${name}-${version}-${alias}.AppImage`);
        if (!fs.existsSync(from)) {
            console.warn(`[release] expected AppImage not found (skipping rename): ${from}`);
            console.warn(`[release]   contents of ${outputDir}: ${(fs.existsSync(outputDir) ? fs.readdirSync(outputDir).join(', ') : '<missing>')}`);
            continue;
        }
        fs.renameSync(from, to);
        console.log(`[release] renamed ${path.basename(from)} -> ${path.basename(to)}`);
        renamed.push(to);
        if (!primary) primary = to;
    }
    if (primary) {
        const stable = path.join(path.dirname(primary), `${name}.AppImage`);
        fs.copyFileSync(primary, stable);
        console.log(`[release] copied ${path.basename(primary)} -> ${path.basename(stable)} (stable name)`);
        renamed.push(stable);
    }
    return renamed;
}

function summarizeOutputs() {    console.log('\n[release] dist/ outputs:');
    const distDir = path.join(projectRoot, 'dist');
    if (!fs.existsSync(distDir)) {
        console.log('  (no dist/ directory)');
        return;
    }
    for (const entry of fs.readdirSync(distDir, { withFileTypes: true })) {
        const full = path.join(distDir, entry.name);
        if (entry.isDirectory()) {
            const files = fs.readdirSync(full).filter((f) => !f.startsWith('.'));
            console.log(`  dist/${entry.name}/`);
            for (const f of files) {
                let size = '';
                try { size = ` (${(fs.statSync(path.join(full, f)).size / 1048576).toFixed(1)} MB)`; } catch {   }
                console.log(`    - ${f}${size}`);
            }
        } else {
            console.log(`  dist/${entry.name}`);
        }
    }
}

function holdArtifacts(holdDir, held, outputDir, ext) {
    fs.mkdirSync(holdDir, { recursive: true });
    if (!fs.existsSync(outputDir)) return;
    for (const file of fs.readdirSync(outputDir)) {
        if (!file.endsWith(ext)) continue;
        const dest = path.join(holdDir, file);
        fs.rmSync(dest, { force: true });
        fs.renameSync(path.join(outputDir, file), dest);
        held.push({ file, destDir: outputDir, heldPath: dest });
        console.log(`[release] parked ${file} in holding dir`);
    }
}

function restoreArtifacts(holdDir, held) {
    for (const { file, destDir, heldPath } of held.splice(0)) {
        if (!fs.existsSync(heldPath)) continue;
        fs.mkdirSync(destDir, { recursive: true });
        fs.rmSync(path.join(destDir, file), { force: true });
        fs.renameSync(heldPath, path.join(destDir, file));
        console.log(`[release] restored ${file} -> ${path.relative(projectRoot, destDir)}/`);
    }
    try {
        if (fs.existsSync(holdDir) && fs.readdirSync(holdDir).length === 0) {
            fs.rmdirSync(holdDir);
        }
    } catch {   }
}

function parseArgs(argv) {
    const opts = { skipBuild: false, skipSync: false, rename: true, targets: null, builderConfigPath: null };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--skip-build') opts.skipBuild = true;
        else if (arg === '--skip-sync') opts.skipSync = true;
        else if (arg === '--no-rename') opts.rename = false;
        else if (arg === '--builder-config' && argv[i + 1]) opts.builderConfigPath = argv[++i];
        else if (arg.startsWith('--builder-config=')) opts.builderConfigPath = arg.split('=', 2)[1];
        else if (arg === '--targets' && argv[i + 1]) opts.targets = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
        else if (arg.startsWith('--targets=')) opts.targets = arg.split('=', 2)[1].split(',').map((s) => s.trim()).filter(Boolean);
    }
    return opts;
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    const { config, matrix } = loadMatrix();
    const wanted = opts.targets
        ? matrix.filter((m) => opts.targets.includes(m.target))
        : matrix;
    if (opts.targets) {
        const known = new Set(matrix.map((m) => m.target));
        for (const t of opts.targets) {
            if (!known.has(t)) throw new Error(`Unknown target '${t}'. Known targets: ${[...known].join(', ')}`);
        }
    }

    const isMac = process.platform === 'darwin';
    const plan = [];
    for (const item of wanted) {
        if (item.target === 'dmg' && !isMac) {
            console.warn(`[release] skipping dmg/${item.arch}: DMG packaging requires macOS (hdiutil). Build on a Mac or via a macOS CI runner.`);
            continue;
        }
        if (item.target === 'appimage' && item.arch && item.arch !== HOST_ARCH) {
            console.warn(`[release] skipping appimage/${item.arch}: appimagetool-${item.arch} cannot execute on a ${HOST_ARCH} host (exit 126). Build on a ${item.arch} host or via CI.`);
            continue;
        }
        plan.push(item);
    }
    if (plan.length === 0) throw new Error('Nothing to build for this host (empty plan).');

    console.log(`[release] ${config.applicationName} v${config.version} -- plan: ${plan.map((p) => `${p.target}/${p.arch}`).join(', ')}`);

    if (!opts.skipBuild) {
        run('npm', ['run', 'build']);
        run('neu', ['build']);
    } else {
        console.log('[release] --skip-build: reusing existing dist/ binaries');
    }

    if (!opts.skipSync) {
        syncBuilderConfig({ builderConfigPath: opts.builderConfigPath });
    } else {
        console.log('[release] --skip-sync: NOT syncing project config into the installed builder (issue #40 workaround disabled)');
    }

    const failures = [];
    const builtAppImages = [];
    const holdDir = path.join(projectRoot, 'dist', '.release-hold');
    const held = [];
    try {
        for (const { target, arch, output } of plan) {
            const outputDir = path.resolve(projectRoot, output);
            const ext = TARGET_EXTENSIONS[target];
            if (ext) holdArtifacts(holdDir, held, outputDir, ext);
            const args = ['builder', target];
            if (arch) args.push(`--${arch}`);
            const ok = run('neu', args, { allowFail: true });
            if (!ok) {
                failures.push(`${target}/${arch}`);
                continue;
            }
            if (ext) holdArtifacts(holdDir, held, outputDir, ext);
            if (target === 'appimage') {
                builtAppImages.push({ arch, outputDir });
            }
        }
    } finally {
        restoreArtifacts(holdDir, held);
    }

    let renamed = [];
    if (opts.rename && builtAppImages.length > 0) {
        renamed = renameAppImages({ config, built: builtAppImages });
    }

    summarizeOutputs();

    if (failures.length > 0) {
        throw new Error(`Release finished with failures: ${failures.join(', ')}`);
    }
    console.log('\n[release] done.');
    if (renamed.length > 0) console.log(`[release] AppImage artifacts: ${renamed.map((p) => path.relative(projectRoot, p)).join(', ')}`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
    main().catch((error) => {
        console.error(`[release] ERROR: ${error.message}`);
        process.exit(1);
    });
}
