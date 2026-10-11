import assert from 'node:assert/strict';
import test from 'node:test';

import paper from 'paper';

import { LayerRepository } from
    '../src/editor/canvas/LayerRepository.js';
import { Compositor } from
    '../src/editor/canvas/Compositor.js';
import { SelectionControls } from
    '../src/editor/canvas/SelectionControls.js';
import { DrawingController } from
    '../src/editor/canvas/DrawingController.js';
import { TransformController } from
    '../src/editor/canvas/TransformController.js';
import { CanvasInputController } from
    '../src/editor/canvas/CanvasInputController.js';
import { shapeForType } from '../src/editor/Shape.js';
import {
    DocumentHistory,
    captureDocument,
    restoreDocument,
} from '../src/editor/history.js';

function makeScope() {
    const scope = new paper.PaperScope();
    scope.setup(new scope.Size(800, 600));
    scope.project.activeLayer.remove();
    return scope;
}

function makeRig() {
    const scope = makeScope();
    const scene = {
        scope,
        compositeLayer: new scope.Layer(),
        previewLayer: new scope.Layer(),
        overlayLayer: new scope.Layer(),
        resize() {},
        update() {},
        destroy() {},
        bringOverlaysToFront() {
            scene.compositeLayer.bringToFront();
            scene.previewLayer.bringToFront();
            scene.overlayLayer.bringToFront();
        },
    };
    const nameShape = (type, count) => `${type} ${count}`;
    const repository = new LayerRepository(scene, nameShape);
    const compositor = new Compositor(scene, repository);
    const controls = new SelectionControls(scene, repository, compositor);
    const drawing = new DrawingController(scene);
    let commits = 0;
    const transforms = new TransformController(scene, repository, () => {
        commits += 1;
    });
    const history = new DocumentHistory();
    let tool = null;
    let sel = [];
    const getState = () => ({
        activeTool: tool,
        selectedId: sel.at(-1) ?? null,
        selectedIds: [...sel],
        pointEditingId: null,
    });
    const checkpoint = () => {
        history.push(captureDocument(repository, sel, sel.at(-1) ?? null));
    };
    const canvas = { classList: { add() {}, remove() {} }, style: {} };
    const input = new CanvasInputController({
        scene,
        repository,
        drawing,
        transforms,
        canvas,
        getState,
        onSelect: (ids) => {
            sel = ids.map(Number).filter(Number.isFinite);
        },
        onCreate: (id) => {
            sel = [Number(id)];
        },
        onDrawingChange: () => {},
        onCheckpoint: checkpoint,
    });
    const point = (x, y) => new scope.Point(x, y);
    const undo = () => {
        const current = captureDocument(repository, sel, sel.at(-1) ?? null);
        const snapshot = history.undo(current);
        if (!snapshot) return false;
        const layers = restoreDocument(scene, repository, snapshot);
        sel = snapshot.selectedIndices.map((index) => layers[index].id);
        return true;
    };
    const redo = () => {
        const current = captureDocument(repository, sel, sel.at(-1) ?? null);
        const snapshot = history.redo(current);
        if (!snapshot) return false;
        const layers = restoreDocument(scene, repository, snapshot);
        sel = snapshot.selectedIndices.map((index) => layers[index].id);
        return true;
    };
    const drawShape = () => {
        tool = 'rectangle';
        input.onMouseDown({ point: point(10, 10), modifiers: { shift: false } });
        input.onMouseDrag({
            point: point(30, 20),
            delta: point(0, 0),
            modifiers: { shift: false },
        });
        input.onMouseUp({
            point: point(30, 20),
            modifiers: { shift: false },
        });
        tool = null;
    };
    return {
        scope,
        scene,
        repository,
        controls,
        history,
        input,
        point,
        undo,
        redo,
        drawShape,
        getSel: () => [...sel],
    };
}

test('creating a shape checkpoints, undoes, and redoes', () => {
    const rig = makeRig();
    assert.equal(rig.history.canUndo, false);
    rig.drawShape();
    assert.equal(rig.repository.shapeLayers().length, 1);
    assert.equal(rig.history.canUndo, true);
    assert.equal(rig.undo(), true);
    assert.equal(rig.repository.shapeLayers().length, 0);
    assert.equal(rig.redo(), true);
    assert.equal(rig.repository.shapeLayers().length, 1);
});

test('translating a layer checkpoints and restores position', () => {
    const rig = makeRig();
    rig.drawShape();
    const [id] = rig.getSel();
    const before = rig.repository.getById(id).position.x;
    rig.input.onMouseDown({
        point: rig.point(15, 15),
        modifiers: { shift: false },
    });
    assert.equal(rig.history.canUndo, true);
    rig.input.onMouseDrag({
        point: rig.point(25, 15),
        delta: rig.point(10, 0),
        modifiers: { shift: false },
    });
    rig.input.onMouseUp({
        point: rig.point(25, 15),
        modifiers: { shift: false },
    });
    const moved = rig.repository.getById(id).position.x;
    assert.equal(moved, before + 10);
    assert.equal(rig.undo(), true);
    const restored = rig.repository.getById(rig.getSel()[0]).position.x;
    assert.equal(restored, before);
    assert.equal(rig.redo(), true);
    const redone = rig.repository.getById(rig.getSel()[0]).position.x;
    assert.equal(redone, before + 10);
});

test('resizing checkpoints and restores bounds', () => {
    const rig = makeRig();
    rig.drawShape();
    const [id] = rig.getSel();
    rig.controls.render({
        selectedIds: [id],
        primaryId: id,
        pointEditingId: null,
    });
    const handle = rig.scene.overlayLayer.children.find(
        (item) => item.data.transformHandle === 'se',
    );
    assert.ok(handle);
    const layer = rig.repository.getById(id);
    const before = rig.repository.pathItem(layer).bounds.width;
    rig.input.onMouseDown({
        point: handle.position,
        modifiers: { shift: false },
    });
    rig.input.onMouseDrag({
        point: rig.point(60, 40),
        delta: rig.point(0, 0),
        modifiers: { shift: false },
    });
    rig.input.onMouseUp({
        point: rig.point(60, 40),
        modifiers: { shift: false },
    });
    const grown = rig.repository.pathItem(layer).bounds.width;
    assert.ok(grown > before);
    assert.equal(rig.undo(), true);
    const back = rig.repository.pathItem(
        rig.repository.getById(rig.getSel()[0]),
    ).bounds.width;
    assert.equal(back, before);
});
