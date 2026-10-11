import assert from 'node:assert/strict';
import test from 'node:test';

import { SelectionControls } from
    '../src/editor/canvas/SelectionControls.js';
import { snapToDevicePixel } from
    '../src/editor/canvas/selectionOverlays.js';

let activeLayer = null;

class FakePoint {
    constructor(x = 0, y = 0) {
        Object.assign(this, { x, y });
    }

    rotate() {
        return this;
    }

    add() {
        return this;
    }

    subtract() {
        return new FakePoint();
    }
}

class FakeItem {
    constructor() {
        this.data = {};
        if (activeLayer) activeLayer.children.push(this);
    }
}

class FakePath extends FakeItem {}

FakePath.Line = class extends FakeItem {};
FakePath.Circle = class extends FakeItem {};
FakePath.Rectangle = class extends FakeItem {};

class FakeSize {
    constructor(width, height) {
        Object.assign(this, { width, height });
    }
}

class FakeRectangle {
    constructor(corner, size) {
        void corner;
        void size;
    }
}

const fakeScope = {
    Point: FakePoint,
    Size: FakeSize,
    Rectangle: FakeRectangle,
    Path: FakePath,
};

function makeOverlay() {
    return {
        children: [],
        removeCalls: 0,
        removeChildren() {
            this.removeCalls += 1;
            this.children.length = 0;
        },
        activate() {
            activeLayer = this;
        },
        bringToFront() {},
    };
}

function makeScene(overlay) {
    return {
        scope: fakeScope,
        overlayLayer: overlay,
        update() {},
    };
}

function makeLayer(id) {
    return {
        id,
        position: new FakePoint(10, 10),
        data: { width: 20, height: 20, rotation: 0 },
    };
}

function makeRepository(layers) {
    return {
        layers,
        getMany(ids) {
            const wanted = new Set(ids);
            return this.layers.filter((layer) => wanted.has(layer.id));
        },
        pathItem() {
            return null;
        },
    };
}

function makeCompositor() {
    return {
        rebuildCalls: 0,
        rebuild() {
            this.rebuildCalls += 1;
        },
    };
}

function makeControls() {
    activeLayer = null;
    const overlay = makeOverlay();
    const scene = makeScene(overlay);
    const repository = makeRepository([makeLayer(1)]);
    const compositor = makeCompositor();
    const controls = new SelectionControls(scene, repository, compositor);
    return { controls, overlay, compositor };
}

function selected(id) {
    return { selectedIds: [id], primaryId: id, pointEditingId: null };
}

function emptySelection() {
    return { selectedIds: [], primaryId: null, pointEditingId: null };
}

test('re-rendering a selection does not accumulate handles', () => {
    const { controls, overlay } = makeControls();
    controls.render(selected(1));
    const first = overlay.children.length;
    assert.ok(first > 0);
    controls.render(selected(1));
    assert.equal(overlay.removeCalls, 2);
    assert.equal(overlay.children.length, first);
});

test('deselecting erases handles and borders', () => {
    const { controls, overlay } = makeControls();
    controls.render(selected(1));
    assert.ok(overlay.children.length > 0);
    controls.render(emptySelection());
    assert.equal(overlay.children.length, 0);
});

test('handle centers snap to device pixels before rendering', () => {
    const scene = {
        scope: {
            view: {
                pixelRatio: 2,
                projectToView: (point) => new FakePoint(point.x * 2, point.y * 2),
                viewToProject: (point) => new FakePoint(point.x / 2, point.y / 2),
            },
        },
    };
    const snapped = snapToDevicePixel(scene, new FakePoint(3.13, 4.37));
    assert.deepEqual(
        { x: snapped.x, y: snapped.y },
        { x: 3.25, y: 4.25 },
    );
});
