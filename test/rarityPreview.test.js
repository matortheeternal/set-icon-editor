import './helpers/domSetup.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
    applyRarity,
    previewMarkup,
} from '../src/editor/preview/rarityPreview.js';
import {
    BUILT_IN_RARITIES,
    deleteCustomRarity,
    findRarity,
    loadCustomRarities,
    saveCustomRarity,
} from '../src/editor/preview/rarityPresets.js';

function memoryStorage(seed = {}) {
    const data = { ...seed };
    return {
        getItem: (key) => data[key] ?? null,
        setItem: (key, value) => { data[key] = String(value); },
    };
}

const SAMPLE = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"',
    'viewBox="0 0 512 512">',
    '<metadata id="layered-project">{"app":"x"}</metadata>',
    '<g><path d="M0 0h10v10H0z" fill="#000000" stroke="#ffffff" stroke-width="8"/>',
    '<circle cx="5" cy="5" r="2" fill="none" stroke="none"/></g>',
    '</svg>',
].join('\n');

test('built-in rarities match the card-magician M15 values', () => {
    const byId = Object.fromEntries(BUILT_IN_RARITIES.map((entry) => [entry.id, entry]));
    assert.deepEqual(
        [byId.uncommon.g1, byId.uncommon.g2, byId.uncommon.g3, byId.uncommon.g4],
        ['#6c7d8f', '#c0d6e5', '#c0d6e5', '#9ab4c8'],
    );
    assert.deepEqual(
        [byId.rare.g1, byId.rare.g2, byId.rare.g3, byId.rare.g4],
        ['#876c13', '#f6e8a3', '#f6e8a3', '#d7bf55'],
    );
    assert.deepEqual(
        [byId.mythic.g1, byId.mythic.g2, byId.mythic.g3, byId.mythic.g4],
        ['#b02929', '#ffb347', '#ffb347', '#ff8a00'],
    );
    assert.deepEqual(
        [byId.special.g1, byId.special.g4],
        ['#240f3d', '#1a0a34'],
    );
    assert.equal(byId.common.outline, '#ffffff');
    assert.equal(byId.rare.outline, '#000000');
});

test('applyRarity swaps fills for the gradient and strokes for the outline', () => {
    const rare = findRarity('rare');
    const out = applyRarity(SAMPLE, rare);
    assert.match(out, /fill="url\(#set-rarity-\d+-paint\)"/);
    assert.match(out, /stroke="#000000"/);
    assert.ok(!out.includes('fill="#000000"'));
    assert.match(out, /fill="none"/);
    assert.match(out, /stroke="none"/);
    assert.ok(!out.includes('<metadata'));
    const svg = new DOMParser().parseFromString(out, 'image/svg+xml');
    const expectedStops = [
        ['0%', '#876c13'],
        ['45%', '#f6e8a3'],
        ['55%', '#f6e8a3'],
        ['100%', '#d7bf55'],
    ];
    for (const [offset, color] of expectedStops) {
        const stop = svg.querySelector(`stop[offset="${offset}"]`);
        assert.equal(stop.getAttribute('stop-color'), color);
    }
});

test('applyRarity tolerates empty input and previewMarkup strips the prolog', () => {
    assert.equal(applyRarity('', findRarity('common')), '');
    assert.equal(applyRarity(null, findRarity('common')), '');
    const markup = previewMarkup(SAMPLE, findRarity('common'));
    assert.ok(!markup.startsWith('<?xml'));
    assert.match(markup, /^<svg/);
});

test('applyRarity rejects arbitrary preset values in SVG attributes', () => {
    const output = applyRarity(SAMPLE, {
        g1: '#123456" onload="alert(1)',
        outline: 'red" onload="alert(1)',
    });
    assert.ok(!output.includes('onload'));
    assert.match(output, /stop-color="#000000"/);
    assert.match(output, /stroke="#ffffff"/);
});

test('custom rarities round-trip through storage', () => {
    const storage = memoryStorage();
    assert.deepEqual(loadCustomRarities(storage), []);
    const afterSave = saveCustomRarity({
        name: '  My foil  ',
        g1: '#111111',
        g2: '#222222',
        g3: '#333333',
        g4: '#444444',
        outline: '#eeeeee',
    }, storage);
    assert.equal(afterSave.length, 1);
    assert.equal(afterSave[0].name, 'My foil');
    assert.equal(afterSave[0].custom, true);
    assert.deepEqual(loadCustomRarities(storage), afterSave);
    const missing = findRarity('nope', storage);
    assert.equal(missing.id, 'common');
    const afterDelete = deleteCustomRarity(afterSave[0].id, storage);
    assert.deepEqual(afterDelete, []);
    assert.deepEqual(loadCustomRarities(storage), []);
});

test('corrupt storage falls back to an empty custom list', () => {
    const storage = memoryStorage({
        'set-icon-editor.rarities': 'not json{{{',
    });
    assert.deepEqual(loadCustomRarities(storage), []);
    assert.equal(findRarity('uncommon', storage).id, 'uncommon');
});
