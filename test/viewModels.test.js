import assert from 'node:assert/strict';
import test from 'node:test';

import { editorViewModels } from '../src/editor/viewModels.js';

function fullState() {
    return {
        selectedCount: 1,
        canUndo: true,
        canRedo: true,
    };
}

test('menubar model forwards history flags', () => {
    const { menubar } = editorViewModels(fullState());
    assert.equal(menubar.canUndo, true);
    assert.equal(menubar.canRedo, true);
});

test('menubar model defaults history flags to false', () => {
    const { menubar } = editorViewModels({});
    assert.equal(menubar.canUndo, false);
    assert.equal(menubar.canRedo, false);
});

test('other panels keep their contracts', () => {
    const state = fullState();
    const views = editorViewModels(state);
    assert.equal(views.toolbox, state);
    assert.equal(views.layers, state);
    assert.ok(!('topbar' in views));
    assert.ok(!('canvas' in views));
});
