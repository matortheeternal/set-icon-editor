// Renders an exported document SVG the way the icon would look on a
// card: every painted fill becomes the rarity gradient and every painted
// stroke becomes the rarity outline color. String-based so it stays
// unit-testable in Node (no DOMParser there) and so the layered
// `<metadata>` project block never leaks into the preview.

export const RARITY_GRADIENT_ID = 'rarity-grad';

const STOPS = [
    ['g1', '0%'],
    ['g2', '45%'],
    ['g3', '55%'],
    ['g4', '100%'],
];

function safeColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(value ?? '') ? value : fallback;
}

export function rarityGradientDef(preset) {
    const stops = STOPS.map(([key, offset]) =>
        `<stop offset="${offset}" stop-color="${safeColor(preset[key], '#000000')}"/>`,
    ).join('');
    return '<defs><linearGradient'
        + ` id="${RARITY_GRADIENT_ID}" x1="0%" y1="0%" x2="100%" y2="100%">`
        + `${stops}</linearGradient></defs>`;
}

// `fill="none"` shapes (counters, holes) stay unpainted; everything else
// takes the gradient. Strokes keep their widths, only the color changes.
export function applyRarity(svgText, preset) {
    if (typeof svgText !== 'string' || !svgText) return '';
    const outline = safeColor(preset?.outline, '#ffffff');
    const withoutMetadata = svgText.replace(/<metadata[\s\S]*?<\/metadata>/, '');
    const withGradient = withoutMetadata.replace(
        /<svg([^>]*)>/,
        `<svg$1>${rarityGradientDef(preset ?? {})}`,
    );
    return withGradient
        .replace(/\sfill="(?!none")[^"]*"/g, ` fill="url(#${RARITY_GRADIENT_ID})"`)
        .replace(/\sstroke="(?!none")[^"]*"/g, ` stroke="${outline}"`);
}

// Strips the XML prolog so the markup can be injected via innerHTML.
export function previewMarkup(svgText, preset) {
    return applyRarity(svgText, preset).replace(/^<\?xml[^?]*\?>\s*/, '');
}
