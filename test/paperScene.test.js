import assert from 'node:assert/strict';
import test from 'node:test';
import paper from 'paper';

import { PaperScene, scaledCanvasEventPoint } from
    '../src/editor/canvas/PaperScene.js';

function makeScope() {
    return {
        Point: class Point {
            constructor(x, y) {
                this.x = x;
                this.y = y;
            }
        },
        view: {
            viewSize: { width: 512, height: 512 },
            viewToProject: (point) => point,
        },
    };
}

test('scaledCanvasEventPoint reverses a uniform CSS canvas scale', () => {
    const canvas = {
        getBoundingClientRect: () => ({
            left: 100,
            top: 50,
            width: 256,
            height: 256,
        }),
    };
    const point = scaledCanvasEventPoint(makeScope(), canvas, {
        clientX: 228,
        clientY: 114,
    });
    assert.deepEqual({ x: point.x, y: point.y }, { x: 256, y: 128 });
});

test('scaledCanvasEventPoint supports touch events and invalid bounds', () => {
    const scope = makeScope();
    const canvas = {
        getBoundingClientRect: () => ({
            left: 10,
            top: 20,
            width: 1024,
            height: 1024,
        }),
    };
    const point = scaledCanvasEventPoint(scope, canvas, {
        targetTouches: [{ clientX: 522, clientY: 276 }],
    });
    assert.deepEqual({ x: point.x, y: point.y }, { x: 256, y: 128 });

    canvas.getBoundingClientRect = () => ({ width: 0, height: 0 });
    assert.equal(scaledCanvasEventPoint(scope, canvas, {}), null);
});

test('PaperScene viewport can grow without changing or displacing the export document', () => {
    let bounds = { width: 640, height: 640 };
    const canvas = {
        width: 640,
        height: 640,
        getContext: () => null,
        getBoundingClientRect: () => bounds,
    };
    const scene = new PaperScene(paper, canvas);
    assert.equal(scene.scope.view.viewSize.width, 640);
    assert.equal(scene.scope.view.center.x, 256);
    assert.equal(scene.documentSize.width, 512);
    assert.equal(scene.projectUnitsPerCssPixel(), 1);
    bounds = { width: 1200, height: 800 };
    scene.resize(1200, 800, 0.5);
    assert.equal(scene.scope.view.viewSize.width, 1200);
    assert.equal(scene.scope.view.viewSize.height, 800);
    assert.equal(scene.scope.view.center.x, 256);
    assert.equal(scene.scope.view.center.y, 256);
    assert.equal(scene.scope.view.zoom, 0.5);
    assert.equal(scene.documentSize.width, 512);
    assert.equal(scene.projectUnitsPerCssPixel(), 2);
    scene.destroy();
});
