// Shoelace theme handling: explicit light/dark preference with system
// auto-detect. Shoelace ships both token sets and scopes the dark tokens
// under `.sl-theme-dark`, so switching themes is a class toggle on the
// document root. This module stays DOM-light so it can be unit tested in
// Node: every browser access is injectable or guarded.

export const THEME_PREFERENCES = ['auto', 'light', 'dark'];

export function normalizeThemePreference(value) {
    const normalized = String(value ?? 'auto').trim().toLowerCase();
    return THEME_PREFERENCES.includes(normalized) ? normalized : 'auto';
}

function systemMatcher() {
    if (typeof globalThis.matchMedia !== 'function') return null;
    try {
        return globalThis.matchMedia('(prefers-color-scheme: dark)');
    } catch {
        return null;
    }
}

export function prefersDarkSystem() {
    return systemMatcher()?.matches ?? false;
}

// Resolves a stored preference ('auto' follows the OS) to a concrete
// 'light' | 'dark' theme. `isDark` is an injectable for tests.
export function resolveTheme(preference = 'auto', { isDark = null } = {}) {
    const normalized = normalizeThemePreference(preference);
    if (normalized !== 'auto') return normalized;
    const dark = isDark ?? prefersDarkSystem();
    return dark ? 'dark' : 'light';
}

// Applies a concrete theme by toggling the Shoelace theme classes.
// Returns the applied theme. `root` defaults to the document element
// when a DOM is present and is injectable for tests.
export function applyTheme(theme, root = globalThis.document?.documentElement) {
    const resolved = theme === 'dark' ? 'dark' : 'light';
    root?.classList?.toggle('sl-theme-dark', resolved === 'dark');
    root?.classList?.toggle('sl-theme-light', resolved === 'light');
    if (root?.style) root.style.colorScheme = resolved;
    return resolved;
}

// Subscribes to OS theme changes; returns an unsubscribe function.
export function watchSystemTheme(onChange) {
    const query = systemMatcher();
    if (!query) return () => {};
    const listener = (event) => onChange(event.matches ? 'dark' : 'light');
    if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', listener);
        return () => query.removeEventListener('change', listener);
    }
    // Safari < 14 MediaQueryList API.
    query.addListener?.(listener);
    return () => query.removeListener?.(listener);
}

// Resolves `preference`, applies it, and — for 'auto' — keeps following
// the OS until the returned unsubscribe function is called.
export function initializeTheme({ preference = 'auto', root, onResolved = null } = {}) {
    const apply = (resolved) => {
        applyTheme(resolved, root);
        onResolved?.(resolved);
    };
    apply(resolveTheme(preference));
    if (normalizeThemePreference(preference) !== 'auto') return () => {};
    return watchSystemTheme(apply);
}
