import { SHAPE_STYLE } from './Shape.js';

export class DocumentHistory {
    constructor(depth = 50) {
        this.depth = depth;
        this.past = [];
        this.future = [];
    }

    get canUndo() {
        return this.past.length > 0;
    }

    get canRedo() {
        return this.future.length > 0;
    }

    static keyOf(snapshot) {
        return JSON.stringify(snapshot);
    }

    push(snapshot) {
        const top = this.past.at(-1);
        const topKey = top && DocumentHistory.keyOf(top);
        if (topKey === DocumentHistory.keyOf(snapshot)) return false;
        this.past.push(snapshot);
        if (this.past.length > this.depth) this.past.shift();
        this.future = [];
        return true;
    }

    undo(current) {
        if (!this.past.length) return null;
        this.future.push(current);
        return this.past.pop();
    }

    redo(current) {
        if (!this.future.length) return null;
        this.past.push(current);
        return this.future.pop();
    }

    clear() {
        this.past = [];
        this.future = [];
    }
}

export function captureDocument(repository, selectedIds, primaryId) {
    const live = repository.shapeLayers();
    const layers = live.map((layer) => ({
        name: layer.name,
        data: { ...layer.data },
        pathData: repository.pathItem(layer)?.pathData ?? null,
        compound: repository.isCompound
            ? repository.isCompound(layer)
            : false,
    }));
    const indexById = new Map(live.map((layer, index) => [layer.id, index]));
    const wanted = [...selectedIds, primaryId].map(Number).filter(Number.isFinite);
    const found = wanted.map((id) => indexById.get(id));
    const indices = found.filter((index) => index != null);
    const unique = [...new Set(indices)];
    const primary = indexById.get(Number(primaryId));
    const rest = unique.filter((index) => index !== primary);
    const selectedIndices = Number.isInteger(primary) ? [...rest, primary] : unique;
    return { layers, selectedIndices };
}

export function restoreDocument(scene, repository, snapshot) {
    for (const layer of repository.shapeLayers()) layer.remove();
    return snapshot.layers.map((stored) => {
        const layer = new scene.scope.Layer();
        if (stored.pathData) {
            const Kind = stored.compound && scene.scope.CompoundPath
                ? scene.scope.CompoundPath
                : scene.scope.Path;
            const item = new Kind(stored.pathData);
            item.style = SHAPE_STYLE;
            layer.addChild(item);
        }
        layer.name = stored.name;
        layer.data = { ...stored.data };
        return layer;
    });
}
