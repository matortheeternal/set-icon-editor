import assert from 'node:assert/strict';
import test from 'node:test';

import {
    applyVisualSettings,
    defaultSettings,
    loadSettings,
    normalizeSettings,
    saveSettings,
    SETTINGS_KEY,
} from '../src/shared/settings.js';

function memoryStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
    };
}

test('settings defaults include editable visual preferences', () => {
    assert.deepEqual(defaultSettings(), {
        gridColor: '#36e076',
        showGrid: true,
        shapeFill: '#000000',
        shapeStroke: '#ffffff',
        theme: 'auto',
        handleColor: '#ffffff',
        selectionColor: '#0d99ff',
    });
});

test('normalizeSettings accepts valid values and rejects malformed colors', () => {
    const settings = normalizeSettings({
        gridColor: '#112233',
        showGrid: false,
        shapeFill: 'red',
        shapeStroke: '#445566',
        theme: 'dark',
        handleColor: '#778899',
        selectionColor: '#aabbcc',
    });
    assert.equal(settings.gridColor, '#112233');
    assert.equal(settings.showGrid, false);
    assert.equal(settings.shapeFill, '#000000');
    assert.equal(settings.shapeStroke, '#445566');
    assert.equal(settings.theme, 'dark');
});

test('settings persist through storage and corrupt data falls back', () => {
    const store = memoryStorage();
    const saved = saveSettings({
        ...defaultSettings(),
        theme: 'light',
        showGrid: false,
    }, store);
    assert.deepEqual(loadSettings(store), saved);

    const broken = memoryStorage({ [SETTINGS_KEY]: '{bad json' });
    assert.deepEqual(loadSettings(broken), defaultSettings());
});

test('applyVisualSettings updates injected Paper style targets', () => {
    const shapeStyle = {};
    const handleTheme = {};
    const settings = applyVisualSettings({
        ...defaultSettings(),
        shapeFill: '#123456',
        shapeStroke: '#abcdef',
        handleColor: '#345678',
        selectionColor: '#987654',
    }, { shapeStyle, handleTheme });

    assert.equal(settings.shapeFill, '#123456');
    assert.deepEqual(shapeStyle, {
        fillColor: '#123456',
        strokeColor: '#abcdef',
    });
    assert.equal(handleTheme.handleFill, '#345678');
    assert.equal(handleTheme.anchorFill, '#345678');
    assert.equal(handleTheme.handleStroke, '#987654');
    assert.equal(handleTheme.anchorStroke, '#987654');
    assert.equal(handleTheme.outline, '#987654');
    assert.equal(handleTheme.guideStroke, '#987654');
});
