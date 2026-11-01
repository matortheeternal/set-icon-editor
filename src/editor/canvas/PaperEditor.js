import { isLayerMode } from '../layerModes.js';
import {
    DocumentHistory,
    captureDocument,
    restoreDocument,
} from '../history.js';
import { CanvasInputController } from './CanvasInputController.js';
import { Compositor } from './Compositor.js';
import { DrawingController } from './DrawingController.js';
import { LayerRepository } from './LayerRepository.js';
import { PaperScene } from './PaperScene.js';
import { SelectionControls } from './SelectionControls.js';
import { TransformController } from './TransformController.js';
import {
    deletablePointIndices,
    deletePointIndicesAtShape,
    divideAtLocation,
    normalizePointIndices,
    probeInsertLocation,
    setPointsSmoothAtShape,
    smoothStatesFor,
} from './pointEditing.js';
import { getBootOptions } from '../../shared/environment.js';
import { saveTextFile } from '../../shared/saveFile.js';
import { serializeScene } from './svgExporter.js';

export class PaperEditor {
    history = new DocumentHistory();
    clipboard = [];
    lastSelectedIds = [];
    lastPrimaryId = null;

    constructor(options) {
        const { paperLibrary, canvas } = options;
        const { nameShape, getState, callbacks } = options;
        this.scene = new PaperScene(paperLibrary, canvas);
        this.repository = new LayerRepository(this.scene, nameShape);
        this.compositor = new Compositor(this.scene, this.repository);
        this.controls = new SelectionControls(
            this.scene,
            this.repository,
            this.compositor,
        );
        this.drawing = new DrawingController(this.scene);
        const render = () => this.renderSelection(getState());
        this.transforms = new TransformController(
            this.scene,
            this.repository,
            render,
        );
        this.input = new CanvasInputController({
            scene: this.scene,
            repository: this.repository,
            drawing: this.drawing,
            transforms: this.transforms,
            canvas,
            getState,
            ...callbacks,
            onPointSelect: callbacks.onPointSelect ?? (() => {}),
            onInsertPoint: callbacks.onInsertPoint ?? (() => {}),
            onCheckpoint: () => this.checkpoint(),
        });
    }

    renderSelection(state, options = {}) {
        const selectedIds = state.selectedIds ?? [];
        const primaryId = state.selectedId ?? null;
        const pointEditingId = state.pointEditingId ?? null;
        const selectedPointIndices = state.selectedPointIndices ?? [];
        this.lastSelectedIds = selectedIds;
        this.lastPrimaryId = primaryId;
        this.controls.render({
            selectedIds,
            primaryId,
            pointEditingId,
            selectedPointIndices,
        }, options);
    }

    checkpoint() {
        const snapshot = captureDocument(
            this.repository,
            this.lastSelectedIds,
            this.lastPrimaryId,
        );
        this.history.push(snapshot);
    }

    undo(state) {
        const ids = state?.selectedIds ?? [];
        const current = captureDocument(
            this.repository,
            ids,
            state?.selectedId ?? null,
        );
        const snapshot = this.history.undo(current);
        if (!snapshot) return null;
        return this.restoreSnapshot(snapshot);
    }

    redo(state) {
        const ids = state?.selectedIds ?? [];
        const current = captureDocument(
            this.repository,
            ids,
            state?.selectedId ?? null,
        );
        const snapshot = this.history.redo(current);
        if (!snapshot) return null;
        return this.restoreSnapshot(snapshot);
    }

    restoreSnapshot(snapshot) {
        const layers = restoreDocument(
            this.scene,
            this.repository,
            snapshot,
        );
        this.transforms.end();
        this.drawing.cancel();
        this.scene.bringOverlaysToFront();
        this.compositor.rebuild();
        return snapshot.selectedIndices.map((index) => layers[index].id);
    }

    snapshots(selection = null) {
        return this.repository.snapshots(selection);
    }

    deactivateTool() {
        this.drawing.cancel();
        this.setToolCursor(false);
    }

    setToolCursor(active) {
        this.input.canvas.style.cursor = active ? 'crosshair' : 'default';
    }

    preparePointEditing(id) {
        const layer = this.repository.getById(id);
        if (!layer) return;
        this.checkpoint();
        this.repository.syncBounds(layer);
    }

    editingShape(id) {
        const layer = this.repository.getById(id);
        if (!layer) return null;
        const shape = this.repository.pathItem(layer);
        if (!shape?.segments) return null;
        return { layer, shape };
    }

    pointCount(id) {
        return this.editingShape(id)?.shape.segments.length ?? 0;
    }

    insertPointAt(id, globalPoint) {
        const found = this.editingShape(id);
        if (!found) return null;
        const { layer, shape } = found;
        const location = probeInsertLocation(shape, globalPoint);
        if (!location) return null;
        this.checkpoint();
        const inserted = divideAtLocation(shape, location);
        if (!inserted) {
            this.history.past.pop();
            return null;
        }
        this.repository.syncBounds(layer);
        this.compositor.rebuild();
        return inserted.index;
    }

