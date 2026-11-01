import './helpers/domSetup.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
    canvasOpacityMask,
    DEFAULT_DOCUMENT_SIZE,
    GRID_MAJOR_DIVISIONS,
    GRID_MINOR_DIVISIONS,
    MAX_ARTBOARD_DISPLAY_SIZE,
    STANDARD_DOCUMENT_SIZES,
    fitDocumentScale,
    gridBackgroundImage,
    gridVisualColors,
    nearestStandardSize,
    normalizeExportFrame,
} from '../src/editor/canvas/documentSize.js';
import { serializeScene, wrapSvg } from '../src/editor/canvas/svgExporter.js';

test('nearestStandardSize quantizes to the 128/256/512/1024 ladder', () => {
    assert.equal(nearestStandardSize(512), 512);
    assert.equal(nearestStandardSize(623), 512);
    assert.equal(nearestStandardSize(800), 1024);
    assert.equal(nearestStandardSize(300), 256);
    assert.equal(nearestStandardSize(100), 128);
    assert.equal(nearestStandardSize(64), 128);
    assert.equal(nearestStandardSize(2000), 1024);
});

test('nearestStandardSize rounds ties up and falls back for junk', () => {
    assert.equal(nearestStandardSize(384), 512);
    assert.equal(nearestStandardSize(0), DEFAULT_DOCUMENT_SIZE);
    assert.equal(nearestStandardSize(-40), DEFAULT_DOCUMENT_SIZE);
    assert.equal(nearestStandardSize(Number.NaN), DEFAULT_DOCUMENT_SIZE);
    assert.equal(nearestStandardSize('nope'), DEFAULT_DOCUMENT_SIZE);
});

test('normalizeExportFrame preserves aspect around the long edge', () => {
    assert.deepEqual(normalizeExportFrame(623, 623), { width: 512, height: 512 });
    assert.deepEqual(normalizeExportFrame(800, 600), { width: 1024, height: 768 });
    assert.deepEqual(normalizeExportFrame(200, 200), { width: 256, height: 256 });
    assert.deepEqual(normalizeExportFrame(0, 0), { width: 512, height: 512 });
});

test('fitDocumentScale uniformly fits the whole document in the viewport', () => {
    assert.equal(fitDocumentScale(512, 512), 1);
    assert.equal(fitDocumentScale(256, 400), 0.5);
    assert.equal(fitDocumentScale(900, 600), 600 / 512);
    assert.equal(
        fitDocumentScale(1200, 1000),
        MAX_ARTBOARD_DISPLAY_SIZE / DEFAULT_DOCUMENT_SIZE,
    );
});

test('fitDocumentScale accepts an outer artboard size and safe fallbacks', () => {
    assert.equal(fitDocumentScale(257, 400, 514), 0.5);
    assert.equal(fitDocumentScale(0, Number.NaN, 512), 1 / 512);
});

test('canvasOpacityMask dims only canvas pixels outside the centered export frame', () => {
    const mask = canvasOpacityMask(1000, 800, 1);
    const match = mask.match(/^url\("data:image\/svg\+xml,(.*)"\)$/);
    assert.ok(match);
    const svg = decodeURIComponent(match[1]);
    assert.match(svg, /viewBox="0 0 1000 800"/);
    assert.match(svg, /fill-opacity="0.42"/);
    assert.match(svg, /x="244" y="144" width="512" height="512"/);

    const scaled = decodeURIComponent(
        canvasOpacityMask(500, 400, 0.5).match(/,(.*)"\)$/)[1],
    );
    assert.match(scaled, /x="122" y="72" width="256" height="256"/);
});

test('grid divisions split every standard size into whole units', () => {
    for (const size of STANDARD_DOCUMENT_SIZES) {
        assert.equal(size % GRID_MAJOR_DIVISIONS, 0);
        assert.equal(size % GRID_MINOR_DIVISIONS, 0);
    }
    assert.equal(512 / GRID_MAJOR_DIVISIONS, 128);
    assert.equal(512 / GRID_MINOR_DIVISIONS, 32);
});

function decodeGridUrl(css) {
    const match = css.match(/^url\("data:image\/svg\+xml,(.*)"\)$/);
    assert.ok(match, `expected a data-uri grid, got: ${css}`);
    return decodeURIComponent(match[1]);
}

test('gridBackgroundImage draws one exact major-over-minor grid', () => {
    const svg = decodeGridUrl(gridBackgroundImage());
    assert.match(svg, /viewBox="0 0 16 16"/);
    assert.match(svg, /crispEdges/);
    assert.match(svg, /non-scaling-stroke/);
    // Minor layer first, major painted over the coincident lines.
    assert.ok(svg.indexOf('stroke-opacity="0.08"') < svg.indexOf('stroke-opacity="0.18"'));
    // Quarter lines exist exactly once: no doubled major+minor lines.
    assert.equal((svg.match(/M4 0V16/g) ?? []).length, 1);
    assert.equal((svg.match(/M0 4H16/g) ?? []).length, 1);
    assert.match(svg, /M16 0V16/);
});

test('gridBackgroundImage honors custom divisions', () => {
    const svg = decodeGridUrl(gridBackgroundImage(2, 8));
    assert.match(svg, /viewBox="0 0 8 8"/);
    assert.equal((svg.match(/M4 0V8/g) ?? []).length, 1);
});

test('gridBackgroundImage accepts a settings color', () => {
    const svg = decodeGridUrl(gridBackgroundImage(4, 16, '#112233'));
    assert.match(svg, /stroke="#112233"/);
    assert.doesNotMatch(svg, /#36e076/);
});

test('gridVisualColors derives the artboard shade and border from grid color', () => {
    const green = gridVisualColors('#36e076');
    const red = gridVisualColors('#ff0000');
    assert.equal(green.line, '#36e076');
    assert.equal(red.line, '#ff0000');
    assert.notEqual(green.shade, red.shade);
    assert.notEqual(green.border, red.border);
    assert.match(red.shade, /^#[0-9a-f]{6}$/);
    assert.match(red.border, /^#[0-9a-f]{6}$/);
    assert.deepEqual(gridVisualColors('bad'), green);
});

test('wrapSvg keeps the frame viewBox by default and honors overrides', () => {
    const plain = wrapSvg('<g/>', 512, 512);
    assert.match(plain, /width="512" height="512" viewBox="0 0 512 512"/);
    const framed = wrapSvg('<g/>', 512, 512, null, '0 0 623 623');
    assert.match(framed, /width="512" height="512" viewBox="0 0 623 623"/);
});

test('serializeScene normalizes the frame but keeps document coordinates', () => {
    const scene = {
        scope: { view: { viewSize: { width: 623, height: 623 } } },
        compositeLayer: { exportSVG: () => '<g><rect width="5" height="5"/></g>' },
    };
    const svg = serializeScene(scene, null);
    assert.match(svg, /width="512" height="512" viewBox="0 0 623 623"/);
    assert.match(svg, /<rect width="5" height="5"\s*\/>/);
});
