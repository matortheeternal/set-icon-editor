import assert from 'node:assert/strict';
import test from 'node:test';

import { setWindowTitle } from '../src/shared/windowTitle.js';

function stubDocument() {
    const real = globalThis.document;
    globalThis.document = { title: '' };
    return () => {
        if (real === undefined) delete globalThis.document;
        else globalThis.document = real;
    };
}

test('stems the filename into the window title', () => {
    const restore = stubDocument();
    try {
        setWindowTitle('/icons/sword.svg');
        assert.equal(document.title, 'sword - Set Icon Editor');
        setWindowTitle('Untitled Icon');
        assert.equal(document.title, 'Untitled Icon - Set Icon Editor');
        setWindowTitle('archive.tar.svg');
        assert.equal(document.title, 'archive.tar - Set Icon Editor');
    } finally {
        restore();
    }
});
