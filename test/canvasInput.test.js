import assert from 'node:assert/strict';
import test from 'node:test';

import { CanvasInputController } from
    '../src/editor/canvas/CanvasInputController.js';

function makeShape(hit, nearestDistance = null) {
    return {
        contains: () => hit,
        getNearestPoint: () => ({ getDistance: () => 99 }),
        ...(nearestDistance == null ? {} : {
            segments: [{}],
            divideAt: () => null,
            getNearestLocation: () => ({ distance: nearestDistance }),
        }),
    };
}

function makeLayer(id, hit) {
    return { id, shape: makeShape(hit) };
}

function makeRepository(layers) {
    return {
        layers,
        shapeLayers() {
            return this.layers;
        },
        getById(id) {
            return this.layers.find((layer) => layer.id === id) ?? null;
        },
        getMany(ids) {
            const wanted = new Set(ids);
            return this.layers.filter((layer) => wanted.has(layer.id));
        },
        pathItem(layer) {
            return layer.shape;
        },
    };
}

function makeTransforms() {
    return {
        session: null,
        moves: [],
        beginMove(layers) {
            const flat = [layers].flat();
            this.session = { mode: 'move', layers: flat };
            this.moves.push(flat.map((layer) => layer.id));
        },
        beginPoint() {},
        beginRotate() {},
        beginScale() {},
        end() {
            this.session = null;
        },
    };
}

function makeInput({ layers, state, selects, transforms, checkpoints, pointSelects, inserts, controls }) {
    const scene = {
        scope: { Tool: class { remove() {} } },
        overlayLayer: { children: controls ?? [] },
    };
    const canvas = {
        classList: { add() {}, remove() {} },
        style: {},
    };
    const input = new CanvasInputController({
        scene,
        repository: makeRepository(layers),
        drawing: { isActive: false },
        transforms: transforms ?? makeTransforms(),
        canvas,
        getState: () => state,
        onSelect: (ids, options) => selects.push([ids, options]),
        onCreate: () => {},
        onDrawingChange: () => {},
        onCheckpoint: () => checkpoints.push(1),
        onPointSelect: (indices, options) => pointSelects?.push([indices, options]),
        onInsertPoint: (point) => inserts?.push(point),
    });
    return input;
}

function downEvent(shift, point = {}) {
    return { point, modifiers: { shift } };
}

function baseState(selectedIds) {
    return {
        activeTool: null,
        selectedId: selectedIds.at(-1) ?? null,
        selectedIds: [...selectedIds],
        pointEditingId: null,
    };
}

test('shift-click toggles without starting a drag', () => {
    const selects = [];
    const checkpoints = [];
    const transforms = makeTransforms();
    const input = makeInput({
        layers: [makeLayer(1, true)],
        state: baseState([2]),
        selects,
        transforms,
        checkpoints,
    });
    input.onMouseDown(downEvent(true));
    assert.deepEqual(selects, [[[1], { extend: true }]]);
    assert.equal(transforms.session, null);
    assert.equal(checkpoints.length, 0);
});

test('dragging a member moves the whole selection', () => {
    const selects = [];
    const checkpoints = [];
    const transforms = makeTransforms();
    const input = makeInput({
        layers: [makeLayer(1, false), makeLayer(2, true)],
        state: baseState([1, 2]),
        selects,
        transforms,
        checkpoints,
    });
    input.onMouseDown(downEvent(false));
    assert.deepEqual(selects, []);
    assert.deepEqual(transforms.moves, [[1, 2]]);
    assert.equal(checkpoints.length, 1);
});

test('dragging outside the selection reselects', () => {
    const selects = [];
    const checkpoints = [];
    const transforms = makeTransforms();
    const input = makeInput({
        layers: [makeLayer(1, false), makeLayer(3, true)],
        state: baseState([1]),
        selects,
        transforms,
        checkpoints,
    });
    input.onMouseDown(downEvent(false));
    assert.deepEqual(selects, [[[3], {}]]);
    assert.deepEqual(transforms.moves, [[3]]);
    assert.equal(checkpoints.length, 1);
});

