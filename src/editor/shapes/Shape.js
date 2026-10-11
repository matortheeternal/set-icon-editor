import {
    MIN_SHAPE_SIZE,
    SHAPE_STYLE,
} from './shapeStyle.js';

export class Shape {
    usesPointCount = false;

    get fillColor() {
        return SHAPE_STYLE.fillColor;
    }

    static isValidBounds(bounds) {
        const width = bounds?.width ?? 0;
        const height = bounds?.height ?? 0;
        return width >= MIN_SHAPE_SIZE
            && height >= MIN_SHAPE_SIZE;
    }

    constrainedEnd(
        paperScope,
        start,
        point,
        constrainSquare,
    ) {
        if (!constrainSquare) return point;
        const delta = point.subtract(start);
        const size = Math.max(
            Math.abs(delta.x),
            Math.abs(delta.y),
        );
        const x = (Math.sign(delta.x) || 1) * size;
        const y = (Math.sign(delta.y) || 1) * size;
        return start.add(new paperScope.Point(x, y));
    }

    create(paperScope, draft, point, constrainSquare) {
        const path = this.draw(
            paperScope,
            draft,
            point,
            constrainSquare,
        );
        if (!path) return null;
        path.style = SHAPE_STYLE;
        return path;
    }

    name(L, count) {
        return L`${this.label(L)} ${count}`;
    }

    get icon() {
        const name = this.constructor.name;
        throw new Error(`${name} must implement icon.`);
    }

    get preview() {
        const stroke = SHAPE_STYLE.strokeColor;
        return [
            '<svg viewBox="0 0 48 48"',
            ' aria-hidden="true">',
            `<g fill="currentColor" stroke="${stroke}"`,
            ' stroke-width="4" stroke-linejoin="round">',
            `${this.icon}</g></svg>`,
        ].join('');
    }

    draw() {
        const name = this.constructor.name;
        throw new Error(`${name} must implement draw()`);
    }
}
