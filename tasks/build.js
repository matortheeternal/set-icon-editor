import esbuild from 'esbuild';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceRoot = path.join(projectRoot, 'src');

export async function buildJs({ minify = false } = {}) {
    const main = [
        "import '@shoelace-style/shoelace/dist/shoelace.js';",
        "import './main.js';",
    ].join('\n');
    await esbuild.build({
        stdin: {
            contents: main,
            resolveDir: sourceRoot,
            sourcefile: 'bundle-entry.js',
        },
        bundle: true,
        outfile: 'resources/js/bundle.js',
        format: 'iife',
        sourcemap: 'inline',
        sourcesContent: true,
        minify,
        target: ['es2020'],
    });
}

export async function buildCss({ minify = false } = {}) {
    await esbuild.build({
        entryPoints: [path.join(sourceRoot, 'editor', 'index.css')],
        bundle: true,
        outfile: path.join(projectRoot, 'resources', 'css', 'bundle.css'),
        minify,
    });
}

export async function build(options = { minify: false }) {
    console.log('[build] bundling set-icon-editor');
    await buildJs(options);
    await buildCss(options);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
    build({ minify: false }).catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
