import { getBootOptions, setBootOptions } from '../shared/environment.js';
import { setWindowTitle } from '../shared/windowTitle.js';
import { idsFromDetail } from './SelectionModel.js';
import { importLayers } from './canvas/svgImporter.js';

export function normalizeIds(detail) {
    const ids = idsFromDetail(detail);
    if (ids.length) return ids;
    return [];
}

export function createSnapshot(state, selection, layers, history = null) {
    const selectedIds = selection.toArray();
    const single = selectedIds.length === 1;
    const editing = state.pointEditingId === selection.primaryId;
    return {
        activeTool: state.activeTool,
        pointCount: state.pointCount,
        isDrawing: state.isDrawing,
        selectedId: selection.primaryId,
        selectedIds,
        pointEditingId: state.pointEditingId,
        selectedPointIndices: [...(state.selectedPointIndices ?? [])],
        selectedPointCount: (state.selectedPointIndices ?? []).length,
        canDeletePoints: (state.selectedPointIndices ?? []).length > 0,
        layers,
        canEditPoints: single,
        isEditingPoints: single && editing,
        canReflect: selectedIds.length > 0,
        canUndo: history?.canUndo ?? false,
        canRedo: history?.canRedo ?? false,
    };
}

function applyHistorySnapshot(editor, selectedIds) {
    if (!selectedIds) return;
    editor.selectLayers(selectedIds);
}

function editingIndexOf(editor) {
    const editingId = editor.state.pointEditingId;
    if (editingId == null) return -1;
    return editor.backend.snapshots(null).findIndex(
        (layer) => layer.id === editingId,
    );
}

function remapPointEditing(editor, editingIndex) {
    if (editingIndex < 0) return;
    const layers = editor.backend.snapshots(null);
    const remapped = layers[editingIndex] ?? null;
    editor.state.pointEditingId = remapped ? remapped.id : null;
    editor.refresh();
}

function clearDocument(editor) {
    const layers = editor.backend.repository.shapeLayers();
    for (const layer of layers) layer.remove();
    editor.backend.history.clear();
}

function openDocument(editor, svgText, filename) {
    const backend = editor.backend;
    clearDocument(editor);
    const layers = importLayers(backend.scene, svgText);
    backend.compositor.rebuild();
    const output = filename ?? getBootOptions().filename ?? null;
    setBootOptions({ ...getBootOptions(), filename: output });
    return layers.map((layer) => layer.id);
}

export const commandHandlers = {
    'select-tool': (editor, detail) => {
        editor.toggleTool(detail.tool);
    },
    'set-point-count': (editor, detail) => {
        editor.setPointCount(detail.pointCount);
    },
    'toggle-point-editing': (editor) => editor.togglePointEditing(),
    'select-points': (editor, detail) => {
        editor.selectPoints(detail.indices ?? [], {
            extend: detail.extend === true,
        });
    },
    'delete-points': (editor) => {
        editor.deleteSelectedPoints();
    },
    'toggle-point-smooth': (editor) => {
        editor.toggleSelectedPointsSmooth();
    },
    resize: (editor, detail) => {
        const { width, height } = detail;
        editor.backend.resize(width, height, editor.viewState);
    },
    'delete-selected': (editor) => {
        if (editor.state.pointEditingId != null) {
            if (editor.state.selectedPointIndices.length) {
                editor.deleteSelectedPoints();
            }
            return;
        }
        editor.deleteLayers(editor.selection.toArray());
    },
    'copy-selected': (editor) => {
        editor.copySelected();
    },
    paste: (editor) => {
        editor.pasteClipboard();
    },
    'duplicate-selected': (editor) => {
        editor.duplicateSelected();
    },
    'cut-selected': (editor) => {
        editor.cutSelected();
    },
    'reflect-horizontal': (editor) => {
        editor.reflectSelected('horizontal');
    },
    'reflect-vertical': (editor) => {
        editor.reflectSelected('vertical');
    },
    'select-all': (editor) => {
        if (editor.selectAllPoints()) return;
        const layers = editor.backend.snapshots(null);
        editor.selectLayers(layers.map((layer) => layer.id));
    },
    'new-document': (editor) => {
        clearDocument(editor);
        editor.selectLayers([]);
    },
    'open-document': (editor, detail) => {
        const filename = detail.filename ?? 'untitled-icon.svg';
        const ids = openDocument(editor, detail.svgText, detail.filename ?? null);
        setWindowTitle(filename);
        editor.selectLayers(ids);
    },
    'save-document': (editor) => {
        editor.backend.exportSvg();
    },
    undo: (editor) => {
        const editingIndex = editingIndexOf(editor);
        const restored = editor.backend.undo(editor.viewState);
        if (!restored) return;
        applyHistorySnapshot(editor, restored);
        remapPointEditing(editor, editingIndex);
    },
    redo: (editor) => {
        const editingIndex = editingIndexOf(editor);
        const restored = editor.backend.redo(editor.viewState);
        if (!restored) return;
        applyHistorySnapshot(editor, restored);
        remapPointEditing(editor, editingIndex);
    },
    'select-layer': (editor, detail) => {
        const ids = normalizeIds(detail);
        const extend = detail.extend === true;
        const range = detail.range === true;
        editor.selectLayers(ids, { extend, range });
    },
    'set-layer-mode': (editor, detail) => {
        editor.setLayerModes(normalizeIds(detail), detail.mode);
    },
    'delete-layer': (editor, detail) => {
        editor.deleteLayers(normalizeIds(detail));
    },
    drop: (editor, detail) => {
        const [id] = normalizeIds(detail);
        editor.reorderLayer(id, detail.targetId, detail.placement);
    },
    'drop-bottom': (editor, detail) => {
        const [id] = normalizeIds(detail);
        editor.sendLayerToBottom(id);
    },
};
