import assert from 'node:assert/strict';
import test from 'node:test';

import { localize } from '../src/shared/localize.js';
import {
    SHAPES, SHAPE_STYLE, shapeForShortcut, shapeForType,
} from '../src/editor/Shape.js';

class Point {
    constructor(x, y) {
        Object.assign(this, { x, y });
    }

    add(point) {
        return new Point(this.x + point.x, this.y + point.y);
    }

    subtract(point) {
        return new Point(this.x - point.x, this.y - point.y);
    }

    getDistance(point) {
        return Math.hypot(this.x - point.x, this.y - point.y);
    }
}

class Rectangle {
    constructor(start, end) {
        this.width = Math.abs(end.x - start.x);
        this.height = Math.abs(end.y - start.y);
    }
}

function path(kind, properties) {
    return { kind, ...properties };
}

class RectanglePath {
    constructor(bounds) {
        return path('rectangle', { bounds });
    }
}

class EllipsePath {
    constructor({ rectangle }) {
        return path('ellipse', { bounds: rectangle });
    }
}

class PolygonPath {
    constructor(center, points, radius) {
        return path('polygon', { center, points, radius });
    }
}

class StarPath {
    constructor(center, points, innerRadius, radius) {
        return path('star', { center, points, innerRadius, radius });
    }
}

const scope = {
    Point,
    Rectangle,
    Path: {
        Rectangle: RectanglePath,
        Ellipse: EllipsePath,
        RegularPolygon: PolygonPath,
        Star: StarPath,
    },
};

test('shape catalog owns identity, labels, shortcuts, and icons', () => {
    const L = localize('editor');
    const types = SHAPES.map(({ type }) => type);
    assert.deepEqual(types, ['rectangle', 'ellipse', 'polygon', 'star']);
    assert.equal(shapeForShortcut('g'), shapeForType('polygon'));
    const name = shapeForType('rectangle').name(L, 2);
    assert.equal(name, 'Rectangle 2');
    assert.ok(SHAPES.every(({ icon }) => icon.startsWith('<')));
    const previews = SHAPES.every(({ preview }) => preview.startsWith('<svg'));
    assert.ok(previews);
    assert.equal(shapeForType('unknown'), null);
    assert.equal(shapeForShortcut('x'), null);
});

test('rectangle and ellipse constrain both dimensions with Shift', () => {
    const drawing = { start: new Point(1, 2) };
    const end = new Point(5, 10);
    const rectangle = shapeForType('rectangle').create(scope, drawing, end, true);
    const ellipse = shapeForType('ellipse').create(scope, drawing, end, true);
    assert.deepEqual([rectangle.bounds.width, rectangle.bounds.height], [8, 8]);
    const size = [ellipse.bounds.width, ellipse.bounds.height];
    assert.deepEqual(size, [8, 8]);
    assert.equal(rectangle.style, SHAPE_STYLE);
});

test('polygon and star use drawing point count and center radius', () => {
    const drawing = { start: new Point(0, 0), pointCount: 7 };
    const point = new Point(0, 10);
    const polygon = shapeForType('polygon').create(scope, drawing, point);
    const star = shapeForType('star').create(scope, drawing, point);
    assert.deepEqual([polygon.points, polygon.radius], [7, 10]);
    assert.deepEqual([star.points, star.radius], [7, 10]);
    assert.ok(Math.abs(star.innerRadius - 4.6) < 1e-12);
    assert.equal(star.style, SHAPE_STYLE);
});

test('shape creation ignores zero-sized gestures', () => {
    const point = new Point(3, 3);
    const tiny = { start: point };
    assert.equal(shapeForType('rectangle').create(scope, tiny, point), null);
    const starDraft = { start: point, pointCount: 5 };
    assert.equal(shapeForType('star').create(scope, starDraft, point), null);
});
