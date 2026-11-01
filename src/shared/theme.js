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

export function resolveTheme(preference = 'auto', { isDark = null } = {}) {
    const normalized = normalizeThemePreference(preference);
    if (normalized !== 'auto') return normalized;
    const dark = isDark ?? prefersDarkSystem();
    return dark ? 'dark' : 'light';
}

export function applyTheme(theme, root = globalThis.document?.documentElement) {
    const resolved = theme === 'dark' ? 'dark' : 'light';
    root?.classList?.toggle('sl-theme-dark', resolved === 'dark');
    root?.classList?.toggle('sl-theme-light', resolved === 'light');
    if (root?.style) root.style.colorScheme = resolved;
    return resolved;
}

export function watchSystemTheme(onChange) {
    const query = systemMatcher();
    if (!query) return () => {};
    const listener = (event) => onChange(event.matches ? 'dark' : 'light');
    if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', listener);
        return () => query.removeEventListener('change', listener);
    }
    query.addListener?.(listener);
    return () => query.removeListener?.(listener);
}

export function initializeTheme({ preference = 'auto', root, onResolved = null } = {}) {
    const apply = (resolved) => {
        applyTheme(resolved, root);
        onResolved?.(resolved);
    };
    apply(resolveTheme(preference));
    if (normalizeThemePreference(preference) !== 'auto') return () => {};
    return watchSystemTheme(apply);
}
