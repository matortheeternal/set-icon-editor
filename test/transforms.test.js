import assert from 'node:assert/strict';
import test from 'node:test';

import { TransformController } from
    '../src/editor/canvas/TransformController.js';

class FakePoint {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    get angle() {
        return Math.atan2(this.y, this.x) * 180 / Math.PI;
    }

    add(other) {
        return new FakePoint(this.x + other.x, this.y + other.y);
    }

    subtract(other) {
        return new FakePoint(this.x - other.x, this.y - other.y);
    }

    rotate(degrees) {
        const radians = degrees * Math.PI / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        return new FakePoint(
            this.x * cos - this.y * sin,
            this.x * sin + this.y * cos,
        );
    }

    clone() {
        return new FakePoint(this.x, this.y);
    }
}

function makeLayer(id, x, y) {
    return {
        id,
        position: new FakePoint(x, y),
        data: { width: 10, height: 10, rotation: 0 },
        rotates: [],
        scales: [],
        rotate(delta, center) {
            this.rotates.push({ delta, center });
        },
        scale(sx, sy, center) {
            this.scales.push({ sx, sy, center });
        },
    };
}

function makeController() {
    const scene = { scope: { Point: FakePoint } };
    const repository = {
        pathItem: (layer) => layer.item ?? null,
        syncScaledBounds(layer) {
            const item = this.pathItem(layer);
            if (!item) return;
            layer.data.width = Math.max(1, item.bounds.width);
            layer.data.height = Math.max(1, item.bounds.height);
        },
    };
    let commits = 0;
    const controller = new TransformController(scene, repository, () => {
        commits += 1;
    });
    return { controller, commits: () => commits };
}

function dragTo(controller, x, y, modifiers = { shift: false }) {
    return controller.update({
        point: new FakePoint(x, y),
        modifiers,
    });
}

function dragBy(controller, x, y, modifiers = {}) {
    return controller.update({
        point: new FakePoint(),
        delta: new FakePoint(x, y),
        modifiers,
    });
}

function atAngle(degrees, radius = 10) {
    const radians = degrees * Math.PI / 180;
    return new FakePoint(
        radius * Math.cos(radians),
        radius * Math.sin(radians),
    );
}

test('group rotation shares one origin', () => {
    const first = makeLayer(1, 0, 0);
    const second = makeLayer(2, 20, 0);
    const { controller, commits } = makeController();
    controller.beginRotate([first, second], new FakePoint(10, 10));
    assert.ok(dragTo(controller, 0, 0));
    assert.equal(commits(), 1);
    assert.equal(first.rotates.length, 1);
    assert.equal(second.rotates.length, 1);
    assert.equal(first.rotates[0].delta, 90);
    assert.equal(second.rotates[0].delta, 90);
    assert.strictEqual(first.rotates[0].center, second.rotates[0].center);
    assert.deepEqual(
        { x: first.rotates[0].center.x, y: first.rotates[0].center.y },
        { x: 10, y: 0 },
    );
    assert.equal(first.data.rotation, 90);
    assert.equal(second.data.rotation, 90);
});

test('group scale shares one anchor and keeps rotations', () => {
    const first = makeLayer(1, 0, 0);
    const second = makeLayer(2, 20, 0);
    first.item = { bounds: { width: 15, height: 15 } };
    second.item = { bounds: { width: 15, height: 15 } };
    const { controller } = makeController();
    controller.beginScale([first, second], 'se');
    assert.ok(dragTo(controller, 40, 10));
    assert.equal(first.scales.length, 1);
    assert.equal(second.scales.length, 1);
    const [a] = first.scales;
    const [b] = second.scales;
    assert.equal(a.sx, 1.5);
    assert.equal(a.sy, 1.5);
    assert.strictEqual(a.center, b.center);
    assert.deepEqual({ x: a.center.x, y: a.center.y }, { x: -5, y: -5 });
    assert.equal(first.data.width, 15);
    assert.equal(second.data.height, 15);
    assert.equal(first.data.rotation, 0);
});

test('single-layer scale keeps its exact behavior', () => {
    const layer = makeLayer(1, 5, 5);
    const { controller } = makeController();
    controller.beginScale([layer], 'se');
    assert.ok(dragTo(controller, 15, 5));
    assert.equal(layer.scales.length, 1);
    const [scale] = layer.scales;
    assert.equal(scale.sx, 1.5);
    assert.equal(scale.sy, 0.5);
    assert.deepEqual(
        { x: scale.center.x, y: scale.center.y },
        { x: 0, y: 0 },
    );
    assert.deepEqual(
        { width: layer.data.width, height: layer.data.height },
        { width: 15, height: 5 },
    );
});

test('holding Ctrl snaps rotation to 15-degree steps', () => {
    const layer = makeLayer(1, 0, 0);
    const { controller } = makeController();
    const ctrl = { control: true };
    controller.beginRotate([layer], atAngle(0));
    assert.ok(dragTo(controller, atAngle(10).x, atAngle(10).y, ctrl));
    assert.equal(layer.rotates.length, 1);
    assert.equal(layer.rotates[0].delta, 15);
    assert.equal(layer.data.rotation, 15);
    assert.ok(dragTo(controller, atAngle(20).x, atAngle(20).y, ctrl));
    assert.equal(layer.rotates.length, 1);
    assert.equal(layer.data.rotation, 15);
    assert.ok(dragTo(controller, atAngle(25).x, atAngle(25).y, ctrl));
    assert.equal(layer.rotates.length, 2);
    assert.equal(layer.rotates[1].delta, 15);
    assert.equal(layer.data.rotation, 30);
    assert.ok(dragTo(controller, atAngle(40).x, atAngle(40).y));
    assert.ok(Math.abs(layer.data.rotation - 40) < 1e-9);
});

test('Ctrl rotation snaps the resulting global angle', () => {
    const layer = makeLayer(1, 0, 0);
    layer.data.rotation = 8;
    const { controller } = makeController();
    controller.beginRotate([layer], atAngle(0));
    assert.ok(dragTo(controller, atAngle(4).x, atAngle(4).y, {
        control: true,
    }));
    assert.equal(layer.data.rotation, 15);
    assert.equal(layer.rotates[0].delta, 7);
});

test('Ctrl movement snaps a layer center to the minor grid', () => {
    const layer = makeLayer(1, 10, 18);
    const { controller } = makeController();
    controller.beginMove(layer);
    assert.ok(dragBy(controller, 7, 8, { control: true }));
    assert.deepEqual(
        { x: layer.position.x, y: layer.position.y },
        { x: 32, y: 32 },
    );
    assert.ok(dragBy(controller, 20, 28, { control: true }));
    assert.deepEqual(
        { x: layer.position.x, y: layer.position.y },
        { x: 32, y: 64 },
    );
});

test('scaling can cross zero and produces a reflected frame', () => {
    const layer = makeLayer(1, 5, 5);
    const { controller } = makeController();
    controller.beginScale(layer, 'e');
    assert.ok(dragTo(controller, -5, 5));
    assert.equal(layer.data.width, -5);
    assert.equal(layer.data.height, 10);
    assert.equal(layer.scales.length, 1);
    assert.equal(layer.scales[0].sx, -0.5);
});

test('an exact-zero scale can continue through the singularity', () => {
    const layer = makeLayer(1, 5, 5);
    const { controller } = makeController();
    controller.beginScale(layer, 'e');
    assert.ok(dragTo(controller, 0, 5));
    assert.equal(layer.data.width, 10);
    assert.ok(dragTo(controller, -5, 5));
    assert.equal(layer.data.width, -5);
    assert.equal(layer.scales.at(-1).sx, -0.5);
});
