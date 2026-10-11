import { importedShape } from './ImportedShape.js';

export const SHAPES = [];

export function registerShape(shape) {
    SHAPES.push(shape);
}

export function shapeForType(type) {
    const found = SHAPES.find(
        (shape) => shape.type === type,
    );
    return found ?? null;
}

export function shapeForShortcut(shortcut) {
    const found = SHAPES.find(
        (shape) => shape.shortcut === shortcut,
    );
    return found ?? null;
}

export function shapeDisplayFor(type) {
    return shapeForType(type) ?? importedShape;
}
