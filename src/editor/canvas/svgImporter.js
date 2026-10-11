import { SHAPE_STYLE } from '../Shape.js';
import {
    buildLayersFromProject,
    parseProjectMetadata,
} from './layeredSvg.js';

export function importSvgRoot(scene, svgText) {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const root = doc.documentElement;
    if (!root || root.tagName.toLowerCase() !== 'svg') {
        throw new Error('Not an SVG document.');
    }
    return scene.scope.project.importSVG(root);
}

export function collectPathSources(imported, scope) {
    const self = imported instanceof scope.PathItem ? [imported] : [];
    const nested = imported.getItems({ class: scope.PathItem }) ?? [];
    return [...self, ...nested]
        .filter((item) => !insideCompound(item, scope, imported))
        .map((item) => ({
            name: item.name,
            compound: item instanceof scope.CompoundPath,
            pathData: item.pathData,
        }))
        .filter((source) => source.pathData);
}

function insideCompound(item, scope, stopAt) {
    let parent = item.parent;
    while (parent && parent !== stopAt) {
        if (parent instanceof scope.CompoundPath) return true;
        parent = parent.parent;
    }
    return false;
}

export function buildImportedLayers(scene, sources) {
    let sequence = 0;
    return sources.map((source) => {
        sequence += 1;
        const Kind = source.compound ? scene.scope.CompoundPath : scene.scope.Path;
        const item = new Kind(source.pathData);
        item.style = SHAPE_STYLE;
        const layer = new scene.scope.Layer();
        layer.addChild(item);
        layer.name = source.name || `Imported ${sequence}`;
        const bounds = item.bounds;
        layer.data = {
            isShapeLayer: true,
            shapeType: 'imported',
            mode: 'overlap',
            width: Math.max(1, bounds.width),
            height: Math.max(1, bounds.height),
            rotation: 0,
        };
        return layer;
    });
}

export function importLayers(scene, svgText) {
    const project = parseProjectMetadata(svgText);
    if (project) return buildLayersFromProject(scene, project.layers);
    const imported = importSvgRoot(scene, svgText);
    const sources = collectPathSources(imported, scene.scope);
    imported.remove();
    if (!sources.length) throw new Error('No importable paths found.');
    return buildImportedLayers(scene, sources);
}
