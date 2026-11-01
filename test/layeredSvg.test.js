import './helpers/domSetup.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import paper from 'paper';

import {
    buildLayersFromProject,
    describeProjectLayers,
    encodeProjectMetadata,
    extractProjectJson,
    metadataElement,
    parseProjectMetadata,
    unescapeMetadataJson,
    escapeMetadataJson,
} from '../src/editor/canvas/layeredSvg.js';
import { serializeScene, wrapSvg } from '../src/editor/canvas/svgExporter.js';
import { importLayers } from '../src/editor/canvas/svgImporter.js';

const scope = new paper.PaperScope();
scope.setup(new scope.Size(512, 512));

function makeScene() {
    return { scope, compositeLayer: scope.project.activeLayer };
}

function cleanTo(before) {
    while (scope.project.layers.length > before) {
        scope.project.layers[scope.project.layers.length - 1].remove();
    }
    assert.equal(scope.project.layers.length, before);
}

function seedShapeLayers() {
    const before = scope.project.layers.length;
    const rect = new scope.Path.Rectangle(
        new scope.Rectangle(new scope.Point(10, 10), new scope.Point(40, 30)),
    );
    const circle = new scope.Path.Circle(new scope.Point(60, 60), 12);
    const layers = [];
    for (const [name, item, shapeType, mode] of [
        ['Base & <Rect>', rect, 'rectangle', 'overlap'],
        ['Hole', circle, 'ellipse', 'difference'],
    ]) {
        const layer = new scope.Layer();
        layer.addChild(item);
        layer.name = name;
        layer.data = {
            isShapeLayer: true, shapeType, mode, width: 10, height: 10, rotation: 0,
        };
        layers.push(layer);
    }
    return {
        layers,
        cleanup() {
            for (const layer of layers) {
                if (layer.isInserted()) layer.remove();
            }
            cleanTo(before);
        },
    };
}

function makeRepository(layers) {
    return {
        shapeLayers: () => layers,
        describeLayer(layer) {
            const shape = layer.children[0] ?? null;
            return shape?.pathData ? {
                name: layer.name,
                data: { ...layer.data },
                pathData: shape.pathData,
                compound: false,
            } : null;
        },
    };
}

test('describe + metadata element round-trips names, types, and modes', () => {
    const { layers, cleanup } = seedShapeLayers();
    try {
        const described = describeProjectLayers(makeRepository(layers));
        assert.equal(described.length, 2);
        assert.equal(described[0].name, 'Base & <Rect>');
        assert.equal(described[0].shapeType, 'rectangle');
        assert.equal(described[1].mode, 'difference');
        const element = metadataElement(described);
        assert.match(element, /<metadata id="set-icon-editor">/);
        // Raw JSON must be XML-escaped inside the element.
        assert.ok(!element.includes('Base & <Rect>'));
        assert.ok(element.includes('Base &amp; &lt;Rect&gt;'));
        const parsed = parseProjectMetadata(wrapSvg('<g/>', 512, 512, element));
        assert.deepEqual(parsed.layers.map((entry) => entry.name), ['Base & <Rect>', 'Hole']);
        assert.deepEqual(
            parsed.layers.map((entry) => [entry.shapeType, entry.mode]),
            [['rectangle', 'overlap'], ['ellipse', 'difference']],
        );
        assert.ok(parsed.layers.every((entry) => entry.pathData));
    } finally {
        cleanup();
    }
});

test('escape round-trips through unescape', () => {
    const raw = '{"name":"a & <b> c"}';
    assert.equal(unescapeMetadataJson(escapeMetadataJson(raw)), raw);
});

test('plain svg without metadata returns null', () => {
    const svg = wrapSvg('<rect width="10" height="10"/>', 512, 512);
    assert.equal(extractProjectJson(svg), null);
    assert.equal(parseProjectMetadata(svg), null);
});

test('corrupt or foreign metadata is ignored safely', () => {
    assert.equal(parseProjectMetadata('<svg><metadata id="set-icon-editor">not json</metadata></svg>'), null);
    assert.equal(
        parseProjectMetadata('<svg><metadata id="set-icon-editor">{"app":"other","layers":[]}</metadata></svg>'),
        null,
    );
    assert.equal(
        parseProjectMetadata('<svg><metadata id="set-icon-editor">{"app":"set-icon-editor","version":1,"layers":[]}</metadata></svg>'),
        null,
    );
    // Unknown shape/mode fall back instead of throwing.
    const parsed = parseProjectMetadata(
        '<svg><metadata id="set-icon-editor">{"app":"set-icon-editor","version":1,"layers":[{"name":"x","shapeType":"nope","mode":"nope","compound":false,"pathData":"M0 0h10v10H0Z"}]}</metadata></svg>',
    );
    assert.equal(parsed.layers[0].shapeType, 'imported');
    assert.equal(parsed.layers[0].mode, 'overlap');
});

test('buildLayersFromProject preserves order, compound, and bounds', () => {
    const scene = makeScene();
    const before = scope.project.layers.length;
    const stored = [
        { name: 'First', shapeType: 'rectangle', mode: 'overlap', compound: false, pathData: 'M0 0h10v10H0Z' },
        { name: 'Second', shapeType: 'star', mode: 'difference', compound: false, pathData: 'M20 0h10v10H20Z' },
    ];
    const layers = buildLayersFromProject(scene, stored);
    try {
        assert.deepEqual(layers.map((layer) => layer.name), ['First', 'Second']);
        assert.deepEqual(
            layers.map((layer) => [layer.data.shapeType, layer.data.mode]),
            [['rectangle', 'overlap'], ['star', 'difference']],
        );
        assert.ok(layers.every((layer) => layer.data.isShapeLayer));
    } finally {
        for (const layer of layers) layer.remove();
        cleanTo(before);
    }
});

test('serializeScene embeds metadata; importLayers restores it', () => {
    const { layers, cleanup } = seedShapeLayers();
    const scene = {
        scope,
        compositeLayer: {
            exportSVG: () => '<g id="flat"><rect width="5" height="5"/></g>',
        },
    };
    try {
        const svg = serializeScene(scene, makeRepository(layers));
        assert.match(svg, /<metadata id="set-icon-editor">/);
        assert.match(svg, /<g id="flat">/);
        const liveScene = { scope };
        const before = scope.project.layers.length;
        const restored = importLayers(liveScene, svg);
        try {
            assert.equal(restored.length, 2);
            assert.deepEqual(restored.map((layer) => layer.name), ['Base & <Rect>', 'Hole']);
            assert.equal(restored[1].data.mode, 'difference');
            assert.equal(restored[1].data.shapeType, 'ellipse');
        } finally {
            for (const layer of restored) layer.remove();
            cleanTo(before);
        }
    } finally {
        cleanup();
    }
});

test('encodeProjectMetadata tags app and version', () => {
    const json = encodeProjectMetadata([{ name: 'a' }]);
    const parsed = JSON.parse(json);
    assert.equal(parsed.app, 'set-icon-editor');
    assert.equal(parsed.version, 1);
});
