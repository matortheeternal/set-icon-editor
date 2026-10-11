import { HANDLE_DEFINITIONS } from './geometry.js';
import { orientedPoint } from './geometry.js';

export const HANDLE_THEME = {
    outline: '#0d99ff',
    outlineWidth: 2,
    handleFill: '#ffffff',
    handleStroke: '#0d99ff',
    handleWidth: 2,
    handleSelectedFill: '#0d99ff',
    anchorFill: '#ffffff',
    anchorStroke: '#0d99ff',
    anchorSelectedFill: '#0d99ff',
    anchorSelectedStroke: '#ffffff',
    guideStroke: '#0d99ff',
    collapsedHandleEps: 0.01,
};

function screenUnit(scene) {
    return scene.projectUnitsPerCssPixel?.() ?? 1;
}

export function snapToDevicePixel(scene, point) {
    const view = scene.scope.view;
    if (!view?.projectToView || !view?.viewToProject) return point;
    const ratio = Math.max(1, Number(view.pixelRatio) || 1);
    const screen = view.projectToView(point);
    screen.x = Math.round(screen.x * ratio) / ratio;
    screen.y = Math.round(screen.y * ratio) / ratio;
    return view.viewToProject(screen);
}

export function transformCorners(scene, layer) {
    const { width, height, rotation = 0 } = layer.data;
    const scope = scene.scope;
    const center = layer.position;
    return [
        orientedPoint(scope, center, -width / 2, -height / 2, rotation),
        orientedPoint(scope, center, width / 2, -height / 2, rotation),
        orientedPoint(scope, center, width / 2, height / 2, rotation),
        orientedPoint(scope, center, -width / 2, height / 2, rotation),
    ];
}

export function addTransformOutline(scene, layer) {
    const unit = screenUnit(scene);
    new scene.scope.Path({
        segments: transformCorners(scene, layer),
        closed: true,
        strokeColor: HANDLE_THEME.outline,
        strokeWidth: HANDLE_THEME.outlineWidth * unit,
    });
}

export function addRotationControl(scene, layer, groupHandle = false) {
    const { height, rotation = 0 } = layer.data;
    const scope = scene.scope;
    const center = layer.position;
    const unit = screenUnit(scene);
    const top = orientedPoint(scope, center, 0, -height / 2, rotation);
    const offset = -height / 2 - 34 * unit * (Math.sign(height) || 1);
    const handle = orientedPoint(scope, center, 0, offset, rotation);
    const stem = new scope.Path.Line(top, handle);
    stem.style = {
        strokeColor: HANDLE_THEME.outline,
        strokeWidth: HANDLE_THEME.outlineWidth * unit,
    };
    const circle = new scope.Path.Circle({
        center: handle,
        radius: 6 * unit,
        fillColor: HANDLE_THEME.handleFill,
        strokeColor: HANDLE_THEME.handleStroke,
        strokeWidth: HANDLE_THEME.handleWidth * unit,
    });
    circle.data.transformHandle = 'rotate';
    if (groupHandle) circle.data.groupHandle = true;
}

export function addResizeControl(scene, layer, definition, group = false) {
    const { width, height, rotation = 0 } = layer.data;
    const scope = scene.scope;
    const unit = screenUnit(scene);
    const x = definition.x * width / 2;
    const y = definition.y * height / 2;
    const point = snapToDevicePixel(scene, orientedPoint(
        scope,
        layer.position,
        x,
        y,
        rotation,
    ));
    const corner = point.subtract(5 * unit);
    const size = new scope.Size(10 * unit, 10 * unit);
    const square = new scope.Path.Rectangle({
        rectangle: new scope.Rectangle(corner, size),
        radius: unit,
        fillColor: HANDLE_THEME.handleFill,
        strokeColor: HANDLE_THEME.handleStroke,
        strokeWidth: HANDLE_THEME.handleWidth * unit,
    });
    square.data.transformHandle = definition.name;
    if (group) square.data.groupHandle = true;
}

export function renderTransformControls(scene, layer) {
    addTransformOutline(scene, layer);
    addRotationControl(scene, layer);
    for (const handle of HANDLE_DEFINITIONS) {
        addResizeControl(scene, layer, handle);
    }
}

export function renderGroupHandles(scene, target) {
    addRotationControl(scene, target, true);
    for (const handle of HANDLE_DEFINITIONS) {
        addResizeControl(scene, target, handle, true);
    }
}

export function guideSegment(scene, shape, segment) {
    const point = shape.localToGlobal(segment.point);
    const incoming = segment.point.add(segment.handleIn);
    const outgoing = segment.point.add(segment.handleOut);
    const handleIn = shape.localToGlobal(incoming).subtract(point);
    const handleOut = shape.localToGlobal(outgoing).subtract(point);
    return new scene.scope.Segment(point, handleIn, handleOut);
}

export function addPointGuide(scene, shape) {
    const unit = screenUnit(scene);
    const segments = shape.segments.map((segment) => {
        return guideSegment(scene, shape, segment);
    });
    new scene.scope.Path({
        segments,
        closed: shape.closed,
        strokeColor: HANDLE_THEME.outline,
        strokeWidth: HANDLE_THEME.outlineWidth * unit,
    });
}

export function addBezierHandle(
    scene,
    shape,
    segment,
    segmentIndex,
    controlType,
    selected = false,
) {
    const handle = segment[controlType];
    if (handle.length < HANDLE_THEME.collapsedHandleEps) return;
    const anchor = shape.localToGlobal(segment.point);
    const target = segment.point.add(handle);
    const endpoint = shape.localToGlobal(target);
    const unit = screenUnit(scene);
    const line = new scene.scope.Path.Line(anchor, endpoint);
    line.style = {
        strokeColor: HANDLE_THEME.guideStroke,
        strokeWidth: unit,
    };
    const control = new scene.scope.Path.Circle({
        center: endpoint,
        radius: 4 * unit,
        fillColor: selected
            ? HANDLE_THEME.handleSelectedFill
            : HANDLE_THEME.handleFill,
        strokeColor: HANDLE_THEME.handleStroke,
        strokeWidth: HANDLE_THEME.handleWidth * unit,
    });
    control.data = { pointControlType: controlType, segmentIndex };
}

export function addPointAnchor(
    scene,
    shape,
    segment,
    segmentIndex,
    selected = false,
) {
    const anchor = snapToDevicePixel(
        scene,
        shape.localToGlobal(segment.point),
    );
    const unit = screenUnit(scene);
    const corner = anchor.subtract(5 * unit);
    const size = new scene.scope.Size(10 * unit, 10 * unit);
    const control = new scene.scope.Path.Rectangle({
        rectangle: new scene.scope.Rectangle(corner, size),
        fillColor: selected
            ? HANDLE_THEME.anchorSelectedFill
            : HANDLE_THEME.anchorFill,
        strokeColor: selected
            ? HANDLE_THEME.anchorSelectedStroke
            : HANDLE_THEME.anchorStroke,
        strokeWidth: HANDLE_THEME.handleWidth * unit,
    });
    control.data = { pointControlType: 'point', segmentIndex };
}

export function renderPointControls(scene, shape, selectedIndices = []) {
    addPointGuide(scene, shape);
    const selected = new Set(selectedIndices.map(Number));
    shape.segments.forEach((segment, index) => {
        const isSelected = selected.has(index);
        addBezierHandle(scene, shape, segment, index, 'handleIn', isSelected);
        addBezierHandle(scene, shape, segment, index, 'handleOut', isSelected);
        addPointAnchor(scene, shape, segment, index, isSelected);
    });
}
