import { shapeForType } from '../Shape.js';
import {
    findPointControl,
    findTransformHandle,
    resizeCursor,
    topmostLayerAt,
} from './canvasHitTesting.js';
import { POINT_HIT_TOLERANCE, probeInsertLocation } from './pointEditing.js';

const DOUBLE_TAP_MS = 400;

export class CanvasInputController {
    constructor(options) {
        const {
            scene,
            repository,
            drawing,
            transforms,
            canvas,
            getState,
        } = options;
        const { onSelect, onCreate, onDrawingChange, onCheckpoint } = options;
        const { onPointSelect, onInsertPoint } = options;
        this.scene = scene;
        this.repository = repository;
        this.drawing = drawing;
        this.transforms = transforms;
        this.canvas = canvas;
        this.getState = getState;
        this.onSelect = onSelect;
        this.onCreate = onCreate;
        this.onDrawingChange = onDrawingChange;
        this.onCheckpoint = onCheckpoint;
        this.onPointSelect = onPointSelect ?? (() => {});
        this.onInsertPoint = onInsertPoint ?? (() => {});
        this.lastPress = null;
        this.paperTool = new this.scene.scope.Tool();
        const tool = this.paperTool;
        tool.onMouseDown = (event) => this.onMouseDown(event);
        tool.onMouseDrag = (event) => this.onMouseDrag(event);
        tool.onMouseMove = (event) => this.onMouseMove(event);
        tool.onMouseUp = (event) => this.onMouseUp(event);
    }

    onMouseDown(event) {
        const state = this.getState();
        if (state.activeTool) {
            return this.beginDrawing(event, state);
        }
        const layer = this.repository.getById(state.selectedId);
        const editing = layer && state.pointEditingId === layer.id;
        if (editing && findPointControl(this.scene, event.point)) {
            return this.beginPointEdit(event, layer);
        }
        if (event.modifiers.shift) {
            return this.toggleShapeSelect(event);
        }
        if (editing) return this.beginPointEdit(event, layer);
        const handle = layer && findTransformHandle(this.scene, event.point);
        if (handle) return this.beginTransform(event, layer, handle);
        this.beginShapeMove(event);
    }

    beginDrawing(event, state) {
        const shape = shapeForType(state.activeTool);
        if (!shape) return;
        this.onCheckpoint();
        const count = shape.usesPointCount ? state.pointCount : null;
        this.drawing.begin(shape, event.point, count);
        this.onDrawingChange(true);
        this.setCursor('crosshair');
    }

    beginPointEdit(event, selected) {
        const control = findPointControl(this.scene, event.point);
        if (control) {
            this.lastPress = null;
            const controlType = control.data.pointControlType;
            const segmentIndex = control.data.segmentIndex;
            if (event.modifiers.shift && controlType === 'point') {
                this.onPointSelect([segmentIndex], { extend: true });
                return;
            }
            const current = this.getState().selectedPointIndices ?? [];
            const already = current.map(Number).includes(Number(segmentIndex));
            const dragSelection = controlType === 'point' && already && current.length
                ? current
                : [segmentIndex];
            if (!(controlType === 'point' && already && current.length)) {
                this.onPointSelect(dragSelection, {});
            }
            this.onCheckpoint();
            this.transforms.beginPoint(control, selected, dragSelection);
            return this.setCursor('grabbing');
        }
        const shape = this.repository.pathItem(selected);
        const tolerance = POINT_HIT_TOLERANCE
            * (this.scene.projectUnitsPerCssPixel?.() ?? 1);
        if (shape && probeInsertLocation(shape, event.point, tolerance)) {
            if (this.isSecondTap(event)) {
                this.lastPress = null;
                this.onInsertPoint(event.point);
                return;
            }
            this.lastPress = {
                time: Date.now(),
                x: Number(event.point?.x) || 0,
                y: Number(event.point?.y) || 0,
            };
            return;
        }
        this.lastPress = null;
        const layer = this.topmostLayerAt(event.point);
        if (layer !== selected) {
            this.onSelect(layer ? [layer.id] : [], {});
        }
    }

