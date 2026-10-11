export function isNeutralino() {
    return typeof globalThis.Neutralino !== 'undefined';
}

export function rawLaunchArgs() {
    if (Array.isArray(globalThis.NL_ARGS)) return [...globalThis.NL_ARGS];
    if (typeof location === 'undefined') return [];
    const params = new URLSearchParams(location.search);
    const args = [];
    for (const [key, value] of params) {
        if (value) args.push(`--${key}`, value);
        else args.push(`--${key}`);
    }
    return args;
}

import { normalizeThemePreference } from './theme.js';

export function parseLaunchOptions(argv = rawLaunchArgs()) {
    const options = { importPath: null, outputPath: null, theme: 'auto' };
    for (let index = 0; index < argv.length; index += 1) {
        const [flag, inline] = String(argv[index]).split('=', 2);
        const next = argv[index + 1];
        const value = inline ?? (next?.startsWith('--') ? null : next);
        if (inline === undefined && value != null) index += 1;
        if (flag === '--import' && value) options.importPath = value;
        if (flag === '--output' && value) options.outputPath = value;
        if (flag === '--theme' && value) {
            options.theme = normalizeThemePreference(value);
        }
    }
    return options;
}

let bootOptions = null;

export function setBootOptions(options) {
    bootOptions = options;
}

export function getBootOptions() {
    bootOptions ??= parseLaunchOptions();
    return bootOptions;
}
