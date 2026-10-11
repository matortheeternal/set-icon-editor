import assert from 'node:assert/strict';
import test from 'node:test';

import { resizeCursor } from
    '../src/editor/canvas/canvasHitTesting.js';

test('resizeCursor uses directional cursors for every unrotated handle', () => {
    assert.equal(resizeCursor('nw'), 'nw-resize');
    assert.equal(resizeCursor('n'), 'n-resize');
    assert.equal(resizeCursor('ne'), 'ne-resize');
    assert.equal(resizeCursor('e'), 'e-resize');
    assert.equal(resizeCursor('se'), 'se-resize');
    assert.equal(resizeCursor('s'), 's-resize');
    assert.equal(resizeCursor('sw'), 'sw-resize');
    assert.equal(resizeCursor('w'), 'w-resize');
});

test('resizeCursor follows rotation and reflected frame directions', () => {
    assert.equal(resizeCursor('nw', 90), 'ne-resize');
    assert.equal(resizeCursor('nw', 0, -1, 1), 'ne-resize');
    assert.equal(resizeCursor('missing'), 'default');
});
