
import { GRID_LINE } from
    '../editor/canvas/documentSize.js';

export const SETTINGS_KEY = 'set-icon-editor.settings';

export const DEFAULT_SHAPE_FILL = '#000000';
export const DEFAULT_SHAPE_STROKE = '#ffffff';
export const DEFAULT_HANDLE_COLOR = '#ffffff';
export const DEFAULT_SELECTION_COLOR = '#0d99ff';

export function defaultSettings() {
    return {
        gridColor: GRID_LINE,
        showGrid: true,
        shapeFill: DEFAULT_SHAPE_FILL,
        shapeStroke: DEFAULT_SHAPE_STROKE,
        theme: 'auto',
        handleColor: DEFAULT_HANDLE_COLOR,
        selectionColor: DEFAULT_SELECTION_COLOR,
    };
}

function isHexColor(value) {
    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function normalizeSettings(value) {
    const defaults = defaultSettings();
    const stored = value != null && typeof value === 'object' ? value : {};
    return {
        gridColor: isHexColor(stored.gridColor)
            ? stored.gridColor
            : defaults.gridColor,
        showGrid: typeof stored.showGrid === 'boolean'
            ? stored.showGrid
            : defaults.showGrid,
        shapeFill: isHexColor(stored.shapeFill)
            ? stored.shapeFill
            : defaults.shapeFill,
        shapeStroke: isHexColor(stored.shapeStroke)
            ? stored.shapeStroke
            : defaults.shapeStroke,
        theme: ['auto', 'light', 'dark'].includes(stored.theme)
            ? stored.theme
            : defaults.theme,
        handleColor: isHexColor(stored.handleColor)
            ? stored.handleColor
            : defaults.handleColor,
        selectionColor: isHexColor(stored.selectionColor)
            ? stored.selectionColor
            : defaults.selectionColor,
    };
}

function storage(localStorageOverride = undefined) {
    if (localStorageOverride !== undefined) return localStorageOverride;
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

export function loadSettings(store = storage()) {
    if (!store) return defaultSettings();
    try {
        const raw = store.getItem(SETTINGS_KEY);
        if (!raw) return defaultSettings();
        return normalizeSettings(JSON.parse(raw));
    } catch {
        return defaultSettings();
    }
}

export function saveSettings(settings, store = storage()) {
    const normalized = normalizeSettings(settings);
    try {
        store?.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    } catch {}
    return normalized;
}

export function applyVisualSettings(
    settings,
    { shapeStyle = null, handleTheme = null } = {},
) {
    const normalized = normalizeSettings(settings);
    if (shapeStyle) {
        shapeStyle.fillColor = normalized.shapeFill;
        shapeStyle.strokeColor = normalized.shapeStroke;
    }
    if (handleTheme) {
        handleTheme.handleFill = normalized.handleColor;
        handleTheme.anchorFill = normalized.handleColor;
        handleTheme.handleStroke = normalized.selectionColor;
        handleTheme.anchorStroke = normalized.selectionColor;
        handleTheme.handleSelectedFill = normalized.selectionColor;
        handleTheme.anchorSelectedFill = normalized.selectionColor;
        handleTheme.outline = normalized.selectionColor;
        handleTheme.guideStroke = normalized.selectionColor;
    }
    return normalized;
}