test('clicking empty space clears the selection', () => {
    const selects = [];
    const checkpoints = [];
    const input = makeInput({
        layers: [makeLayer(1, false)],
        state: baseState([1]),
        selects,
        checkpoints,
    });
    input.onMouseDown(downEvent(false));
    assert.deepEqual(selects, [[[], {}]]);
    assert.equal(checkpoints.length, 0);
});

function pointControl(segmentIndex = 2) {
    return {
        data: { pointControlType: 'point', segmentIndex },
        position: { getDistance: () => 0 },
    };
}

function pointState(selectedIds) {
    return {
        ...baseState(selectedIds),
        pointEditingId: selectedIds.at(-1) ?? null,
        selectedPointIndices: [],
    };
}

test('shift-click on an anchor toggles the point, not the layer', () => {
    const selects = [];
    const pointSelects = [];
    const checkpoints = [];
    const input = makeInput({
        layers: [makeLayer(1, true)],
        state: pointState([1]),
        selects,
        checkpoints,
        pointSelects,
        controls: [pointControl(2)],
    });
    input.onMouseDown(downEvent(true));
    assert.deepEqual(pointSelects, [[[2], { extend: true }]]);
    assert.deepEqual(selects, []);
});

test('click-drag on an anchor keeps the point session without reselecting', () => {
    const selects = [];
    const pointSelects = [];
    const checkpoints = [];
    const input = makeInput({
        layers: [makeLayer(1, true)],
        state: pointState([1]),
        selects,
        checkpoints,
        pointSelects,
        controls: [pointControl(2)],
    });
    input.onMouseDown(downEvent(false));
    assert.deepEqual(pointSelects, [[[2], {}]]);
    assert.deepEqual(selects, []);
    assert.equal(checkpoints.length, 1);
});

test('pressing near the curve keeps the session for a double-click insert', () => {
    const selects = [];
    const checkpoints = [];
    const inserts = [];
    const layer = { id: 1, shape: makeShape(false, 5) };
    const input = makeInput({
        layers: [layer],
        state: pointState([1]),
        selects,
        checkpoints,
        inserts,
    });
    input.onMouseDown(downEvent(false));
    assert.deepEqual(selects, []);
    assert.deepEqual(inserts, []);
});

test('pressing truly empty space still exits point mode', () => {
    const selects = [];
    const checkpoints = [];
    const layer = { id: 1, shape: makeShape(false, 500) };
    const input = makeInput({
        layers: [layer],
        state: pointState([1]),
        selects,
        checkpoints,
    });
    input.onMouseDown(downEvent(false));
    assert.deepEqual(selects, [[[], {}]]);
});

test('two quick taps near the curve insert a point', () => {
    const inserts = [];
    const layer = { id: 1, shape: makeShape(false, 5) };
    const input = makeInput({
        layers: [layer],
        state: pointState([1]),
        selects: [],
        checkpoints: [],
        inserts,
    });
    const first = { x: 50, y: 50 };
    const second = { x: 52, y: 51 };
    input.onMouseDown(downEvent(false, first));
    input.onMouseDown(downEvent(false, second));
    assert.deepEqual(inserts, [second]);
});

test('two taps far apart do not insert', () => {
    const inserts = [];
    const selects = [];
    const layer = { id: 1, shape: makeShape(false, 5) };
    const input = makeInput({
        layers: [layer],
        state: pointState([1]),
        selects,
        checkpoints: [],
        inserts,
    });
    input.onMouseDown(downEvent(false, { x: 0, y: 0 }));
    input.onMouseDown(downEvent(false, { x: 100, y: 100 }));
    assert.deepEqual(inserts, []);
    assert.deepEqual(selects, []);
});

test('tapping an anchor twice never inserts', () => {
    const inserts = [];
    const pointSelects = [];
    const input = makeInput({
        layers: [makeLayer(1, true)],
        state: pointState([1]),
        selects: [],
        checkpoints: [],
        pointSelects,
        inserts,
        controls: [pointControl(2)],
    });
    input.onMouseDown(downEvent(false));
    input.onMouseDown(downEvent(false));
    assert.deepEqual(inserts, []);
    assert.equal(pointSelects.length, 2);
});
