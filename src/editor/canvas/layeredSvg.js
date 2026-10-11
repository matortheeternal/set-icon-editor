import { isLayerMode } from '../layerModes.js';
import { SHAPE_STYLE, shapeForType } from '../Shape.js';

// Round-trip design note:
//
// Options considered for restoring the layered document from an export:
//   1. XML comments carrying JSON — fragile (stripped by optimizers,
//      no standard structure, painful to parse).
//   2. Sidecar / alternative project format (e.g. `.svg.json`, xcf/psd
//      style) — exact, but two files to keep in sync, easy to lose layers
//      when only the `.svg` is shared.
//   3. Native layered SVG output (one `<path>` per layer) — breaks visual
//      fidelity, because boolean modes (merge/intersection/difference) only
//      exist as flattened geometry in the compositor.
//
// Chosen system: single `.svg` file with BOTH:
//   - the flattened composite geometry as the visible artwork (what every
//     external viewer / icon consumer renders — unchanged behavior), and
//   - a standard `<metadata id="set-icon-editor">` block carrying the
//     full layer project as JSON (name, shapeType, mode, compound flag,
//     pathData, in bottom-to-top order).
//
// On open, the importer prefers the metadata project when present and
// valid, and falls back to the legacy flat path import for plain SVGs
// (including files written before this feature or by other tools).

export const LAYERED_METADATA_ID = 'set-icon-editor';
export const LAYERED_FORMAT_VERSION = 1;

export function escapeMetadataJson(json) {
    return json
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

export function unescapeMetadataJson(escaped) {
    return escaped
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&amp;', '&');
}

export function describeProjectLayers(repository) {
    return repository.shapeLayers()
        .map((layer) => repository.describeLayer(layer))
        .filter(Boolean)
        .map((entry) => ({
            name: entry.name,
            shapeType: entry.data?.shapeType ?? 'imported',
            mode: entry.data?.mode ?? 'overlap',
            compound: entry.compound ?? false,
            pathData: entry.pathData,
        }))
        .filter((entry) => entry.pathData);
}

export function encodeProjectMetadata(layers) {
    return JSON.stringify({
        app: LAYERED_METADATA_ID,
        version: LAYERED_FORMAT_VERSION,
        layers,
    });
}

export function metadataElement(layers) {
    if (!layers.length) return null;
    return `<metadata id="${LAYERED_METADATA_ID}">${escapeMetadataJson(encodeProjectMetadata(layers))}</metadata>`;
}

// Regex-based on purpose: works in browsers (DOMParser) and in Node tests
// without a DOM. Matches the first metadata block with our id.
export function extractProjectJson(svgText) {
    if (typeof svgText !== 'string') return null;
    const pattern = new RegExp(
        `<metadata[^>]*id=["']${LAYERED_METADATA_ID}["'][^>]*>([\\s\\S]*?)<\\/metadata>`,
        'i',
    );
    const match = svgText.match(pattern);
    return match ? match[1].trim() : null;
}

function isValidStoredLayer(entry) {
    return Boolean(entry)
        && typeof entry.pathData === 'string'
        && entry.pathData.length > 0;
}

export function parseProjectMetadata(svgText) {
    const raw = extractProjectJson(svgText);
    if (!raw) return null;
    let parsed;
    try {
        parsed = JSON.parse(unescapeMetadataJson(raw));
    } catch {
        return null;
    }
    if (!parsed || parsed.app !== LAYERED_METADATA_ID) return null;
    if (!Array.isArray(parsed.layers) || !parsed.layers.length) return null;
    const layers = parsed.layers.filter(isValidStoredLayer).map((entry) => ({
        name: typeof entry.name === 'string' && entry.name ? entry.name : 'Imported',
        shapeType: shapeForType(entry.shapeType) ? entry.shapeType : 'imported',
        mode: isLayerMode(entry.mode) ? entry.mode : 'overlap',
        compound: entry.compound === true,
        pathData: entry.pathData,
    }));
    if (!layers.length) return null;
    return { version: parsed.version ?? 1, layers };
}

export function buildLayersFromProject(scene, storedLayers) {
    return storedLayers.map((source, index) => {
        const Kind = source.compound && scene.scope.CompoundPath
            ? scene.scope.CompoundPath
            : scene.scope.Path;
        const item = new Kind(source.pathData);
        item.style = SHAPE_STYLE;
        const layer = new scene.scope.Layer();
        layer.addChild(item);
        layer.name = source.name || `Imported ${index + 1}`;
        const bounds = item.bounds;
        layer.data = {
            isShapeLayer: true,
            shapeType: source.shapeType || 'imported',
            mode: isLayerMode(source.mode) ? source.mode : 'overlap',
            width: Math.max(1, bounds.width),
            height: Math.max(1, bounds.height),
            rotation: 0,
        };
        return layer;
    });
}
