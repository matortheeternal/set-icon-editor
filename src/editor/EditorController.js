import { localize } from '../shared/localize.js';
import { shapeForType } from './Shape.js';
import { SelectionModel } from './SelectionModel.js';
import {
    commandHandlers,
    createSnapshot,
} from './editorCommands.js';
import { PaperEditor } from './canvas/PaperEditor.js';
import { serializeScene } from './canvas/svgExporter.js';

const L = localize('editor');

export class EditorController {
    state = {
        activeTool: null,
        pointCount: 5,
        pointEditingId: null,
        selectedPointIndices: [],
        isDrawing: false,
    };

    selection = new SelectionModel();

    constructor({ paperLibrary, canvas, onStateChange }) {
        this.onStateChange = onStateChange;
        this.backend = new PaperEditor({
            paperLibrary,
            canvas,
            nameShape: (type, count) => shapeForType(type).name(L, count),
            getState: () => this.viewState,
            callbacks: {
                onSelect: (ids, options) => this.selectLayers(ids, options),
                onCreate: (id) => this.onShapeCreated(id),
                onPointSelect: (indices, options) => this.selectPoints(indices, options),
                onInsertPoint: (point) => this.insertPointAt(point),
                onDrawingChange: (active) => {
                    this.state.isDrawing = active;
                    this.publish();
                },
            },
        });
        this.publish();
    }

    get viewState() {
        return {
            ...this.state,
            selectedPointIndices: [...this.state.selectedPointIndices],
            selectedId: this.selection.primaryId,
            selectedIds: this.selection.toArray(),
        };
    }

    get snapshot() {
        const layers = this.backend.snapshots(this.selection);
        return createSnapshot(this.state, this.selection, layers, this.backend.history);
    }

    command(detail) {
        const handler = commandHandlers[detail?.command];
        if (!handler) {
            console.warn(`Unknown editor command: ${detail?.command}`);
            return;
        }
        handler(this, detail);
    }

    publish() { this.onStateChange(this.snapshot); }

    refresh() {
        this.clampPointSelection();
        this.backend.renderSelection(this.viewState);
        this.publish();
    }

    refreshControls() {
        this.backend.renderSelection(this.viewState, { skipRebuild: true });
    }

    resizeViewport(width, height, scale = 1) {
        this.backend.resize(width, height, scale, this.viewState);
    }

    // Undo/redo rebuild paths, so previously valid point indices may no
    // longer exist. Clamp them instead of carrying stale indices.
    clampPointSelection() {
        const editingId = this.state.pointEditingId;
        if (editingId == null) {
            if (this.state.selectedPointIndices.length) {
                this.state.selectedPointIndices = [];
            }
            return;
        }
        const count = this.backend.pointCount(editingId);
        if (!count) {
            this.state.pointEditingId = null;
            this.state.selectedPointIndices = [];
            return;
        }
        this.state.selectedPointIndices = this.state.selectedPointIndices
            .filter((index) => Number.isInteger(index) && index >= 0 && index < count);
    }

    selectLayers(idOrIds, { extend = false, range = false } = {}) {
        const flat = [idOrIds].flat().filter((id) => id != null);
        const ids = flat.map(Number).filter(Number.isFinite);
        if (range && ids.length === 1) {
            this.selectRange(ids[0], extend);
        } else if (extend && ids.length === 1) {
            this.selection.toggle(ids[0]);
        } else {
            this.selection.replace(ids);
        }
        const toolActive = this.state.activeTool != null;
        const hasSelection = this.selection.primaryId != null;
        if (toolActive && hasSelection) this.deactivateToolOnly();
        if (this.state.pointEditingId !== this.selection.primaryId)
            this.state.pointEditingId = null;
        if (this.state.pointEditingId == null) {
            this.state.selectedPointIndices = [];
        }
        this.refresh();
    }

    selectRange(targetId, extend) {
        const snapshots = this.backend.snapshots(null);
        const ordered = snapshots.map((layer) => layer.id);
        this.selection.replaceRange(ordered, targetId, extend);
    }
    toggleTool(type) {
        if (!shapeForType(type)) return;
        const next = this.state.activeTool === type ? null : type;
        this.backend.deactivateTool();
        this.state.activeTool = next;
        this.state.isDrawing = false;
        if (next) {
            this.selection.clear();
            this.state.pointEditingId = null;
            this.state.selectedPointIndices = [];
        }
        this.backend.setToolCursor(Boolean(next));
        this.refresh();
    }

    deactivateTool() {
        if (!this.state.activeTool) return false;
        this.deactivateToolOnly();
        this.refresh();
        return true;
    }

    deactivateToolOnly() {
        this.backend.deactivateTool();
        this.state.activeTool = null;
        this.state.isDrawing = false;
    }

    setPointCount(value) {
        const parsed = Number.parseInt(value, 10) || 6;
        this.state.pointCount = Math.min(32, Math.max(3, parsed));
        this.publish();
    }

    togglePointEditing() {
        if (this.selection.size !== 1) return;
        const id = this.selection.primaryId;
        const entering = this.state.pointEditingId !== id;
        if (entering) this.backend.preparePointEditing(id);
        this.state.pointEditingId = entering ? id : null;
        this.state.selectedPointIndices = [];
        this.refresh();
    }

    exitPointEditing() {
        if (this.state.pointEditingId == null) return false;
        this.state.pointEditingId = null;
        this.state.selectedPointIndices = [];
        this.refresh();
        return true;
    }

