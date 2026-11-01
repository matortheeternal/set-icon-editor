import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const projectConfigPath = path.join(projectRoot, 'neutralino.config.json');

function findBuilderConfig(explicit) {
    const candidates = [];
    if (explicit || process.env.NEU_BUILDER_CONFIG) {
        candidates.push(path.resolve(explicit || process.env.NEU_BUILDER_CONFIG));
    }
    try {
        const npmRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf-8' }).trim();
        candidates.push(path.join(npmRoot, '@neutralinojs', 'neu', 'node_modules', '@neutralinojs-contrib', 'builder', 'neutralino.config.json'));
    } catch {
    }
    try {
        const neuBin = execFileSync('which', ['neu'], { encoding: 'utf-8' }).trim().split('\n')[0];
        const realBin = fs.existsSync(neuBin) && fs.lstatSync(neuBin).isSymbolicLink()
            ? fs.readlinkSync(neuBin)
            : neuBin;
        let dir = path.dirname(path.resolve(path.dirname(neuBin), realBin));
        for (let i = 0; i < 5; i++) {
            candidates.push(path.join(dir, 'lib', 'node_modules', '@neutralinojs', 'neu', 'node_modules', '@neutralinojs-contrib', 'builder', 'neutralino.config.json'));
            candidates.push(path.join(dir, 'node_modules', '@neutralinojs', 'neu', 'node_modules', '@neutralinojs-contrib', 'builder', 'neutralino.config.json'));
            const parent = path.dirname(dir);
            if (parent === dir) break;
            dir = parent;
        }
    } catch {
    }
    candidates.push(path.join(projectRoot, 'node_modules', '@neutralinojs-contrib', 'builder', 'neutralino.config.json'));
    candidates.push(path.join(projectRoot, 'node_modules', '@neutralinojs', 'neu', 'node_modules', '@neutralinojs-contrib', 'builder', 'neutralino.config.json'));

    const seen = new Set();
    for (const candidate of candidates) {
        if (seen.has(candidate)) continue;
        seen.add(candidate);
        if (candidate && fs.existsSync(candidate)) return candidate;
    }
    throw new Error(
        'Could not locate the installed builder config (@neutralinojs-contrib/builder/neutralino.config.json). ' +
        `Looked in:\n${[...seen].map((c) => `  - ${c}`).join('\n')}\n` +
        'Pass --builder-config <path> or set NEU_BUILDER_CONFIG explicitly.'
    );
}

export function syncBuilderConfig({ builderConfigPath, dryRun = false } = {}) {
    const projectRaw = fs.readFileSync(projectConfigPath, 'utf-8');
    const project = JSON.parse(projectRaw);
    if (!project.cli?.builder) {
        throw new Error(`No cli.builder section found in ${projectConfigPath}; nothing to sync.`);
    }

    const target = builderConfigPath || findBuilderConfig();
    const builderRaw = fs.readFileSync(target, 'utf-8');
    const builder = JSON.parse(builderRaw);

    builder.applicationId = project.applicationId ?? builder.applicationId;
    builder.applicationName = project.applicationName ?? builder.applicationName;
    builder.version = project.version ?? builder.version;
    builder.cli = builder.cli || {};
    builder.cli.builder = project.cli.builder;

    if (dryRun) {
        console.log(`[sync-builder-config] dry run: would write project builder config to ${target}`);
        return { target, config: builder };
    }

    const backupPath = `${target}.orig`;
    if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(target, backupPath);
        console.log(`[sync-builder-config] backed up shipped builder config to ${backupPath}`);
    }
    fs.writeFileSync(target, `${JSON.stringify(builder, null, 2)}\n`);
    console.log(`[sync-builder-config] synced cli.builder (${project.applicationId} v${project.version}) -> ${target}`);

    patchConfigResolver(path.dirname(target), dryRun);
    return { target, config: builder };
}

const RESOLVER_PATCH_MARKER = 'set-icon-editor: forward dmg layout keys';

const RESOLVER_PATCH_BLOCK = `
    "${RESOLVER_PATCH_MARKER}";
    finalConfig.iconSize = targetConfig.iconSize || 80;
    finalConfig.window = targetConfig.window || { width: 660, height: 400 };
    finalConfig.appPosition = targetConfig.appPosition || { x: 180, y: 170 };
    finalConfig.applicationsSymlinkPosition = targetConfig.applicationsSymlinkPosition || { x: 480, y: 170 };
`;

export function patchConfigResolver(builderDir, dryRun = false) {
    const resolverPath = path.join(builderDir, 'lib', 'configresolver.js');
    if (!fs.existsSync(resolverPath)) {
        console.warn(`[sync-builder-config] resolver not found at ${resolverPath}; skipping dmg-key patch`);
        return false;
    }
    const source = fs.readFileSync(resolverPath, 'utf-8');
    if (source.includes(RESOLVER_PATCH_MARKER)) {
        console.log('[sync-builder-config] configresolver.js already patched (dmg layout keys)');
        return true;
    }
    const anchor = '    return finalConfig;';
    if (!source.includes(anchor)) {
        throw new Error(`Cannot patch ${resolverPath}: anchor 'return finalConfig;' not found (upstream changed the file?)`);
    }
    if (dryRun) {
        console.log(`[sync-builder-config] dry run: would patch dmg layout keys into ${resolverPath}`);
        return false;
    }
    const backupPath = `${resolverPath}.orig`;
    if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(resolverPath, backupPath);
        console.log(`[sync-builder-config] backed up shipped resolver to ${backupPath}`);
    }
    fs.writeFileSync(resolverPath, source.replace(anchor, `${RESOLVER_PATCH_BLOCK}\n${anchor}`));
    console.log(`[sync-builder-config] patched dmg layout keys into ${resolverPath}`);
    return true;
}

function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--builder-config' && argv[i + 1]) out.builderConfigPath = argv[++i];
        else if (arg.startsWith('--builder-config=')) out.builderConfigPath = arg.split('=', 2)[1];
        else if (arg === '--dry-run') out.dryRun = true;
    }
    return out;
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
    try {
        syncBuilderConfig(parseArgs(process.argv.slice(2)));
    } catch (error) {
        console.error(`[sync-builder-config] ERROR: ${error.message}`);
        process.exit(1);
    }
}
