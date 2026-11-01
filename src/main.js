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

async function bootOpen() {
    const { filename } = getBootOptions();
    if (!filename) return;
    try {
        const svgText = isNeutralino()
            ? await globalThis.Neutralino.filesystem.readFile(filename)
            : await (await fetch(filename)).text();
        const editor = document.querySelector('sei-app');
        editor?.controller?.command({
            command: 'open-document',
            svgText,
            filename,
        });
    } catch (error) {
        console.error('Open failed:', error);
    }
}

void bootOpen();
