import { DEFAULT_DOCUMENT_SIZE } from './documentSize.js';

export function scaledCanvasEventPoint(scope, canvas, event) {
    const source = event.targetTouches?.[0]
        ?? event.changedTouches?.[0]
        ?? event;
    const rect = canvas.getBoundingClientRect?.();
    const { width, height } = scope.view.viewSize;
    if (!rect?.width || !rect?.height
        || !Number.isFinite(source.clientX)
        || !Number.isFinite(source.clientY)) {
        return null;
    }
    const viewPoint = new scope.Point(
        (source.clientX - rect.left) * width / rect.width,
        (source.clientY - rect.top) * height / rect.height,
    );
    return scope.view.viewToProject(viewPoint);
}

export class PaperScene {
    constructor(paperLibrary, canvas) {
        this.canvas = canvas;
        this.documentSize = new paperLibrary.Size(
            DEFAULT_DOCUMENT_SIZE,
            DEFAULT_DOCUMENT_SIZE,
        );
        this.scope = new paperLibrary.PaperScope();
        this.scope.setup(canvas);
        this.scope.view.center = new this.scope.Point(
            DEFAULT_DOCUMENT_SIZE / 2,
            DEFAULT_DOCUMENT_SIZE / 2,
        );
        const defaultGetEventPoint = this.scope.view.getEventPoint.bind(this.scope.view);
        this.scope.view.getEventPoint = (event) =>
            scaledCanvasEventPoint(this.scope, canvas, event)
            ?? defaultGetEventPoint(event);
        this.scope.project.activeLayer.remove();
        this.compositeLayer = this.createOverlayLayer('Rendered geometry',);
        this.previewLayer = this.createOverlayLayer('Drawing preview',);
        this.overlayLayer = this.createOverlayLayer('Transform controls',);
    }

    createOverlayLayer(name) {
        const layer = new this.scope.Layer();
        layer.name = name;
        return layer;
    }

    bringOverlaysToFront() {
        this.compositeLayer.bringToFront();
        this.previewLayer.bringToFront();
        this.overlayLayer.bringToFront();
    }

    resize(width, height, scale = 1) {
        const safeWidth = Math.max(1, Number(width) || 1);
        const safeHeight = Math.max(1, Number(height) || 1);
        const safeScale = Math.max(Number.EPSILON, Number(scale) || 1);
        this.scope.view.viewSize = new this.scope.Size(safeWidth, safeHeight);
        this.scope.view.zoom = safeScale;
        this.scope.view.center = new this.scope.Point(
            this.documentSize.width / 2,
            this.documentSize.height / 2,
        );
    }

    projectUnitsPerCssPixel() {
        const rect = this.canvas.getBoundingClientRect?.();
        const viewWidth = this.scope.view.viewSize.width;
        const zoom = this.scope.view.zoom;
        if (!rect?.width || !Number.isFinite(viewWidth)
            || !Number.isFinite(zoom) || zoom <= 0) return 1;
        return viewWidth / rect.width / zoom;
    }

    update() {
        this.scope.view.update();
    }

    destroy() {
        this.scope.project.remove();
        this.scope.remove();
    }
}
