export function idsFromDetail(detail) {
    if (Array.isArray(detail?.ids)) {
        const numbers = detail.ids.map(Number);
        return numbers.filter(Number.isFinite);
    }
    if (detail?.id == null) return [];
    const id = Number(detail.id);
    return Number.isFinite(id) ? [id] : [];
}

export function rangeBetween(orderedIds, fromId, toId) {
    const from = orderedIds.indexOf(Number(fromId));
    const to = orderedIds.indexOf(Number(toId));
    if (from === -1 || to === -1) return [Number(toId)];
    const start = Math.min(from, to);
    return orderedIds.slice(start, Math.max(from, to) + 1);
}

export class SelectionModel {
    _ids = new Set();
    _primaryId = null;
    _anchorId = null;

    get size() {
        return this._ids.size;
    }

    get isEmpty() {
        return this._ids.size === 0;
    }

    get primaryId() {
        return this._primaryId;
    }

    get anchorId() {
        return this._anchorId;
    }

    has(id) {
        return this._ids.has(Number(id));
    }

    toArray() {
        return [...this._ids];
    }

    replace(idOrIds) {
        const flat = [idOrIds].flat().filter((id) => id != null);
        const numbers = flat.map(Number);
        const ids = numbers.filter(Number.isFinite);
        this._ids = new Set(ids);
        this._primaryId = ids.length ? ids[ids.length - 1] : null;
        this._anchorId = this._primaryId;
    }

    replaceRange(orderedIds, targetId, extend = false) {
        const anchor = this._anchorId ?? targetId;
        const range = rangeBetween(orderedIds, anchor, targetId);
        if (extend) {
            const union = new Set([...this._ids, ...range]);
            this._ids = union;
            this._primaryId = Number(targetId);
        } else {
            this._ids = new Set(range);
            this._primaryId = Number(targetId);
        }
        this._anchorId = Number(targetId);
    }

    removeIds(ids) {
        const doomed = new Set([ids].flat().map(Number));
        const survivors = this.toArray().filter(
            (id) => !doomed.has(id),
        );
        this.replace(survivors);
    }

    toggle(id) {
        id = Number(id);
        if (!Number.isFinite(id)) return;
        if (this._ids.has(id)) {
            this._ids.delete(id);
            if (this._primaryId === id) {
                this._primaryId = [...this._ids].at(-1) ?? null;
            }
        } else {
            this._ids.add(id);
            this._primaryId = id;
        }
        this._anchorId = id;
    }

    clear() {
        this._ids.clear();
        this._primaryId = null;
        this._anchorId = null;
    }
}
