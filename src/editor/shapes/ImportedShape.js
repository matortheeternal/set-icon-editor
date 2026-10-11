import { Shape } from './Shape.js';

class ImportedShape extends Shape {
    type = 'imported';

    get icon() {
        return '<path d="M8 8h32v32H8Z"/>';
    }

    label(L) {
        return L`Imported`;
    }

    draw() {
        throw new Error('Imported layers cannot be drawn.');
    }
}

export const importedShape = new ImportedShape();
