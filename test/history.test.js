import assert from 'node:assert/strict';
import test from 'node:test';

import {
    DocumentHistory,
    captureDocument,
    restoreDocument,
} from '../src/editor/history.js';

function makeScene() {
    const project = [];
    class ProjectLayer {
        constructor() {
            this.id = project.length + 1;
            this.children = [];
            this.name = '';
            this.data = {};
            project.push(this);
        }

        addChild(item) {
            this.children.push(item);
        }

        remove() {
            const at = project.indexOf(this);
            if (at !== -1) project.splice(at, 1);
        }
    }
    class ProjectPath {
        constructor(pathData) {
            this.pathData = pathData;
            this.style = null;
        }
    }
    return { project, scope: { Layer: ProjectLayer, Path: ProjectPath } };
}

function makeRepository(scene) {
    return {
        shapeLayers() {
            return scene.project.filter(
                (layer) => layer.data.isShapeLayer,
            );
        },
        pathItem(layer) {
            return layer.children[0] ?? null;
        },
    };
}

function seedLayer(scene, name, pathData) {
    const layer = new scene.scope.Layer();
    layer.name = name;
    layer.data = { isShapeLayer: true, shapeType: 'rectangle', mode: 'overlap' };
    if (pathData) layer.addChild(new scene.scope.Path(pathData));
    return layer;
}

function seedDocument(scene) {
    seedLayer(scene, 'First', 'M0 0h10v10H0Z');
    seedLayer(scene, 'Second', 'M20 0h10v10H20Z');
}

test('push, undo, and redo move snapshots', () => {
    const history = new DocumentHistory();
    assert.equal(history.canUndo, false);
    assert.equal(history.undo({}), null);
    assert.equal(history.redo({}), null);
    history.push({ v: 1 });
    history.push({ v: 2 });
    assert.equal(history.canUndo, true);
    assert.deepEqual(history.undo({ v: 3 }), { v: 2 });
    assert.deepEqual(history.undo({ v: 2 }), { v: 1 });
    assert.equal(history.canUndo, false);
    assert.equal(history.canRedo, true);
    assert.deepEqual(history.redo({ v: 1 }), { v: 2 });
});

test('push skips duplicates and clears redo', () => {
    const history = new DocumentHistory();
    assert.equal(history.push({ v: 1 }), true);
    assert.equal(history.push({ v: 1 }), false);
    history.undo({ v: 2 });
    assert.equal(history.canRedo, true);
    history.push({ v: 3 });
    assert.equal(history.canRedo, false);
});

test('depth cap drops the oldest entries', () => {
    const history = new DocumentHistory(2);
    history.push({ v: 1 });
    history.push({ v: 2 });
    history.push({ v: 3 });
    assert.deepEqual(history.undo({ v: 4 }), { v: 3 });
    assert.deepEqual(history.undo({ v: 4 }), { v: 2 });
    assert.equal(history.canUndo, false);
});

test('capture keeps order, data, and primary-last selection', () => {
    const scene = makeScene();
    seedDocument(scene);
    const repository = makeRepository(scene);
    const [first, second] = repository.shapeLayers();
    const snapshot = captureDocument(repository, [second.id, first.id], second.id);
    assert.deepEqual(
        snapshot.layers.map((layer) => layer.name),
        ['First', 'Second'],
    );
    assert.equal(snapshot.layers[0].pathData, 'M0 0h10v10H0Z');
    assert.equal(snapshot.layers[1].data.shapeType, 'rectangle');
    assert.deepEqual(snapshot.selectedIndices, [0, 1]);
});

test('restore rebuilds layers and remaps selection', () => {
    const scene = makeScene();
    seedDocument(scene);
    const repository = makeRepository(scene);
    const [first, second] = repository.shapeLayers();
    const snapshot = captureDocument(repository, [first.id], first.id);
    second.remove();
    assert.equal(repository.shapeLayers().length, 1);
    const layers = restoreDocument(scene, repository, snapshot);
    assert.equal(repository.shapeLayers().length, 2);
    assert.deepEqual(
        layers.map((layer) => layer.name),
        ['First', 'Second'],
    );
    const style = layers[0].children[0].style;
    assert.equal(style.fillColor, '#000000');
    const ids = snapshot.selectedIndices.map((index) => layers[index].id);
    assert.deepEqual(ids, [layers[0].id]);
});

test('undo restores the checkpointed document', () => {
    const scene = makeScene();
    seedDocument(scene);
    const repository = makeRepository(scene);
    const history = new DocumentHistory();
    const [first] = repository.shapeLayers();
    history.push(captureDocument(repository, [first.id], first.id));
    repository.shapeLayers().at(-1).remove();
    const current = captureDocument(repository, [], null);
    const layers = restoreDocument(scene, repository, history.undo(current));
    assert.deepEqual(
        layers.map((layer) => layer.name),
        ['First', 'Second'],
    );
});
