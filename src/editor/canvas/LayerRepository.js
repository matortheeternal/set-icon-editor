import { SHAPES, SHAPE_STYLE, shapeDisplayFor, shapeForType } from '../Shape.js';

export class LayerRepository {
    nameCounters = Object.fromEntries(
        SHAPES.map(({ type }) => [type, 0]),
    );

    constructor(scene, nameShape) {
        this.scene = scene;
        this.nameShape = nameShape;
    }

    shapeLayers() {
        const layers = this.scene.scope.project.layers;
        return layers.filter(
            (layer) => layer.data.isShapeLayer,
        );
    }

    getById(id) {
        const found = this.shapeLayers().find(
            (layer) => layer.id === Number(id),
        );
        return found ?? null;
    }

    getMany(ids) {
        const wanted = new Set(ids.map(Number));
        return this.shapeLayers().filter(
            (layer) => wanted.has(layer.id),
        );
    }

    isCompound(layer) {
        const shape = this.pathItem(layer);
        if (!shape) return false;
        return shape instanceof this.scene.scope.CompoundPath;
    }

    describeLayer(layer) {
        const shape = this.pathItem(layer);
        if (!shape?.pathData) return null;
        return {
            name: layer.name,
            data: { ...layer.data },
            pathData: shape.pathData,
            compound: this.isCompound(layer),
        };
    }

    describeMany(ids) {
        return this.getMany(ids)
            .map((layer) => this.describeLayer(layer))
            .filter(Boolean);
    }

    uniqueCopyName(baseName) {
        const taken = new Set(
            this.shapeLayers().map((layer) => layer.name),
        );
        if (!taken.has(`${baseName} copy`)) return `${baseName} copy`;
        let counter = 2;
        while (taken.has(`${baseName} copy ${counter}`)) counter += 1;
        return `${baseName} copy ${counter}`;
    }

    instantiate(described, { offset = null } = {}) {
        const { scope } = this.scene;
        const Kind = described.compound ? scope.CompoundPath : scope.Path;
        const item = new Kind(described.pathData);
        item.style = SHAPE_STYLE;
        const layer = new scope.Layer();
        layer.addChild(item);
        layer.name = this.uniqueCopyName(described.name || 'Layer');
        layer.data = { ...described.data, isShapeLayer: true };
        if (offset) layer.position = layer.position.add(offset);
        this.syncBounds(layer);
        return layer;
    }

    duplicateMany(ids, { offset = null } = {}) {
        const sources = this.getMany(ids);
        if (!sources.length) return [];
        const described = sources
            .map((layer) => this.describeLayer(layer))
            .filter(Boolean);
        const clones = described.map((entry) => this.instantiate(entry, { offset }));
        sources.forEach((source, index) => {
            clones[index]?.insertAbove(source);
        });
        this.scene.bringOverlaysToFront();
        return clones;
    }

    pathItem(layer) {
        const { PathItem } = this.scene.scope;
        const found = layer?.children.find(
            (item) => item instanceof PathItem,
        );
        return found ?? null;
    }

    syncBounds(layer) {
        const shape = this.pathItem(layer);
        if (!shape) return;
        layer.data.rotation = 0;
        const width = Math.max(1, shape.bounds.width);
        const height = Math.max(1, shape.bounds.height);
        layer.data.width = width;
        layer.data.height = height;
    }

    syncScaledBounds(layer) {
        const shape = this.pathItem(layer);
        if (!shape) return;
        layer.data.width = Math.max(1, shape.bounds.width);
        layer.data.height = Math.max(1, shape.bounds.height);
    }

    create(type, shape) {
        const shapeDef = shapeForType(type);
        if (!shapeDef) {
            throw new TypeError(`Unknown shape type: ${type}`);
        }
        const layer = new this.scene.scope.Layer();
        layer.addChild(shape);
        const number = ++this.nameCounters[shapeDef.type];
        layer.name = this.nameShape(type, number);
        layer.data = {
            isShapeLayer: true,
            shapeType: type,
            mode: 'overlap',
            width: shape.bounds.width,
            height: shape.bounds.height,
            rotation: 0,
        };
        return layer;
    }

    remove(id) {
        const layer = this.getById(id);
        if (!layer?.isInserted()) return false;
        layer.remove();
        return true;
    }

    removeMany(ids) {
        return ids.map((id) => this.remove(id));
    }

    reorder(id, targetId, placement) {
        const layer = this.getById(id);
        const target = this.getById(targetId);
        if (!layer || !target || layer === target) {
            return false;
        }
        if (placement === 'before') layer.insertAbove(target);
        else layer.insertBelow(target);
        this.scene.bringOverlaysToFront();
        return true;
    }

    sendToBottom(id) {
        const layer = this.getById(id);
        const layers = this.shapeLayers();
        const bottom = layers.find(
            (candidate) => candidate !== layer,
        );
        if (!layer || !bottom) return false;
        layer.insertBelow(bottom);
        this.scene.bringOverlaysToFront();
        return true;
    }

    snapshots(selection = null) {
        const ids = selection?.toArray?.() ?? [];
        const selectedIds = new Set(ids);
        const layers = this.shapeLayers().slice().reverse();
        return layers.map((layer) => ({
            id: layer.id,
            name: layer.name,
            shapeType: layer.data.shapeType,
            color: shapeDisplayFor(layer.data.shapeType).fillColor,
            mode: layer.data.mode,
            selected: selectedIds.has(layer.id),
        }));
    }
}
