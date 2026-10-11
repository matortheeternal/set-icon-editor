import { SHAPE_STYLE } from '../Shape.js';

const compositeStrategies = {
    overlap: null,
    merge: 'unite',
    intersection: 'intersect',
    difference: 'subtract',
};

export class Compositor {
    constructor(scene, repository) {
        this.scene = scene;
        this.repository = repository;
    }

    get pendingGeometry() {
        return this.pending?.geometry ?? null;
    }

    hideSources() {
        const layers = this.repository.shapeLayers();
        for (const layer of layers) layer.visible = false;
    }

    rebuild() {
        this.scene.compositeLayer.removeChildren();
        this.hideSources();
        this.pending = { geometry: null };
        const layers = this.repository.shapeLayers();
        for (const layer of layers) this.appendLayer(layer);
        this.flushGroup();
        this.scene.bringOverlaysToFront();
    }

    combineGeometries(mode, geometry, operand) {
        const method = compositeStrategies[mode];
        if (!method) return null;
        return geometry[method](operand, { insert: false });
    }

    appendLayer(layer) {
        const source = this.repository.pathItem(layer);
        if (!source) return;
        const operand = source.clone(false);
        const mode = layer.data.mode || 'overlap';
        const starting = !this.pending.geometry || mode === 'overlap';
        if (starting) return this.restartGroup(operand);
        const geometry = this.pending.geometry;
        const result = this.combineGeometries(mode, geometry, operand);
        if (!result) return this.restartGroup(operand);
        geometry.remove();
        operand.remove();
        this.pending.geometry = result;
    }

    restartGroup(operand) {
        this.flushGroup();
        this.pending.geometry = operand;
    }

    flushGroup() {
        if (!this.pending.geometry) return;
        this.pending.geometry.style = SHAPE_STYLE;
        const geometry = this.pending.geometry;
        this.scene.compositeLayer.addChild(geometry);
        this.pending.geometry = null;
    }
}
