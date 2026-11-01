import assert from 'node:assert/strict';
import test from 'node:test';

import paper from 'paper';

import { EditorController } from
    '../src/editor/EditorController.js';
import {
    deletablePointIndices,
    normalizePointIndices,
    setPointsSmoothAtShape,
    smoothStatesFor,
    togglePointSelection,
} from '../src/editor/canvas/pointEditing.js';

function makeController() {
    const canvas = { style: {} };
    return new EditorController({
        paperLibrary: paper,
        canvas,
        onStateChange: () => {},
    });
}

function addRectangle(controller, from, to) {
    const { scope } = controller.backend.scene;
    const shape = new scope.Path.Rectangle(
        new scope.Rectangle(new scope.Point(...from), new scope.Point(...to)),
    );
    const layer = controller.backend.repository.create('rectangle', shape);
    controller.backend.compositor.rebuild();
    return layer.id;
}

function pointCount(controller, id) {
    return controller.backend.pointCount(id);
}

function editShape(controller, id) {
    controller.selectLayers([id]);
    controller.togglePointEditing();
}

test('normalizePointIndices dedupes, sorts, and drops out-of-range', () => {
    assert.deepEqual(normalizePointIndices([3, 1, 3, 9, -1, 1.5], 4), [1, 3]);
    assert.deepEqual(normalizePointIndices([], 4), []);
    assert.deepEqual(normalizePointIndices([0], 0), []);
});

test('togglePointSelection adds and removes one index', () => {
    assert.deepEqual(togglePointSelection([0, 2], 2), [0]);
    assert.deepEqual(togglePointSelection([0], 2), [0, 2]);
});

test('insert splits the nearest curve and selects the new point', () => {
    const controller = makeController();
    const id = addRectangle(controller, [10, 10], [30, 20]);
    editShape(controller, id);
    assert.equal(pointCount(controller, id), 4);

    const { scope } = controller.backend.scene;
    const index = controller.insertPointAt(new scope.Point(20, 10));
    assert.equal(typeof index, 'number');
    assert.equal(pointCount(controller, id), 5);
    assert.deepEqual(controller.state.selectedPointIndices, [index]);
});

test('insert far from the path is a no-op without a checkpoint', () => {
    const controller = makeController();
    const id = addRectangle(controller, [10, 10], [30, 20]);
    editShape(controller, id);
    const depth = controller.backend.history.past.length;

    const { scope } = controller.backend.scene;
    const index = controller.insertPointAt(new scope.Point(400, 400));
    assert.equal(index, null);
    assert.equal(pointCount(controller, id), 4);
    assert.equal(controller.backend.history.past.length, depth);
});

test('insert checkpoints so undo restores the segment count', () => {
    const controller = makeController();
    const id = addRectangle(controller, [10, 10], [30, 20]);
    editShape(controller, id);

    const { scope } = controller.backend.scene;
    controller.insertPointAt(new scope.Point(20, 10));
    assert.equal(pointCount(controller, id), 5);
    controller.command({ command: 'undo' });
    const undoneId = controller.selection.primaryId;
    assert.equal(pointCount(controller, undoneId), 4);
    assert.equal(controller.state.pointEditingId, undoneId);
    controller.command({ command: 'redo' });
    const redoneId = controller.selection.primaryId;
    assert.equal(pointCount(controller, redoneId), 5);
    assert.equal(controller.state.pointEditingId, redoneId);
});

test('delete removes points but guards the closed-path minimum of 3', () => {
    const controller = makeController();
    const id = addRectangle(controller, [10, 10], [30, 20]);
    editShape(controller, id);

    assert.equal(controller.backend.deletePointIndices(id, [0, 1]), 0);
    assert.equal(pointCount(controller, id), 4);

    assert.equal(controller.backend.deletePointIndices(id, [0]), 1);
    assert.equal(pointCount(controller, id), 3);
});

test('deletablePointIndices refuses open paths below 2 segments', () => {
    const controller = makeController();
    const { scope } = controller.backend.scene;
    const shape = new scope.Path([
        new scope.Point(0, 0),
        new scope.Point(10, 0),
        new scope.Point(10, 10),
    ]);
    const layer = controller.backend.repository.create('polygon', shape);
    controller.backend.compositor.rebuild();
    const live = controller.backend.repository.pathItem(layer);
    assert.deepEqual(deletablePointIndices(live, [0, 1]), []);
    assert.deepEqual(deletablePointIndices(live, [0]), [0]);
});

test('delete-selected removes points, never the layer, while editing', () => {
    const controller = makeController();
    const id = addRectangle(controller, [10, 10], [30, 20]);
    editShape(controller, id);
    controller.selectPoints([0]);

    controller.command({ command: 'delete-selected' });
    assert.equal(pointCount(controller, id), 3);
    assert.notEqual(controller.backend.repository.getById(id), null);

    controller.command({ command: 'delete-selected' });
    assert.notEqual(controller.backend.repository.getById(id), null);
    assert.equal(pointCount(controller, id), 3);
});

