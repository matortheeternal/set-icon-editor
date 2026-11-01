import './helpers/domSetup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSvg } from '../src/editor/canvas/cleanSvg.js';

function parse(text) {
    return new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
}

test('removes Paper serializer noise while preserving painted geometry', () => {
    const svg = parse(cleanSvg(`<svg xmlns="http://www.w3.org/2000/svg">
        <g xmlns="http://www.w3.org/2000/svg"
        fill="#000000" fill-rule="nonzero" stroke="#ffffff" stroke-width="8"
        stroke-linecap="butt"
        stroke-linejoin="round" stroke-miterlimit="10" stroke-dasharray=""
        stroke-dashoffset="0"
        font-family="none" font-weight="none" font-size="none" text-anchor="none"
        style="mix-blend-mode: normal">
        <path d="M0 0h100v100z"/></g></svg>`));
    const group = svg.querySelector('g');
    const removedAttributes = [
        'xmlns', 'fill-rule', 'stroke-linecap', 'stroke-miterlimit',
        'stroke-dasharray', 'stroke-dashoffset', 'font-family', 'font-weight',
        'font-size', 'text-anchor', 'style',
    ];
    for (const name of removedAttributes) {
        assert.equal(group.hasAttribute(name), false, name);
    }
    assert.equal(group.getAttribute('fill'), '#000000');
    assert.equal(group.getAttribute('stroke'), '#ffffff');
    assert.equal(group.getAttribute('stroke-width'), '8');
    assert.equal(group.getAttribute('stroke-linejoin'), 'round');
    assert.equal(group.querySelector('path').getAttribute('d'), 'M0 0h100v100z');
});

test('preserves default-valued attributes that override inherited values', () => {
    const svg = parse(cleanSvg(`<svg xmlns="http://www.w3.org/2000/svg">
        <g fill-rule="evenodd" stroke-linecap="round">
        <path fill-rule="nonzero" stroke-linecap="butt" stroke-linejoin="miter"
            stroke-miterlimit="10"/>
        </g></svg>`));
    const path = svg.querySelector('path');
    assert.equal(path.getAttribute('fill-rule'), 'nonzero');
    assert.equal(path.getAttribute('stroke-linecap'), 'butt');
    assert.equal(path.getAttribute('stroke-miterlimit'), '10');
});


test('retains miter limits inherited by descendants that change the join', () => {
    const svg = parse(cleanSvg(`<svg xmlns="http://www.w3.org/2000/svg">
        <g stroke-linejoin="round" stroke-miterlimit="10">
            <path stroke-linejoin="miter"/></g>
        </svg>`));
    assert.equal(svg.querySelector('g').getAttribute('stroke-miterlimit'), '10');
});
