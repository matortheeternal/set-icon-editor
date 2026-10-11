import assert from 'node:assert/strict';
import test from 'node:test';

import paper from 'paper';

import { PaperEditor } from
    '../src/editor/canvas/PaperEditor.js';

function makeEditor() {
    const scope = new paper.PaperScope();
    scope.setup(new scope.Size(800, 600));
    scope.project.activeLayer.remove();
    const canvas = { style: {} };
    const editor = new PaperEditor({
        paperLibrary: paper,
        canvas,
        nameShape: (type, count) => `${type} ${count}`,
        getState: () => ({}),
        callbacks: {},
    });
    // PaperEditor creates its own scope internally; use its scope.
    return editor;
}

function addRectangle(editor, from, to) {
    const { scope } = editor.scene;
    const shape = new scope.Path.Rectangle(
        new scope.Rectangle(new scope.Point(...from), new scope.Point(...to)),
    );
    const layer = editor.repository.create('rectangle', shape);
    editor.compositor.rebuild();
    return layer.id;
}

test('copy then paste clones the layer with an offset and unique name', () => {
    const editor = makeEditor();
    const id = addRectangle(editor, [10, 10], [30, 20]);
    const before = editor.repository.getById(id).position.clone();

    assert.equal(editor.copyMany([id]), 1);
    const pasted = editor.pasteClipboard();
    assert.equal(pasted.length, 1);
    assert.notEqual(pasted[0], id);
    assert.equal(editor.repository.shapeLayers().length, 2);

    const clone = editor.repository.getById(pasted[0]);
    assert.match(clone.name, /copy/);
    assert.equal(clone.position.x, before.x + 16);
    assert.equal(clone.position.y, before.y + 16);
});

test('paste with an empty clipboard is a no-op', () => {
    const editor = makeEditor();
    addRectangle(editor, [10, 10], [30, 20]);
    assert.deepEqual(editor.pasteClipboard(), []);
    assert.equal(editor.repository.shapeLayers().length, 1);
});

test('duplicate inserts a clone without touching the clipboard', () => {
    const editor = makeEditor();
    const id = addRectangle(editor, [10, 10], [30, 20]);
    assert.equal(editor.clipboard.length, 0);

    const clones = editor.duplicateMany([id]);
    assert.equal(clones.length, 1);
    assert.equal(editor.repository.shapeLayers().length, 2);
    // Duplicating must not populate the clipboard as a side effect.
    assert.equal(editor.clipboard.length, 0);

    const names = editor.repository.shapeLayers().map((layer) => layer.name);
    assert.ok(names.some((name) => name.includes('copy')));
});

test('paste and duplicate checkpoint so undo restores the count', () => {
    const editor = makeEditor();
    const id = addRectangle(editor, [10, 10], [30, 20]);
    assert.equal(editor.history.canUndo, false);

    editor.copyMany([id]);
    editor.pasteClipboard();
    assert.equal(editor.repository.shapeLayers().length, 2);
    assert.equal(editor.history.canUndo, true);

    assert.notEqual(editor.undo(), null);
    assert.equal(editor.repository.shapeLayers().length, 1);

    assert.notEqual(editor.redo(), null);
    assert.equal(editor.repository.shapeLayers().length, 2);
});
