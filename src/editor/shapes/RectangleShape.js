import { Shape } from './Shape.js';
import { registerShape } from './shapeRegistry.js';

class RectangleShape extends Shape {
    type = 'rectangle';
    shortcut = 'r';

    get icon() {
        return '<rect x="6" y="9" width="36" height="30"/>';
    }

    label(L) {
        return L`Rectangle`;
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
        return new paperScope.Path.Rectangle(bounds);
    }
}

registerShape(new RectangleShape());
