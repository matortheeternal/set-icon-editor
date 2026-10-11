import assert from 'node:assert/strict';
import test from 'node:test';

import {
    SelectionModel,
    rangeBetween,
} from '../src/editor/SelectionModel.js';

test('replace anchors to the primary id', () => {
    const selection = new SelectionModel();
    selection.replace([3, 7]);
    assert.equal(selection.primaryId, 7);
    assert.equal(selection.anchorId, 7);
    selection.replace([]);
    assert.equal(selection.anchorId, null);
});

test('toggle re-anchors to the acted id', () => {
    const selection = new SelectionModel();
    selection.replace([3]);
    selection.toggle(7);
    assert.deepEqual(selection.toArray(), [3, 7]);
    assert.equal(selection.anchorId, 7);
    selection.toggle(7);
    assert.deepEqual(selection.toArray(), [3]);
    assert.equal(selection.anchorId, 7);
});

test('rangeBetween takes the contiguous display slice', () => {
    const ordered = [30, 20, 10];
    assert.deepEqual(rangeBetween(ordered, 30, 10), [30, 20, 10]);
    assert.deepEqual(rangeBetween(ordered, 10, 30), [30, 20, 10]);
    assert.deepEqual(rangeBetween(ordered, 20, 20), [20]);
    assert.deepEqual(rangeBetween(ordered, 999, 10), [10]);
});

test('replaceRange selects the anchor-to-target span', () => {
    const selection = new SelectionModel();
    selection.replace([30]);
    selection.replaceRange([30, 20, 10], 10);
    assert.deepEqual(selection.toArray(), [30, 20, 10]);
    assert.equal(selection.primaryId, 10);
    assert.equal(selection.anchorId, 10);
});

test('replaceRange with extend unions the span', () => {
    const selection = new SelectionModel();
    selection.replace([30]);
    selection.replaceRange([40, 30, 20, 10], 10, true);
    assert.deepEqual(selection.toArray(), [30, 20, 10]);
    selection.replace([40]);
    selection.replaceRange([40, 30, 20, 10], 10, true);
    assert.deepEqual(selection.toArray(), [40, 30, 20, 10]);
    assert.equal(selection.primaryId, 10);
});

test('removeIds keeps survivors and re-anchors', () => {
    const selection = new SelectionModel();
    selection.replace([1, 2, 3]);
    selection.removeIds([2, 3]);
    assert.deepEqual(selection.toArray(), [1]);
    assert.equal(selection.primaryId, 1);
    assert.equal(selection.anchorId, 1);
});
