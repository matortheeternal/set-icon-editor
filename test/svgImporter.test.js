import assert from 'node:assert/strict';
import test from 'node:test';

import paper from 'paper';

import {
    buildImportedLayers,
    collectPathSources,
} from '../src/editor/canvas/svgImporter.js';

const scope = new paper.PaperScope();
scope.setup(new scope.Size(800, 600));

function makeScene() {
    return { scope };
}

function seedImportTree() {
    const inner = new scope.Path.Rectangle(
        new scope.Rectangle(new scope.Point(30, 30), new scope.Point(40, 40)),
    );
    inner.name = 'Inner';
    const subgroup = new scope.Group([inner]);
    const outer = new scope.Path.Rectangle(
        new scope.Rectangle(new scope.Point(0, 0), new scope.Point(10, 10)),
    );
    return new scope.Group([outer, subgroup]);
}

test('collect finds nested paths with names', () => {
    const imported = seedImportTree();
    const sources = collectPathSources(imported, scope);
    try {
        assert.equal(sources.length, 2);
        assert.equal(sources[1].name, 'Inner');
        assert.ok(sources.every((source) => !source.compound));
        assert.ok(sources.every((source) => source.pathData));
    } finally {
        imported.remove();
    }
});

test('collect keeps compound paths flagged', () => {
    const first = new scope.Path.Circle(new scope.Point(5, 5), 4);
    const second = new scope.Path.Circle(new scope.Point(8, 5), 4);
    const imported = new scope.Group([
        new scope.CompoundPath([first, second]),
    ]);
    try {
        const sources = collectPathSources(imported, scope);
        assert.equal(sources.length, 1);
        assert.equal(sources[0].compound, true);
    } finally {
        imported.remove();
    }
});

test('build creates named shape layers', () => {
    const scene = makeScene();
    const before = scope.project.layers.length;
    const sources = [
        { name: 'Star', compound: false, pathData: 'M0 0h10v10H0Z' },
        { name: '', compound: false, pathData: 'M20 0h10v10H20Z' },
    ];
    const layers = buildImportedLayers(scene, sources);
    try {
        assert.equal(layers.length, 2);
        assert.deepEqual(
            layers.map((layer) => layer.name),
            ['Star', 'Imported 2'],
        );
        for (const layer of layers) {
            assert.equal(layer.data.isShapeLayer, true);
            assert.equal(layer.data.shapeType, 'imported');
            assert.equal(layer.data.mode, 'overlap');
            assert.equal(layer.children.length, 1);
        }
        const fill = layers[0].children[0].style.fillColor;
        assert.equal(fill.equals(new scope.Color('#000000')), true);
    } finally {
        for (const layer of layers) layer.remove();
        assert.equal(scope.project.layers.length, before);
    }
});

test('build clamps degenerate bounds', () => {
    const scene = makeScene();
    const sources = [{ name: '', compound: false, pathData: 'M0 0h10v0Z' }];
    const [layer] = buildImportedLayers(scene, sources);
    try {
        assert.equal(layer.data.width, 10);
        assert.equal(layer.data.height, 1);
    } finally {
        layer.remove();
    }
});