    selectPoints(indices, { extend = false } = {}) {
        const editingId = this.state.pointEditingId;
        if (editingId == null) return;
        const count = this.backend.pointCount(editingId);
        const wanted = [indices]
            .flat()
            .map(Number)
            .filter((index) => Number.isInteger(index) && index >= 0 && index < count);
        if (extend && wanted.length === 1) {
            const [index] = wanted;
            const current = new Set(this.state.selectedPointIndices);
            if (current.has(index)) current.delete(index);
            else current.add(index);
            this.state.selectedPointIndices = [...current].sort((a, b) => a - b);
        } else {
            this.state.selectedPointIndices = [...new Set(wanted)].sort((a, b) => a - b);
        }
        this.refresh();
    }

    selectAllPoints() {
        const editingId = this.state.pointEditingId;
        if (editingId == null) return false;
        const count = this.backend.pointCount(editingId);
        this.state.selectedPointIndices = Array.from({ length: count }, (_, index) => index);
        this.refresh();
        return true;
    }

    insertPointAt(point) {
        const editingId = this.state.pointEditingId;
        if (editingId == null || !point) return null;
        const index = this.backend.insertPointAt(editingId, point);
        if (index == null) return null;
        this.state.selectedPointIndices = [index];
        this.refresh();
        return index;
    }

    deleteSelectedPoints() {
        const editingId = this.state.pointEditingId;
        if (editingId == null) return 0;
        const indices = this.state.selectedPointIndices;
        if (!indices.length) return 0;
        const deleted = this.backend.deletePointIndices(editingId, indices);
        if (!deleted) return 0;
        this.state.selectedPointIndices = [];
        this.refresh();
        return deleted;
    }

    toggleSelectedPointsSmooth() {
        const editingId = this.state.pointEditingId;
        if (editingId == null) return 0;
        const indices = this.state.selectedPointIndices;
        if (!indices.length) return 0;
        const found = this.backend.editingShape(editingId);
        if (!found) return 0;
        const allSmooth = indices.every(
            (index) => found.shape.segments[index]?.isSmooth?.() === true,
        );
        // Mixed selections round out; uniformly smooth selections sharpen.
        const changed = this.backend.setPointsSmooth(editingId, indices, !allSmooth);
        if (changed) this.refresh();
        return changed;
    }

    deleteLayers(ids) {
        const normalized = [ids].flat().map(Number);
        const finite = normalized.filter(Number.isFinite);
        if (!finite.length) return;
        const nextId = this.backend.deleteMany(finite);
        const editing = this.state.pointEditingId;
        if (finite.includes(editing)) this.state.pointEditingId = null;
        if (this.state.pointEditingId == null) this.state.selectedPointIndices = [];
        this.selection.removeIds(finite);
        const adoptable = nextId != null && !finite.includes(nextId);
        if (this.selection.isEmpty && adoptable) {
            this.selection.replace([nextId]);
        }
        this.refresh();
    }

    copyLayers(ids) {
        const normalized = [ids].flat().map(Number).filter(Number.isFinite);
        if (!normalized.length) return 0;
        return this.backend.copyMany(normalized);
    }

    copySelected() {
        return this.copyLayers(this.selection.toArray());
    }

    pasteClipboard() {
        const ids = this.backend.pasteClipboard();
        if (!ids.length) return [];
        this.state.pointEditingId = null;
        this.selectLayers(ids);
        return ids;
    }

    duplicateSelected() {
        const ids = this.selection.toArray();
        if (!ids.length) return [];
        const clones = this.backend.duplicateMany(ids);
        if (!clones.length) return [];
        this.state.pointEditingId = null;
        this.selectLayers(clones);
        return clones;
    }

    cutSelected() {
        const ids = this.selection.toArray();
        if (!ids.length) return;
        this.copyLayers(ids);
        this.deleteLayers(ids);
    }

    reflectSelected(axis) {
        const ids = this.selection.toArray();
        if (!ids.length) return 0;
        const reflected = this.backend.reflectLayers(ids, axis);
        if (!reflected) return 0;
        // Mirroring can reverse winding and segment order, so any active
        // point selection no longer addresses the same anchors.
        if (this.state.pointEditingId != null) {
            this.state.selectedPointIndices = [];
        }
        this.refresh();
        return reflected;
    }

    setLayerModes(ids, mode) {
        this.backend.setLayerModes(ids, mode);
        const flat = [ids].flat().map(Number);
        const primary = flat.filter(Number.isFinite).at(-1);
        if (primary != null) this.selectLayers([primary]);
        else this.refresh();
    }

    reorderLayer(id, targetId, placement) {
        const moved = this.backend.reorder(id, targetId, placement);
        if (!moved) return;
        this.selectLayers([id]);
    }

    sendLayerToBottom(id) {
        const moved = this.backend.sendToBottom(id);
        if (!moved) return;
        this.selectLayers([id]);
    }

    nudgeSelected(x, y) {
        const pointEditing = this.state.pointEditingId != null;
        if (this.selection.isEmpty || pointEditing) return;
        const ids = this.selection.toArray();
        this.backend.nudgeMany(ids, x, y);
        this.backend.renderSelection(this.viewState);
    }

    onShapeCreated(id) {
        this.state.activeTool = null;
        this.state.isDrawing = false;
        this.state.pointEditingId = null;
        this.state.selectedPointIndices = [];
        this.selection.replace([Number(id)]);
        this.backend.setToolCursor(false);
        this.refresh();
    }

    destroy() {
        this.backend.destroy();
    }

    previewSvg() {
        return serializeScene(this.backend.scene, this.backend.repository);
    }
}
