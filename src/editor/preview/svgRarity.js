const SVG_NS = 'http://www.w3.org/2000/svg';
const OFFSETS = ['0%', '45%', '55%', '100%'];
let nextId = 0;

function safeColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(value ?? '') ? value : fallback;
}

function parseSvg(svgText) {
    if (typeof svgText !== 'string' || !svgText.trim()) return null;
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svg = doc.documentElement;
    if (svg.localName !== 'svg' || doc.querySelector('parsererror')) return null;
    return svg;
}

function renameIds(svg, prefix) {
    const ids = new Map();
    for (const element of [svg, ...svg.querySelectorAll('[id]')]) {
        if (!element.id) continue;
        const id = `${prefix}-${ids.size}`;
        ids.set(element.id, id);
        element.id = id;
    }
    return ids;
}

function updateIdReferences(svg, ids) {
    for (const element of [svg, ...svg.querySelectorAll('*')]) {
        for (const attribute of [...element.attributes]) {
            let value = attribute.value;
            for (const [oldId, id] of ids) {
                value = value.replaceAll(`url(#${oldId})`, `url(#${id})`);
                if (value === `#${oldId}`) value = `#${id}`;
            }
            element.setAttribute(attribute.name, value);
        }
    }
}

function prepareSvg(svg, prefix) {
    for (const metadata of svg.querySelectorAll('metadata')) metadata.remove();
    const ids = renameIds(svg, prefix);
    updateIdReferences(svg, ids);
}

function rarityPalette(preset) {
    const outline = safeColor(preset.outline, '#ffffff');
    const colors = OFFSETS.map(
        (_, index) => safeColor(preset[`g${index + 1}`], '#000000')
    );
    return { outline, colors };
}

function replacePaint(element, paint, color) {
    const value = element.style.getPropertyValue(paint)
        || element.getAttribute(paint);
    if (!value || value === 'none' || value === 'inherit') return;
    element.setAttribute(paint, color);
    element.style.removeProperty(paint);
}

function styleGeometry(svg, gradientId, outline) {
    const fill = `url(#${gradientId})`;
    for (const element of [svg, ...svg.querySelectorAll('*')]) {
        if (element.closest('defs, mask, clipPath, pattern')) continue;
        replacePaint(element, 'fill', fill);
        replacePaint(element, 'stroke', outline);
    }
    for (const flood of svg.querySelectorAll('feFlood')) {
        replacePaint(flood, 'flood-color', outline);
    }
    if (!svg.hasAttribute('fill') && !svg.style.fill) svg.setAttribute('fill', fill);
}

function createGradient(doc, id, colors) {
    const gradient = doc.createElementNS(SVG_NS, 'linearGradient');
    const attributes = { id, x1: '0%', y1: '0%', x2: '100%', y2: '100%' };
    for (const [name, value] of Object.entries(attributes)) {
        gradient.setAttribute(name, value);
    }
    for (const [index, offset] of OFFSETS.entries()) {
        const stop = doc.createElementNS(SVG_NS, 'stop');
        stop.setAttribute('offset', offset);
        stop.setAttribute('stop-color', colors[index]);
        gradient.append(stop);
    }
    return gradient;
}

function addRarityGradient(svg, id, colors) {
    const doc = svg.ownerDocument;
    const defs = doc.createElementNS(SVG_NS, 'defs');
    defs.append(createGradient(doc, id, colors));
    svg.prepend(defs);
}

export function raritySvg(svgText, preset = {}) {
    const svg = parseSvg(svgText);
    if (!svg) return null;
    const prefix = `set-rarity-${++nextId}`;
    prepareSvg(svg, prefix);
    const palette = rarityPalette(preset);
    const gradientId = `${prefix}-paint`;
    styleGeometry(svg, gradientId, palette.outline);
    addRarityGradient(svg, gradientId, palette.colors);
    return svg;
}
