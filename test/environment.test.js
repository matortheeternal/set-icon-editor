import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getBootOptions,
    isNeutralino,
    parseLaunchOptions,
    rawLaunchArgs,
    setBootOptions,
} from '../src/shared/environment.js';

test('detects a plain browser context', () => {
    assert.equal(isNeutralino(), false);
    assert.deepEqual(rawLaunchArgs(), []);
});

test('reads Neutralino globals when present', () => {
    globalThis.Neutralino = {};
    globalThis.NL_ARGS = ['--import', 'a.svg'];
    try {
        assert.equal(isNeutralino(), true);
        assert.deepEqual(rawLaunchArgs(), ['--import', 'a.svg']);
    } finally {
        delete globalThis.Neutralino;
        delete globalThis.NL_ARGS;
    }
    assert.equal(isNeutralino(), false);
});

test('parses spaced and inline launch flags', () => {
    assert.deepEqual(parseLaunchOptions([]), {
        importPath: null,
        outputPath: null,
        theme: 'auto',
    });
    assert.deepEqual(
        parseLaunchOptions(['--import', 'a.svg', '--output', 'b.svg']),
        { importPath: 'a.svg', outputPath: 'b.svg', theme: 'auto' },
    );
    assert.deepEqual(
        parseLaunchOptions(['--import=a.svg', '--output=b.svg']),
        { importPath: 'a.svg', outputPath: 'b.svg', theme: 'auto' },
    );
});

test('ignores valueless and unknown flags', () => {
    assert.deepEqual(parseLaunchOptions(['--import']), {
        importPath: null,
        outputPath: null,
        theme: 'auto',
    });
    assert.deepEqual(parseLaunchOptions(['--other', 'x']), {
        importPath: null,
        outputPath: null,
        theme: 'auto',
    });
});

test('parses the theme flag and normalizes unknown values to auto', () => {
    assert.equal(parseLaunchOptions(['--theme', 'dark']).theme, 'dark');
    assert.equal(parseLaunchOptions(['--theme=light']).theme, 'light');
    assert.equal(parseLaunchOptions(['--theme', 'system']).theme, 'auto');
    assert.equal(parseLaunchOptions(['--theme']).theme, 'auto');
});

test('boot options round-trip', () => {
    const options = { importPath: 'a.svg', outputPath: null };
    setBootOptions(options);
    assert.equal(getBootOptions(), options);
    setBootOptions(parseLaunchOptions([]));
});
