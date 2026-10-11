export const POINT_HIT_TOLERANCE = 12;
export const MIN_OPEN_SEGMENTS = 2;
export const MIN_CLOSED_SEGMENTS = 3;

export function normalizePointIndices(indices, count) {
    const total = Number(count);
    if (!Number.isFinite(total) || total <= 0) return [];
    const seen = new Set();
    for (const raw of [indices].flat()) {
        const index = Number(raw);
        if (!Number.isInteger(index) || index < 0 || index >= total) continue;
        seen.add(index);
    }
    return [...seen].sort((a, b) => a - b);
}

export function togglePointSelection(current, index) {
    const next = new Set(current.map(Number).filter(Number.isInteger));
    if (next.has(index)) next.delete(index);
    else next.add(index);
    return [...next].sort((a, b) => a - b);
}

export function createPointSession(control, layer = null, selectedIndices = []) {
    const selected = [selectedIndices]
        .flat()
        .map(Number)
        .filter(Number.isInteger);
    return {
        mode: 'point',
        controlType: control.data.pointControlType,
        segmentIndex: control.data.segmentIndex,
        selectedIndices: selected,
        layers: layer ? [layer] : [],
    };
}

function localDeltaFor(shape, event) {
    if (!event?.delta) {
        return null;
    }
    const prevGlobal = event.point.subtract(event.delta);
    const now = shape.globalToLocal(event.point);
    const prev = shape.globalToLocal(prevGlobal);
    return now.subtract(prev);
}

export function applyPointDrag(repository, session, layers, event) {
    const target = layers[0];
    if (!target) return;
    const shape = repository.pathItem(target);
    const segments = shape?.segments;
    if (!segments?.length) return;
    if (session.controlType !== 'point') {
        const segment = segments[session.segmentIndex];
        if (!segment) return;
        const local = shape.globalToLocal(event.point);
        segment[session.controlType] = local.subtract(segment.point);
        repository.syncBounds(target);
        return;
    }
    const wanted = session.selectedIndices?.length
        ? session.selectedIndices
        : [session.segmentIndex];
    const indices = normalizePointIndices(wanted, segments.length);
    if (!indices.length) return;
    // Move every selected anchor by the same local delta so the group keeps
    // its shape. Falls back to absolute placement for single-point sessions
    // whose event carries no delta (e.g. synthetic events in tests).
    const delta = localDeltaFor(shape, event);
    if (delta) {
        for (const index of indices) {
            const segment = segments[index];
            if (segment) segment.point = segment.point.add(delta);
        }
    } else {
        const segment = segments[session.segmentIndex];
        if (!segment) return;
        segment.point = shape.globalToLocal(event.point);
    }
    repository.syncBounds(target);
}

export function probeInsertLocation(shape, globalPoint, tolerance = POINT_HIT_TOLERANCE) {
    if (!shape?.getNearestLocation || !shape?.divideAt) return null;
    if (!Number.isFinite(shape.segments?.length)) return null;
    let location = null;
    try {
        location = shape.getNearestLocation(globalPoint);
    } catch {
        return null;
    }
    if (!location || !(location.distance <= tolerance)) return null;
    return location;
}

export function divideAtLocation(shape, location) {
    let divided = null;
    try {
        divided = shape.divideAt(location);
    } catch {
        return null;
    }
    if (divided == null || !Number.isInteger(divided.index)) return null;
    return { index: divided.index };
}

export function minSegmentsFor(shape) {
    return shape?.closed ? MIN_CLOSED_SEGMENTS : MIN_OPEN_SEGMENTS;
}

export function deletablePointIndices(shape, indices) {
    const segments = shape?.segments;
    if (!segments?.length || typeof shape?.removeSegment !== 'function') return [];
    const wanted = normalizePointIndices(indices, segments.length);
    if (!wanted.length) return [];
    const keep = Math.max(0, segments.length - wanted.length);
    if (keep < minSegmentsFor(shape)) return [];
    return wanted;
}

export function deletePointIndicesAtShape(shape, indices) {
    const deletable = deletablePointIndices(shape, indices);
    if (!deletable.length) return 0;
    for (const index of deletable.slice().sort((a, b) => b - a)) {
        shape.removeSegment(index);
    }
    return deletable.length;
}

export function smoothStatesFor(shape, indices) {
    const segments = shape?.segments;
    if (!segments?.length) return [];
    return normalizePointIndices(indices, segments.length).map((index) => {
        const segment = segments[index];
        return Boolean(segment?.isSmooth?.());
    });
}

export function setPointsSmoothAtShape(shape, indices, smooth) {
    const segments = shape?.segments;
    if (!segments?.length) return 0;
    const wanted = normalizePointIndices(indices, segments.length);
    let changed = 0;
    for (const index of wanted) {
        const segment = segments[index];
        if (!segment) continue;
        if (smooth) {
            if (segment.isSmooth?.()) continue;
            segment.smooth?.();
        } else {
            if (!segment.hasHandles?.()) continue;
            segment.clearHandles?.();
        }
        changed += 1;
    }
    return changed;
}