test('delete checkpoints so undo restores the removed point', () => {
    const controller = makeController();
    const id = addRectangle(controller, [10, 10], [30, 20]);
    editShape(controller, id);
    controller.selectPoints([1]);
    controller.command({ command: 'delete-selected' });
    assert.equal(pointCount(controller, id), 3);
    controller.command({ command: 'undo' });
    assert.equal(pointCount(controller, controller.selection.primaryId), 4);
});

test('shift-click toggles one anchor in the multi-selection', () => {
    const controller = makeController();
    const id = addRectangle(controller, [10, 10], [30, 20]);
    editShape(controller, id);

    controller.selectPoints([0]);
    controller.selectPoints([2], { extend: true });
    assert.deepEqual(controller.state.selectedPointIndices, [0, 2]);
    controller.selectPoints([0], { extend: true });
    assert.deepEqual(controller.state.selectedPointIndices, [2]);
});

test('select-all picks every point while editing, layers otherwise', () => {
    const controller = makeController();
    const id = addRectangle(controller, [10, 10], [30, 20]);
    editShape(controller, id);

    controller.command({ command: 'select-all' });
    assert.deepEqual(controller.state.selectedPointIndices, [0, 1, 2, 3]);

    controller.exitPointEditing();
    controller.command({ command: 'select-all' });
    assert.deepEqual(controller.selection.toArray(), [id]);
});

test('dragging a member moves the whole point selection together', () => {
    const controller = makeController();
    const id = addRectangle(controller, [10, 10], [30, 20]);
    editShape(controller, id);
    controller.selectPoints([0, 1]);

    const { scope } = controller.backend.scene;
    const { shape } = controller.backend.editingShape(id);
    const before = [shape.segments[0].point.clone(), shape.segments[1].point.clone()];
    const control = { data: { pointControlType: 'point', segmentIndex: 0 } };
    controller.backend.transforms.beginPoint(
        control,
        controller.backend.repository.getById(id),
        [0, 1],
    );
    controller.backend.transforms.update({
        point: new scope.Point(50, 50),
        delta: new scope.Point(5, 0),
        modifiers: { shift: false },
    });
    controller.backend.transforms.end();

    const moved = [shape.segments[0].point, shape.segments[1].point];
    const delta0 = moved[0].subtract(before[0]);
    const delta1 = moved[1].subtract(before[1]);
    assert.ok(Math.abs(delta0.x - delta1.x) < 1e-6);
    assert.ok(Math.abs(delta0.y - delta1.y) < 1e-6);
    assert.ok(Math.abs(delta0.x) > 1e-6 || Math.abs(delta0.y) > 1e-6);
});

test('smooth converts sharp points to round and back', () => {
    const controller = makeController();
    const id = addRectangle(controller, [10, 10], [30, 20]);
    editShape(controller, id);
    const { shape } = controller.backend.editingShape(id);

    assert.deepEqual(smoothStatesFor(shape, [0, 1]), [false, false]);
    assert.equal(controller.backend.setPointsSmooth(id, [0], true), 1);
    assert.deepEqual(smoothStatesFor(shape, [0, 1]), [true, false]);
    const history = controller.backend.history;
    const depth = history.past.length;
    assert.equal(controller.backend.setPointsSmooth(id, [0], true), 0);
    assert.equal(history.past.length, depth);
    assert.equal(controller.backend.setPointsSmooth(id, [0], false), 1);
    assert.deepEqual(smoothStatesFor(shape, [0]), [false]);
});

test('setPointsSmoothAtShape sharpens only handled points', () => {
    const controller = makeController();
    const id = addRectangle(controller, [10, 10], [30, 20]);
    const { shape } = controller.backend.editingShape(id);
    assert.equal(setPointsSmoothAtShape(shape, [0, 1], false), 0);
});

test('toggle-point-smooth rounds mixed selections, sharpens smooth ones', () => {
    const controller = makeController();
    const id = addRectangle(controller, [10, 10], [30, 20]);
    editShape(controller, id);
    const { shape } = controller.backend.editingShape(id);

    controller.selectPoints([0, 1]);
    controller.command({ command: 'toggle-point-smooth' });
    assert.deepEqual(smoothStatesFor(shape, [0, 1]), [true, true]);

    controller.command({ command: 'toggle-point-smooth' });
    assert.deepEqual(smoothStatesFor(shape, [0, 1]), [false, false]);
});

test('smooth checkpoints so undo restores sharp corners', () => {
    const controller = makeController();
    const id = addRectangle(controller, [10, 10], [30, 20]);
    editShape(controller, id);
    const { shape } = controller.backend.editingShape(id);

    controller.selectPoints([2]);
    controller.command({ command: 'toggle-point-smooth' });
    assert.deepEqual(smoothStatesFor(shape, [2]), [true]);
    controller.command({ command: 'undo' });
    const live = controller.backend.editingShape(
        controller.selection.primaryId,
    ).shape;
    assert.deepEqual(smoothStatesFor(live, [2]), [false]);
});
