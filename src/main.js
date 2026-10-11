import {
    getBootOptions,
    isNeutralino,
    parseLaunchOptions,
    rawLaunchArgs,
    setBootOptions,
} from './shared/environment.js';
import { loadSettings } from './shared/settings.js';
import { applyTheme, resolveTheme } from './shared/theme.js';
import './editor/Editor.js';

const launchArgs = rawLaunchArgs();
const options = parseLaunchOptions(launchArgs);
const hasThemeArgument = launchArgs.some((arg) => {
    const value = String(arg);
    return value === '--theme' || value.startsWith('--theme=');
});
if (!hasThemeArgument) options.theme = loadSettings().theme;
setBootOptions(options);
applyTheme(resolveTheme(getBootOptions().theme));
if (isNeutralino()) globalThis.Neutralino.init();

async function bootImport() {
    const { importPath, outputPath } = getBootOptions();
    if (!importPath) return;
    try {
        const svgText = isNeutralino()
            ? await globalThis.Neutralino.filesystem.readFile(importPath)
            : await (await fetch(importPath)).text();
        const editor = document.querySelector('sei-app');
        editor?.controller?.command({
            command: 'open-document',
            svgText,
            filename: outputPath ?? importPath,
        });
    } catch (error) {
        console.error('Import failed:', error);
    }
}

void bootImport();
