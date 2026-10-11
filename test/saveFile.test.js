import assert from 'node:assert/strict';
import test from 'node:test';

import { requestNativeSavePath, saveTextFile } from '../src/shared/saveFile.js';

test('writes through the Neutralino filesystem when present', async () => {
    const calls = [];
    globalThis.Neutralino = {
        filesystem: {
            writeFile: async (path, contents) => {
                calls.push([path, contents]);
            },
        },
    };
    try {
        const savedTo = await saveTextFile({
            path: '/icons/a.svg',
            filename: 'a.svg',
            contents: '<svg/>',
            mimeType: 'image/svg+xml',
        });
        assert.equal(savedTo, '/icons/a.svg');
        assert.deepEqual(calls, [['/icons/a.svg', '<svg/>']]);
    } finally {
        delete globalThis.Neutralino;
    }
});

test('requestNativeSavePath is undefined without a native dialog', async () => {
    delete globalThis.Neutralino;
    assert.equal(await requestNativeSavePath('a.svg'), undefined);
});

test('requestNativeSavePath returns the picked path', async () => {
    const calls = [];
    globalThis.Neutralino = {
        os: {
            showSaveDialog: async (title, options) => {
                calls.push([title, options]);
                return '/icons/a.svg';
            },
        },
    };
    try {
        assert.equal(await requestNativeSavePath('a.svg'), '/icons/a.svg');
        assert.deepEqual(calls, [[
            'Save icon',
            {
                defaultPath: 'a.svg',
                filters: [{ name: 'SVG images', extensions: ['svg'] }],
            },
        ]]);
    } finally {
        delete globalThis.Neutralino;
    }
});

test('requestNativeSavePath maps cancel and failure to null', async () => {
    globalThis.Neutralino = { os: { showSaveDialog: async () => '' } };
    try {
        assert.equal(await requestNativeSavePath('a.svg'), null);
    } finally {
        delete globalThis.Neutralino;
    }
    globalThis.Neutralino = {
        os: {
            showSaveDialog: async () => {
                throw new Error('denied');
            },
        },
    };
    try {
        assert.equal(await requestNativeSavePath('a.svg'), null);
    } finally {
        delete globalThis.Neutralino;
    }
});