    isSecondTap(event) {
        const prev = this.lastPress;
        if (!prev) return false;
        if (Date.now() - prev.time > DOUBLE_TAP_MS) return false;
        const x = Number(event.point?.x) || 0;
        const y = Number(event.point?.y) || 0;
        const tolerance = POINT_HIT_TOLERANCE
            * (this.scene.projectUnitsPerCssPixel?.() ?? 1);
        return Math.hypot(x - prev.x, y - prev.y) <= tolerance;
    }

    toggleShapeSelect(event) {
        const layer = this.topmostLayerAt(event.point);
        if (!layer) return this.setCursor('default');
        this.onSelect([layer.id], { extend: true });
        this.setCursor('grab');
    }

    beginTransform(event, layer, handle) {
        const kind = handle.data.transformHandle;
        const selectedIds = this.getState().selectedIds ?? [];
        const group = handle.data.groupHandle === true;
        const layers = group && selectedIds.length > 1
            ? this.repository.getMany(selectedIds)
            : [layer];
        this.onCheckpoint();
        if (kind === 'rotate') {
            this.transforms.beginRotate(layers, event.point);
        } else {
            this.transforms.beginScale(layers, kind);
        }
        this.setCursor('grabbing');
    }

    beginShapeMove(event) {
        const layer = this.topmostLayerAt(event.point);
        if (!layer) {
            this.transforms.end();
            this.onSelect([], {});
            return this.setCursor('default');
        }
        const selectedIds = this.getState().selectedIds ?? [];
        const grouped = selectedIds.length > 1;
        const member = selectedIds.includes(layer.id);
        this.onCheckpoint();
        if (grouped && member) {
            const layers = this.repository.getMany(selectedIds);
            this.transforms.beginMove(layers);
        } else {
            this.onSelect([layer.id], {});
            this.transforms.beginMove(layer);
        }
        this.canvas.classList.add('is-dragging');
    }

    onMouseDrag(event) {
        if (this.drawing.isActive) {
            const shift = event.modifiers.shift;
            return this.drawing.previewTo(event.point, shift);
        }
        this.transforms.update(event);
    }

    onMouseMove(event) {
        const state = this.getState();
        if (state.activeTool) return this.setCursor('crosshair');
        if (this.transforms.session) return;
        const layer = this.repository.getById(state.selectedId);
        const editing = layer && state.pointEditingId === layer.id;
        if (editing) return this.setPointCursor(event);
        const handle = layer && findTransformHandle(this.scene, event.point);
        if (handle) return this.setTransformCursor(handle, layer);
        const hovered = this.topmostLayerAt(event.point);
        this.setCursor(hovered ? 'grab' : 'default');
    }

    setPointCursor(event) {
        const control = findPointControl(this.scene, event.point);
        if (!control) return this.setCursor('default');
        const isAnchor = control.data.pointControlType === 'point';
        this.setCursor(isAnchor ? 'move' : 'crosshair');
    }

    topmostLayerAt(point) {
        const unit = this.scene.projectUnitsPerCssPixel?.() ?? 1;
        return topmostLayerAt(this.repository, point, 8 * unit);
    }

    setTransformCursor(handle, layer) {
        const name = handle.data.transformHandle;
        if (name === 'rotate') return this.setCursor('grab');
        const grouped = handle.data.groupHandle === true;
        const rotation = grouped ? 0 : layer.data.rotation || 0;
        const width = grouped ? 1 : layer.data.width;
        const height = grouped ? 1 : layer.data.height;
        this.setCursor(resizeCursor(name, rotation, width, height));
    }

    onMouseUp(event) {
        if (this.drawing.isActive) {
            return this.finishDrawing(event);
        }
        this.transforms.end();
        this.canvas.classList.remove('is-dragging');
        this.setCursor('default');
    }

    finishDrawing(event) {
        const shift = event.modifiers.shift;
        const result = this.drawing.finish(event.point, shift);
        this.onDrawingChange(false);
        if (!result) return this.setCursor('crosshair');
        const layer = this.repository.create(
            result.draft.shapeDef.type,
            result.shape,
        );
        this.onCreate(layer.id);
    }

    setCursor(value) {
        this.canvas.style.cursor = value;
    }

    destroy() {
        this.paperTool.remove();
    }
}
