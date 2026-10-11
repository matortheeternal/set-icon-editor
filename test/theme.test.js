import assert from 'node:assert/strict';
import test from 'node:test';

import {
    applyTheme,
    initializeTheme,
    normalizeThemePreference,
    resolveTheme,
} from '../src/shared/theme.js';

function fakeRoot() {
    const classes = new Set();
    return {
        classList: {
            toggle: (name, force) => {
                if (force) classes.add(name);
                else classes.delete(name);
            },
            contains: (name) => classes.has(name),
        },
        style: {},
    };
}

test('normalizeThemePreference accepts light/dark/auto and falls back to auto', () => {
    assert.equal(normalizeThemePreference('dark'), 'dark');
    assert.equal(normalizeThemePreference('LIGHT'), 'light');
    assert.equal(normalizeThemePreference('auto'), 'auto');
    assert.equal(normalizeThemePreference('system'), 'auto');
    assert.equal(normalizeThemePreference(null), 'auto');
    assert.equal(normalizeThemePreference(undefined), 'auto');
});

test('resolveTheme honors explicit preferences and follows the system for auto', () => {
    assert.equal(resolveTheme('dark', { isDark: false }), 'dark');
    assert.equal(resolveTheme('light', { isDark: true }), 'light');
    assert.equal(resolveTheme('auto', { isDark: true }), 'dark');
    assert.equal(resolveTheme('auto', { isDark: false }), 'light');
});

test('applyTheme toggles the Shoelace theme classes and color scheme', () => {
    const root = fakeRoot();
    assert.equal(applyTheme('dark', root), 'dark');
    assert.equal(root.classList.contains('sl-theme-dark'), true);
    assert.equal(root.classList.contains('sl-theme-light'), false);
    assert.equal(root.style.colorScheme, 'dark');

    assert.equal(applyTheme('light', root), 'light');
    assert.equal(root.classList.contains('sl-theme-dark'), false);
    assert.equal(root.classList.contains('sl-theme-light'), true);
    assert.equal(root.style.colorScheme, 'light');
});

test('initializeTheme applies an explicit preference without watching the OS', () => {
    const root = fakeRoot();
    const seen = [];
    const unwatch = initializeTheme({
        preference: 'dark',
        root,
        onResolved: (theme) => seen.push(theme),
    });
    assert.equal(root.classList.contains('sl-theme-dark'), true);
    assert.deepEqual(seen, ['dark']);
    // No system watcher was installed, so unsubscribing is a safe no-op.
    unwatch();
});

test('initializeTheme resolves auto without a DOM or matchMedia', () => {
    const root = fakeRoot();
    const seen = [];
    const unwatch = initializeTheme({ preference: 'auto', root, onResolved: (theme) => seen.push(theme) });
    assert.ok(['light', 'dark'].includes(seen[0]));
    unwatch();
});
