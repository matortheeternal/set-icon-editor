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
    globalThis.NL_ARGS = ['setIconEditor', 'a.svg'];
    try {
        assert.equal(isNeutralino(), true);
        assert.deepEqual(rawLaunchArgs(), ['a.svg']);
    } finally {
        delete globalThis.Neutralino;
        delete globalThis.NL_ARGS;
    }
    assert.equal(isNeutralino(), false);
});

test('starts without a filename and ignores unknown options', () => {
    const empty = { filename: null, theme: 'auto' };
    assert.deepEqual(parseLaunchOptions([]), empty);
    assert.deepEqual(parseLaunchOptions(['--other', 'x']), empty);
    assert.deepEqual(parseLaunchOptions(['--import', 'a.svg', '--output', 'b.svg']), empty);
    assert.deepEqual(parseLaunchOptions(['--import=a.svg', '--output=b.svg']), empty);
});

test('parses the theme flag and normalizes unknown values to auto', () => {
    assert.equal(parseLaunchOptions(['--theme', 'dark']).theme, 'dark');
    assert.equal(parseLaunchOptions(['--theme=light']).theme, 'light');
    assert.equal(parseLaunchOptions(['--theme', 'system']).theme, 'auto');
    assert.equal(parseLaunchOptions(['--theme']).theme, 'auto');
});

test('boot options round-trip', () => {
    const options = { filename: 'a.svg', theme: 'auto' };
    setBootOptions(options);
    assert.equal(getBootOptions(), options);
    setBootOptions(parseLaunchOptions([]));
});

test('uses the first positional filename for opening and saving', () => {
    for (const filename of ['a.svg', '/tmp/set icon.svg', 'C:\\Icons\\set.svg', 'a=b.svg']) {
        assert.deepEqual(parseLaunchOptions([filename]), { filename, theme: 'auto' });
        assert.deepEqual(parseLaunchOptions(['--theme=dark', filename]), {
            filename, theme: 'dark',
        });
        assert.equal(parseLaunchOptions([filename, '--theme', 'light']).theme, 'light');
    }
    assert.equal(parseLaunchOptions(['first.svg', 'second.svg']).filename, 'first.svg');
    assert.equal(parseLaunchOptions(['--', '-icon.svg']).filename, '-icon.svg');
});

test('excludes the Neutralino executable from positional filenames', () => {
    globalThis.NL_ARGS = ['/opt/seticoneditor/setIconEditor', '/tmp/icon.svg'];
    try {
        assert.equal(parseLaunchOptions().filename, '/tmp/icon.svg');
        globalThis.NL_ARGS = ['/opt/seticoneditor/setIconEditor'];
        assert.equal(parseLaunchOptions().filename, null);
    } finally {
        delete globalThis.NL_ARGS;
    }
});
