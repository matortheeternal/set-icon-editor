export const STANDARD_DOCUMENT_SIZES = [128, 256, 512, 1024];
export const DEFAULT_DOCUMENT_SIZE = 512;
export const MAX_ARTBOARD_DISPLAY_SIZE = 760;

export const GRID_MAJOR_DIVISIONS = 4;
export const GRID_MINOR_DIVISIONS = 16;
export const GRID_SNAP_STEP = DEFAULT_DOCUMENT_SIZE / GRID_MINOR_DIVISIONS;

export function nearestStandardSize(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return DEFAULT_DOCUMENT_SIZE;
    }
    let best = STANDARD_DOCUMENT_SIZES[0];
    for (const size of STANDARD_DOCUMENT_SIZES) {
        const candidate = Math.abs(size - numeric);
        const current = Math.abs(best - numeric);
        if (candidate < current || (candidate === current && size > best)) {
            best = size;
        }
    }
    return best;
}

export function normalizeExportFrame(width, height) {
    const safeWidth = Number.isFinite(Number(width)) && Number(width) > 0
        ? Number(width)
        : DEFAULT_DOCUMENT_SIZE;
    const safeHeight = Number.isFinite(Number(height)) && Number(height) > 0
        ? Number(height)
        : DEFAULT_DOCUMENT_SIZE;
    const standard = nearestStandardSize(Math.max(safeWidth, safeHeight));
    const scale = standard / Math.max(safeWidth, safeHeight);
    return {
        width: Math.max(1, Math.round(safeWidth * scale)),
        height: Math.max(1, Math.round(safeHeight * scale)),
    };
}

export function fitDocumentScale(
    width,
    height,
    documentSize = DEFAULT_DOCUMENT_SIZE,
    maxDisplaySize = MAX_ARTBOARD_DISPLAY_SIZE,
) {
    const safeWidth = Math.max(1, Number(width) || 1);
    const safeHeight = Math.max(1, Number(height) || 1);
    const safeDocumentSize = Math.max(1, Number(documentSize) || DEFAULT_DOCUMENT_SIZE);
    const safeMaximum = Math.max(1, Number(maxDisplaySize) || MAX_ARTBOARD_DISPLAY_SIZE);
    return Math.min(safeWidth, safeHeight, safeMaximum) / safeDocumentSize;
}

export function canvasOpacityMask(width, height, scale, outsideOpacity = 0.42) {
    const safeWidth = Math.max(1, Number(width) || 1);
    const safeHeight = Math.max(1, Number(height) || 1);
    const safeScale = Math.max(Number.EPSILON, Number(scale) || 1);
    const opacity = Math.min(1, Math.max(0, Number(outsideOpacity) || 0));
    const frameSize = DEFAULT_DOCUMENT_SIZE * safeScale;
    const x = (safeWidth - frameSize) / 2;
    const y = (safeHeight - frameSize) / 2;
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"'
        + ` viewBox="0 0 ${safeWidth} ${safeHeight}" preserveAspectRatio="none">`
        + `<rect width="100%" height="100%" fill="black" fill-opacity="${opacity}"/>`
        + `<rect x="${x}" y="${y}" width="${frameSize}" height="${frameSize}"`
        + ' fill="white"/></svg>';
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const GRID_LINE = '#36e076';
export const GRID_MINOR_OPACITY = 0.08;
export const GRID_MAJOR_OPACITY = 0.18;

function mixHex(background, foreground, amount) {
    const parse = (value) => value.slice(1).match(/../g).map((part) => {
        return Number.parseInt(part, 16);
    });
    const ratio = Math.min(1, Math.max(0, amount));
    const [br, bg, bb] = parse(background);
    const [fr, fg, fb] = parse(foreground);
    const channel = (base, tint) => Math.round(base + (tint - base) * ratio)
        .toString(16).padStart(2, '0');
    return `#${channel(br, fr)}${channel(bg, fg)}${channel(bb, fb)}`;
}

export function gridVisualColors(color = GRID_LINE) {
    const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : GRID_LINE;
    return {
        line: safeColor,
        shade: mixHex('#050706', safeColor, 0.04),
        border: mixHex('#17241d', safeColor, 0.22),
    };
}

// Single stretched SVG grid so major/minor lines share exact coordinates:
// minor tiles can no longer blur into doubled lines at half pixels, and a
// major line paints directly over its coincident minor line instead of
// stacking a second translucent line next to it.
export function gridBackgroundImage(
    major = GRID_MAJOR_DIVISIONS,
    minor = GRID_MINOR_DIVISIONS,
    color = GRID_LINE,
) {
    const { line: safeColor } = gridVisualColors(color);
    const per = Math.max(1, Math.round(minor / major));
    const minorLines = [];
    const majorLines = [];
    for (let index = 0; index <= minor; index += 1) {
        const line = `M${index} 0V${minor}M0 ${index}H${minor}`;
        (index % per === 0 ? majorLines : minorLines).push(line);
    }
    const layer = (lines, opacity) =>
        `<path d="${lines.join(' ')}" fill="none" stroke="${safeColor}"`
        + ` stroke-opacity="${opacity}" stroke-width="1"`
        + ' vector-effect="non-scaling-stroke"/>';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"'
        + ` viewBox="0 0 ${minor} ${minor}" preserveAspectRatio="none"`
        + ` shape-rendering="crispEdges">${layer(minorLines, GRID_MINOR_OPACITY)}`
        + `${layer(majorLines, GRID_MAJOR_OPACITY)}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
