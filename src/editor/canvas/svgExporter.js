import { downloadTextFile } from '../../shared/saveFile.js';
import {
    describeProjectLayers,
    metadataElement,
} from './layeredSvg.js';
import { normalizeExportFrame } from './documentSize.js';

export function wrapSvg(geometry, width, height, metadata = null, viewBox = null) {
    const open = `<svg xmlns="http://www.w3.org/2000/svg" width=`;
    const size = `"${width}" height="${height}"`;
    const box = viewBox ?? `0 0 ${width} ${height}`;
    const view = ` viewBox="${box}">`;
    const body = metadata ? [metadata, geometry].join('\n') : geometry;
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `${open}${size}${view}`,
        body,
        '</svg>',
    ].join('\n');
}

export function serializeScene(scene, repository = null) {
    const documentSize = scene.documentSize ?? scene.scope.view.viewSize;
    const documentWidth = documentSize.width;
    const documentHeight = documentSize.height;
    const options = { asString: true, precision: 5 };
    const geometry = scene.compositeLayer.exportSVG(options);
    const layers = repository ? describeProjectLayers(repository) : [];
    const metadata = layers.length ? metadataElement(layers) : null;
    const frame = normalizeExportFrame(documentWidth, documentHeight);
    const viewBox = `0 0 ${documentWidth} ${documentHeight}`;
    return wrapSvg(geometry, frame.width, frame.height, metadata, viewBox);
}

export function downloadSvg(svg, filename = 'untitled-icon.svg') {
    downloadTextFile(filename, svg, 'image/svg+xml');
}
