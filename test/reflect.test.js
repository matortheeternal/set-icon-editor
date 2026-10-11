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
    return new PaperEditor({
        paperLibrary: paper,
        canvas,
        nameShape: (type, count) => `${type} ${count}`,
        getState: () => ({}),
        callbacks: {},
    });
}

function addShape(editor, type, shape) {
    const layer = editor.repository.create(type, shape);
    editor.compositor.rebuild();
    return layer.id;
}

function addRectangle(editor, from, to) {
    const { scope } = editor.scene;
    return addShape(
        editor,
        'rectangle',
        new scope.Path.Rectangle(
            new scope.Rectangle(
                new scope.Point(...from),
                new scope.Point(...to),
            ),
        ),
    );
}

function addTriangle(editor, points) {
    const { scope } = editor.scene;
    const shape = new scope.Path(
        points.map((point) => new scope.Point(...point)),
    );
    shape.closed = true;
    return addShape(editor, 'polygon', shape);
}

function sortedPoints(shape) {
    return shape.segments
        .map((segment) => `${segment.point.x},${segment.point.y}`)
        .sort();
}

function undone(editor, ids) {
    editor.undo({ selectedIds: ids, selectedId: ids.at(-1) ?? null });
}

test('reflect horizontal mirrors an asymmetric shape about its center', () => {
    const editor = makeEditor();
    const id = addTriangle(editor, [[0, 0], [40, 0], [0, 20]]);
    // Center x = 20, so x maps to 40 - x.
    assert.equal(editor.reflectLayers([id], 'horizontal'), 1);
    const shape = editor.repository.pathItem(editor.repository.getById(id));
    assert.deepEqual(sortedPoints(shape), ['0,0', '40,0', '40,20']);

    undone(editor, [id]);
    const restored = editor.repository.pathItem(
        editor.repository.shapeLayers()[0],
    );
    assert.deepEqual(sortedPoints(restored), ['0,0', '0,20', '40,0']);
});

test('reflect vertical mirrors top to bottom', () => {
    const editor = makeEditor();
    const id = addTriangle(editor, [[0, 0], [40, 0], [0, 20]]);
    // Center y = 10, so y maps to 20 - y.
    assert.equal(editor.reflectLayers([id], 'vertical'), 1);
    const shape = editor.repository.pathItem(editor.repository.getById(id));
    assert.deepEqual(sortedPoints(shape), ['0,0', '0,20', '40,20']);
});

test('reflection preserves the transformed selection frame', () => {
    const editor = makeEditor();
    const id = addRectangle(editor, [10, 10], [50, 30]);
    const layer = editor.repository.getById(id);
    layer.data.rotation = 30;
    layer.data.width = 40;
    layer.data.height = 20;
    assert.equal(editor.reflectLayers([id], 'horizontal'), 1);
    assert.equal(layer.data.rotation, 150);
    assert.equal(layer.data.width, 40);
    assert.equal(layer.data.height, -20);
    assert.equal(editor.reflectLayers([id], 'vertical'), 1);
    assert.equal(layer.data.rotation, 210);
    assert.equal(layer.data.width, 40);
    assert.equal(layer.data.height, 20);
});

test('reflect mirrors several layers about their union center', () => {
    const editor = makeEditor();
    const left = addRectangle(editor, [10, 10], [30, 20]);
    const right = addRectangle(editor, [100, 100], [120, 110]);
    // Union center x = (10 + 120) / 2 = 65: centers 20 <-> 110.
    assert.equal(editor.reflectLayers([left, right], 'horizontal'), 2);
    assert.equal(editor.repository.getById(left).position.x, 110);
    assert.equal(editor.repository.getById(right).position.x, 20);
    // Vertical positions are untouched.
    assert.equal(editor.repository.getById(left).position.y, 15);
    assert.equal(editor.repository.getById(right).position.y, 105);
});

test('reflect with a bad axis or no layers is a history-free no-op', () => {
    const editor = makeEditor();
    const id = addRectangle(editor, [10, 10], [30, 20]);
    assert.equal(editor.reflectLayers([id], 'diagonal'), 0);
    assert.equal(editor.reflectLayers([], 'horizontal'), 0);
    assert.equal(editor.reflectLayers([9999], 'horizontal'), 0);
    assert.equal(editor.history.canUndo, false);
    assert.equal(editor.repository.getById(id).position.x, 20);
});
