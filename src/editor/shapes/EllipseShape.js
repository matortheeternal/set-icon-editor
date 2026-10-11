import { Shape } from './Shape.js';
import { registerShape } from './shapeRegistry.js';

class EllipseShape extends Shape {
    type = 'ellipse';
    shortcut = 'e';

    get icon() {
        return '<ellipse cx="24" cy="24" rx="18" ry="14"/>';
    }

    label(L) {
        return L`Ellipse`;
    }

    draw(paperScope, draft, point, constrain) {
        const end = this.constrainedEnd(
            paperScope,
            draft.start,
            point,
            constrain,
        );
        const bounds = new paperScope.Rectangle(
            draft.start,
            end,
        );
        const tooSmall = bounds.width < 1
            || bounds.height < 1;
        if (tooSmall) return null;
        return new paperScope.Path.Ellipse({
            rectangle: bounds,
        });
    }
}

registerShape(new EllipseShape());
