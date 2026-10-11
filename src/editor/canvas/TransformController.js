import {
    HANDLE_DEFINITIONS,
    ROTATION_SNAP_STEP,
    groupBoundsOf,
    nextSize,
    normalizedAngleDelta,
    normalizedRotation,
    orientedPoint,
    snapToStep,
} from './geometry.js';
import { GRID_SNAP_STEP } from './documentSize.js';
import { applyPointDrag, createPointSession } from './pointEditing.js';

export class TransformController {
    session = null;

    constructor(scene, repository, onTransform) {
        this.scene = scene;
        this.repository = repository;
        this.onTransform = onTransform;
        this.strategies = {
            move: (event) => this.applyMove(event),
            point: (event) => this.applyPoint(event),
            scale: (event) => this.applyScale(event),
            rotate: (event) => this.applyRotate(event),
        };
    }

    get activeLayers() {
        const layers = this.session?.layers ?? [];
        return layers.filter(Boolean);
    }

    applyMove(event) {
        const session = this.session;
        session.rawDelta = session.rawDelta.add(event.delta);
        let desired = session.rawDelta;
        if (event.modifiers?.control) {
            const target = session.origin.add(session.rawDelta);
            desired = new this.scene.scope.Point(
                snapToStep(target.x, GRID_SNAP_STEP) - session.origin.x,
                snapToStep(target.y, GRID_SNAP_STEP) - session.origin.y,
            );
        }
        const delta = desired.subtract(session.appliedDelta);
        for (const layer of this.activeLayers) {
            const position = layer.position.add(delta);
            layer.position = position;
        }
        session.appliedDelta = desired;
    }

    applyPoint(event) {
        applyPointDrag(
            this.repository,
            this.session,
            this.activeLayers,
            event,
        );
    }

    applyScale(event) {
        const session = this.session;
        const size = nextSize(
            session,
            event.point,
            event.modifiers.shift,
        );
        const rawScaleX = session.handle.x
            ? this.safeScale(size.width, session.lastWidth)
            : 1;
        const rawScaleY = session.handle.y
            ? this.safeScale(size.height, session.lastHeight)
            : 1;
        const scaleX = rawScaleX ?? 1;
        const scaleY = rawScaleY ?? 1;
        for (const layer of this.activeLayers) {
            layer.rotate(-session.rotation, session.anchor);
            layer.scale(scaleX, scaleY, session.anchor);
            layer.rotate(session.rotation, session.anchor);
        }
        const appliedSize = {
            width: rawScaleX == null ? session.lastWidth : size.width,
            height: rawScaleY == null ? session.lastHeight : size.height,
        };
        this.syncScaledData(appliedSize);
        if (rawScaleX != null) session.lastWidth = size.width;
        if (rawScaleY != null) session.lastHeight = size.height;
    }

    safeScale(next, previous) {
        if (Math.abs(next) <= Number.EPSILON
            || Math.abs(previous) <= Number.EPSILON) return null;
        return next / previous;
    }

    syncScaledData(size) {
        if (this.session.group) {
            for (const target of this.activeLayers) {
                this.repository.syncScaledBounds(target);
            }
            return;
        }
        for (const target of this.activeLayers) {
            Object.assign(target.data, size);
        }
    }

    applyRotate(event) {
        const session = this.session;
        const angle = event.point.subtract(session.center).angle;
        const raw = normalizedAngleDelta(angle - session.lastAngle);
        session.lastAngle = angle;
        session.rawDelta += raw;
        let desired = session.rawDelta;
        if (event.modifiers?.control) {
            const global = session.baseRotation + session.rawDelta;
            desired = snapToStep(global, ROTATION_SNAP_STEP)
                - session.baseRotation;
        }
        const delta = desired - session.appliedDelta;
        if (!delta) return;
        for (const layer of this.activeLayers) {
            layer.rotate(delta, session.center);
            const rotation = layer.data.rotation || 0;
            layer.data.rotation = normalizedRotation(rotation + delta);
        }
        session.appliedDelta = desired;
    }

    beginMove(layersOrLayer = null) {
        const flat = [layersOrLayer].flat().filter(Boolean);
        const bounds = flat.length > 1 ? groupBoundsOf(flat) : null;
        const origin = bounds
            ? new this.scene.scope.Point(bounds.center.x, bounds.center.y)
            : flat[0]?.position.clone();
        const zero = new this.scene.scope.Point(0, 0);
        this.session = {
            mode: 'move',
            layers: flat,
            origin,
            rawDelta: zero,
            appliedDelta: zero.clone(),
        };
    }

    beginPoint(control, layer = null, selectedIndices = []) {
        this.session = createPointSession(control, layer, selectedIndices);
    }

    beginRotate(layersOrLayer, point) {
        const layers = [layersOrLayer].flat().filter(Boolean);
        const bounds = layers.length > 1 ? groupBoundsOf(layers) : null;
        const scope = this.scene.scope;
        const center = bounds
            ? new scope.Point(bounds.center.x, bounds.center.y)
            : layers[0].position.clone();
        this.session = {
            mode: 'rotate',
            layers,
            center,
            lastAngle: point.subtract(center).angle,
            baseRotation: layers.length === 1
                ? normalizedRotation(layers[0].data.rotation || 0)
                : 0,
            rawDelta: 0,
            appliedDelta: 0,
        };
    }

    beginScale(layersOrLayer, handleName) {
        const layers = [layersOrLayer].flat().filter(Boolean);
        if (layers.length > 1) return this.beginGroupScale(layers, handleName);
        const layer = layers[0];
        const handle = HANDLE_DEFINITIONS.find(
            ({ name }) => name === handleName,
        );
        const { width, height, rotation = 0 } = layer.data;
        const anchor = orientedPoint(
            this.scene.scope,
            layer.position,
            handle.x * -width / 2,
            handle.y * -height / 2,
            rotation,
        );
        this.session = {
            mode: 'scale',
            layers,
            handle,
            anchor,
            rotation,
            width,
            height,
            lastWidth: width,
            lastHeight: height,
        };
    }

    beginGroupScale(layers, handleName) {
        const handle = HANDLE_DEFINITIONS.find(
            ({ name }) => name === handleName,
        );
        const bounds = groupBoundsOf(layers);
        const scope = this.scene.scope;
        const center = new scope.Point(
            bounds.center.x,
            bounds.center.y,
        );
        const anchor = orientedPoint(
            scope,
            center,
            handle.x * -bounds.width / 2,
            handle.y * -bounds.height / 2,
            0,
        );
        this.session = {
            mode: 'scale',
            layers,
            group: true,
            handle,
            anchor,
            rotation: 0,
            width: bounds.width,
            height: bounds.height,
            lastWidth: bounds.width,
            lastHeight: bounds.height,
        };
    }

    update(event) {
        if (!this.session) return false;
        const pointOnly = this.session.mode === 'point';
        if (!this.activeLayers.length && !pointOnly) return false;
        const strategy = this.strategies[this.session.mode];
        if (!strategy) {
            const mode = this.session.mode;
            console.warn(`Unknown transform mode: ${mode}`);
            return false;
        }
        strategy(event);
        this.onTransform();
        return true;
    }

    end() { this.session = null; }
}
