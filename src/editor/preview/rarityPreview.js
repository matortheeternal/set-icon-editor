import { raritySvg } from './svgRarity.js';

export function applyRarity(svgText, preset) {
    const svg = raritySvg(svgText, preset ?? {});
    return svg ? new XMLSerializer().serializeToString(svg) : '';
}

export function previewMarkup(svgText, preset) {
    return applyRarity(svgText, preset);
}
