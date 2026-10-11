import { groupBoundsOf } from './geometry.js';
import {
    HANDLE_THEME,
    addTransformOutline,
    renderGroupHandles,
    renderPointControls,
    renderTransformControls,
} from './selectionOverlays.js';

export class SelectionControls {
    constructor(scene, repository, compositor) {
        this.scene = scene;
        this.repository = repository;
        this.compositor = compositor;
    }

    get singleSelectedLayer() {
        const ids = this.lastIds ?? [];
        if (ids.length !== 1) return null;
        const layers = this.repository.getMany(ids);
        return layers[0] ?? null;
    }

    render(selection, options = {}) {
        const ids = selection.selectedIds.map(Number);
        const valid = ids.filter(Number.isFinite);
        this.lastIds = valid;
        const primaryId = selection.primaryId ?? valid.at(-1);
        const pointEditingId = selection.pointEditingId ?? null;
        const selectedPointIndices = selection.selectedPointIndices ?? [];
        this.scene.overlayLayer.removeChildren();
        if (!options.skipRebuild) this.compositor.rebuild();
        const layers = this.repository.getMany(valid);
        const primary = layers.find(
            (layer) => layer.id === Number(primaryId),
        ) ?? null;
        this.scene.overlayLayer.activate();
        this.drawSelection(layers, primary, pointEditingId, selectedPointIndices);
        this.scene.overlayLayer.bringToFront();
        this.scene.update();
    }

    drawSelection(layers, primary, pointEditingId, selectedPointIndices = []) {
        const single = layers.length <= 1 && primary;
        if (single && pointEditingId === primary.id) {
            return this.drawPointEditing(primary, selectedPointIndices);
        }
        if (single) {
            return renderTransformControls(this.scene, primary);
        }
        for (const layer of layers) {
            addTransformOutline(this.scene, layer);
        }
        this.drawGroupSelection(layers);
    }

    drawGroupSelection(layers) {
        const bounds = groupBoundsOf(layers);
        if (!bounds || bounds.width < 1 || bounds.height < 1) return;
        this.drawGroupBounds(bounds);
        this.drawGroupHandles(bounds);
    }

    drawPointEditing(layer, selectedPointIndices = []) {
        const shape = this.repository.pathItem(layer);
        if (shape) renderPointControls(this.scene, shape, selectedPointIndices);
    }

    drawGroupBounds(bounds) {
        const unit = this.scene.projectUnitsPerCssPixel?.() ?? 1;
        const halfWidth = bounds.width / 2;
        const halfHeight = bounds.height / 2;
        const { x, y } = bounds.center;
        const corners = [
            [x - halfWidth, y - halfHeight],
            [x + halfWidth, y - halfHeight],
            [x + halfWidth, y + halfHeight],
            [x - halfWidth, y + halfHeight],
        ];
        const scope = this.scene.scope;
        const segments = corners.map(([px, py]) => {
            return new scope.Point(px, py);
        });
        new scope.Path({
            segments,
            closed: true,
            strokeColor: HANDLE_THEME.outline,
            strokeWidth: HANDLE_THEME.outlineWidth * unit,
            dashArray: [6 * unit, 4 * unit],
        });
    }

    drawGroupHandles(bounds) {
        const scope = this.scene.scope;
        const position = new scope.Point(
            bounds.center.x,
            bounds.center.y,
        );
        const target = {
            position,
            data: {
                width: bounds.width,
                height: bounds.height,
                rotation: 0,
            },
        };
        renderGroupHandles(this.scene, target);
    }
}
