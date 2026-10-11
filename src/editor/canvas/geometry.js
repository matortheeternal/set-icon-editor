export const HANDLE_DEFINITIONS = [
    { name: 'nw', x: -1, y: -1 },
    { name: 'n', x: 0, y: -1 },
    { name: 'ne', x: 1, y: -1 },
    { name: 'e', x: 1, y: 0 },
    { name: 'se', x: 1, y: 1 },
    { name: 's', x: 0, y: 1 },
    { name: 'sw', x: -1, y: 1 },
    { name: 'w', x: -1, y: 0 },
];

export function orientedPoint(paperScope, center, x, y, rotation) {
    return new paperScope.Point(x, y).rotate(rotation).add(center);
}

export function normalizedRotation(rotation) {
    return ((rotation % 360) + 360) % 360;
}

export function normalizedAngleDelta(delta) {
    if (delta > 180) return delta - 360;
    if (delta < -180) return delta + 360;
    return delta;
}

// Holding Ctrl while rotating snaps the gesture to these increments.
export const ROTATION_SNAP_STEP = 15;

export function snapToStep(value, step) {
    if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) {
        return value;
    }
    return Math.round(value / step) * step;
}

export function scaledToRatio(session, width, height) {
    const widthScale = width / session.width;
    const heightScale = height / session.height;
    const byWidth = Math.abs(widthScale - 1);
    const byHeight = Math.abs(heightScale - 1);
    const scale = byWidth > byHeight ? widthScale : heightScale;
    return {
        width: session.width * scale,
        height: session.height * scale,
    };
}

export function nextSize(session, point, preserveRatio) {
    const { anchor, rotation, handle } = session;
    const local = point.subtract(anchor);
    const turned = local.rotate(-rotation);
    let width = session.width;
    let height = session.height;
    if (handle.x) {
        width = turned.x * handle.x;
    }
    if (handle.y) {
        height = turned.y * handle.y;
    }
    const diagonal = handle.x && handle.y;
    if (preserveRatio && diagonal) {
        const sized = scaledToRatio(session, width, height);
        width = sized.width;
        height = sized.height;
    }
    return { width, height };
}

export function groupBoundsOf(layers) {
    if (!layers.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const layer of layers) {
        const bounds = layer.bounds ?? null;
        const center = layer.position;
        if (bounds && Number.isFinite(bounds.left)) {
            minX = Math.min(minX, bounds.left);
            minY = Math.min(minY, bounds.top);
            maxX = Math.max(maxX, bounds.right);
            maxY = Math.max(maxY, bounds.bottom);
            continue;
        }
        const width = Math.abs(layer.data?.width ?? bounds?.width ?? 0);
        const height = Math.abs(layer.data?.height ?? bounds?.height ?? 0);
        const rotation = (layer.data?.rotation ?? 0) * Math.PI / 180;
        const halfWidth = Math.abs(Math.cos(rotation)) * width / 2
            + Math.abs(Math.sin(rotation)) * height / 2;
        const halfHeight = Math.abs(Math.sin(rotation)) * width / 2
            + Math.abs(Math.cos(rotation)) * height / 2;
        minX = Math.min(minX, center.x - halfWidth);
        minY = Math.min(minY, center.y - halfHeight);
        maxX = Math.max(maxX, center.x + halfWidth);
        maxY = Math.max(maxY, center.y + halfHeight);
    }
    return {
        center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
        width: Math.max(0, maxX - minX),
        height: Math.max(0, maxY - minY),
    };
}
