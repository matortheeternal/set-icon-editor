import { HANDLE_DEFINITIONS } from './geometry.js';

export function findTransformHandle(scene, point) {
    const controls = scene.overlayLayer.children;
    const tolerance = 14 * (scene.projectUnitsPerCssPixel?.() ?? 1);
    return controls.find((item) => {
        const isHandle = item.data.transformHandle;
        const near = item.position.getDistance(point) <= tolerance;
        return isHandle && near;
    }) ?? null;
}

export function findPointControl(scene, point) {
    const controls = scene.overlayLayer.children;
    const tolerance = 12 * (scene.projectUnitsPerCssPixel?.() ?? 1);
    return controls.slice().reverse().find((item) => {
        const isControl = item.data.pointControlType;
        const near = item.position.getDistance(point) <= tolerance;
        return isControl && near;
    }) ?? null;
}

export function layerCovers(repository, layer, point, tolerance = 8) {
    const shape = repository.pathItem(layer);
    if (!shape) return false;
    if (shape.contains(point)) return true;
    const nearest = shape.getNearestPoint(point);
    const distance = nearest?.getDistance(point) ?? null;
    return distance != null && distance <= tolerance;
}

export function topmostLayerAt(repository, point, tolerance = 8) {
    const layers = repository.shapeLayers();
    return layers.slice().reverse().find((layer) => {
        return layerCovers(repository, layer, point, tolerance);
    }) ?? null;
}

export function resizeCursor(handleName, rotation = 0, width = 1, height = 1) {
    const handle = HANDLE_DEFINITIONS.find(
        ({ name }) => name === handleName,
    );
    if (!handle) return 'default';
    const x = handle.x * (Math.sign(width) || 1);
    const y = handle.y * (Math.sign(height) || 1);
    const degrees = Math.atan2(y, x) * 180 / Math.PI + rotation;
    const angle = ((degrees % 360) + 360) % 360;
    const cursors = [
        'e-resize',
        'se-resize',
        's-resize',
        'sw-resize',
        'w-resize',
        'nw-resize',
        'n-resize',
        'ne-resize',
    ];
    return cursors[Math.round(angle / 45) % 8];
}
