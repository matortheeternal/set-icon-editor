import { Shape } from '../Shape.js';

export class DrawingController {
    draft = null;

    constructor(scene) {
        this.scene = scene;
    }

    get isActive() {
        return this.draft != null;
    }

    get shapeDef() {
        return this.draft?.shapeDef ?? null;
    }

    begin(shapeDef, point, pointCount) {
        this.draft = {
            shapeDef,
            start: point.clone(),
            pointCount,
        };
        this.scene.previewLayer.removeChildren();
    }

    previewTo(point, constrainSquare) {
        this.scene.previewLayer.removeChildren();
        this.scene.previewLayer.activate();
        const shape = this.draft.shapeDef.create(
            this.scene.scope,
            this.draft,
            point,
            constrainSquare,
        );
        this.scene.bringOverlaysToFront();
        this.scene.update();
        return shape;
    }

    finish(point, constrainSquare) {
        const draft = this.draft;
        const shape = this.previewTo(point, constrainSquare);
        this.draft = null;
        if (!shape) {
            this.scene.previewLayer.removeChildren();
            return null;
        }
        if (!Shape.isValidBounds(shape.bounds)) {
            this.scene.previewLayer.removeChildren();
            return null;
        }
        return { draft, shape };
    }

    cancel() {
        this.draft = null;
        this.scene.previewLayer.removeChildren();
        this.scene.update();
    }
}
