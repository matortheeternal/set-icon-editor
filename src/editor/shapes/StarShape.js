import { Shape } from './Shape.js';
import { registerShape } from './shapeRegistry.js';

class StarShape extends Shape {
    type = 'star';
    shortcut = 's';
    usesPointCount = true;

    get icon() {
        return [
            '<path d="m24 4.5 5.7 11.7 12.9 1.9',
            '-9.3 9.1 2.2 12.8L24 34l-11.5 6',
            ' 2.2-12.8-9.3-9.1 12.9-1.9Z"/>',
        ].join(' ');
    }

    label(L) {
        return L`Star`;
    }

    draw(paperScope, draft, point) {
        const radius = draft.start.getDistance(point);
        if (radius < 1) return null;
        return new paperScope.Path.Star(
            draft.start,
            draft.pointCount,
            radius * 0.46,
            radius,
        );
    }
}

registerShape(new StarShape());
