import './shapes/RectangleShape.js';
import './shapes/EllipseShape.js';
import './shapes/PolygonShape.js';
import './shapes/StarShape.js';

export { Shape } from './shapes/Shape.js';
export {
    MIN_SHAPE_SIZE,
    SHAPE_STYLE,
} from './shapes/shapeStyle.js';
export {
    SHAPES,
    registerShape,
    shapeDisplayFor,
    shapeForShortcut,
    shapeForType,
} from './shapes/shapeRegistry.js';