    deletePointIndices(id, indices) {
        const found = this.editingShape(id);
        if (!found) return 0;
        const { layer, shape } = found;
        const deletable = deletablePointIndices(shape, indices);
        if (!deletable.length) return 0;
        this.checkpoint();
        const deleted = deletePointIndicesAtShape(shape, deletable);
        this.repository.syncBounds(layer);
        this.compositor.rebuild();
        return deleted;
    }

    setPointsSmooth(id, indices, smooth) {
        const found = this.editingShape(id);
        if (!found) return 0;
        const { layer, shape } = found;
        const wanted = normalizePointIndices(indices, shape.segments.length);
        if (!wanted.length) return 0;
        const states = smoothStatesFor(shape, wanted);
        const needsWork = smooth
            ? states.some((isSmooth) => !isSmooth)
            : states.some((isSmooth) => isSmooth)
                || wanted.some(
                    (index) => shape.segments[index]?.hasHandles?.(),
                );
        if (!needsWork) return 0;
        this.checkpoint();
        const changed = setPointsSmoothAtShape(shape, wanted, smooth);
        if (!changed) {
            this.history.past.pop();
            return 0;
        }
        this.repository.syncBounds(layer);
        this.compositor.rebuild();
        return changed;
    }

    deleteMany(ids) {
        this.checkpoint();
        const normalized = ids.map(Number).filter(Number.isFinite);
        for (const id of normalized)
            this.repository.remove(id);
        return this.repository.shapeLayers().at(-1)?.id ?? null;
    }

    copyMany(ids) {
        const normalized = [ids].flat().map(Number).filter(Number.isFinite);
        const described = this.repository.describeMany(normalized);
        if (!described.length) return 0;
        this.clipboard = described.map((entry) => ({
            ...entry,
            data: { ...entry.data },
        }));
        return this.clipboard.length;
    }

    pasteClipboard({ offset = null } = {}) {
        if (!this.clipboard.length) return [];
        this.checkpoint();
        const step = offset ?? new this.scene.scope.Point(16, 16);
        const clones = this.clipboard.map((entry) => (
            this.repository.instantiate(entry, { offset: step })
        ));
        this.compositor.rebuild();
        return clones.map((layer) => layer.id);
    }

    duplicateMany(ids, { offset = null } = {}) {
        const normalized = [ids].flat().map(Number).filter(Number.isFinite);
        if (!normalized.length) return [];
        this.checkpoint();
        const step = offset ?? new this.scene.scope.Point(16, 16);
        const clones = this.repository.duplicateMany(normalized, { offset: step });
        this.compositor.rebuild();
        return clones.map((layer) => layer.id);
    }

    setLayerMode(id, mode) {
        if (!isLayerMode(mode)) return;
        const layer = this.repository.getById(id);
        if (layer) layer.data.mode = mode;
    }

    setLayerModes(ids, mode) {
        if (!isLayerMode(mode)) return;
        this.checkpoint();
        for (const id of ids) this.setLayerMode(id, mode);
    }

    reorder(id, targetId, placement) {
        this.checkpoint();
        return this.repository.reorder(id, targetId, placement);
    }

    sendToBottom(id) {
        this.checkpoint();
        return this.repository.sendToBottom(id);
    }

    nudgeMany(ids, x, y) {
        this.checkpoint();
        const layers = this.repository.getMany(ids);
        for (const layer of layers)
            layer.position = layer.position.add([x, y]);
    }

    reflectLayers(ids, axis) {
        const sx = axis === 'horizontal' ? -1 : 1;
        const sy = axis === 'vertical' ? -1 : 1;
        if (sx === 1 && sy === 1) return 0;
        const layers = this.repository.getMany(ids);
        if (!layers.length) return 0;
        this.checkpoint();
        const union = layers.reduce(
            (bounds, layer) => bounds ? bounds.unite(layer.bounds)
                : layer.bounds.clone(),
            null,
        );
        const center = union.center;
        for (const layer of layers) {
            const rotation = layer.data.rotation || 0;
            layer.scale(sx, sy, center);
            layer.data.rotation = axis === 'horizontal'
                ? (180 - rotation + 360) % 360
                : (-rotation + 360) % 360;
            layer.data.height *= -1;
        }
        this.compositor.rebuild();
        return layers.length;
    }

    resize(width, height, scale, state) {
        this.scene.resize(width, height, scale);
        this.renderSelection(state, { skipRebuild: true });
    }

    async exportSvg(filename = 'untitled-icon.svg') {
        const layers = this.repository.shapeLayers();
        if (!layers.length) return null;
        this.compositor.rebuild();
        const svg = serializeScene(this.scene, this.repository);
        const { filename: savePath } = getBootOptions();
        try {
            return await saveTextFile({
                path: savePath,
                filename,
                contents: svg,
                mimeType: 'image/svg+xml',
            });
        } catch (error) {
            console.error('Export failed:', error);
            return null;
        }
    }

    destroy() {
        this.input.destroy();
        this.scene.destroy();
    }
}
