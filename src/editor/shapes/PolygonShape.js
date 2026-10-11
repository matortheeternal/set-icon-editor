import { Shape } from './Shape.js';
import { registerShape } from './shapeRegistry.js';

class PolygonShape extends Shape {
    type = 'polygon';
    shortcut = 'g';
    usesPointCount = true;

    get icon() {
        return '<path d="M24 4.5 41 14v20L24 43.5 7 34V14Z"/>';
    }

    label(L) {
        return L`Polygon`;
    }

    draw(paperScope, draft, point) {
        const radius = draft.start.getDistance(point);
        if (radius < 1) return null;
        return new paperScope.Path.RegularPolygon(
            draft.start,
            draft.pointCount,
            radius,
        );
    }
}

registerShape(new PolygonShape());
