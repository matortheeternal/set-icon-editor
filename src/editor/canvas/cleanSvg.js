const DEFAULTS = {
    'fill-rule': 'nonzero',
    'stroke-linecap': 'butt',
    'stroke-linejoin': 'miter',
    'stroke-miterlimit': '4',
    'stroke-dasharray': 'none',
    'stroke-dashoffset': '0',
};

function inheritedAttribute(element, name, fallback) {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (parent.hasAttribute(name))
            return parent.getAttribute(name);
    }
    return fallback;
}

function removeSerializerNoise(element) {
    if (element.getAttribute('xmlns') === 'http://www.w3.org/2000/svg')
        element.removeAttribute('xmlns');
    for (const name of ['font-family', 'font-weight', 'font-size', 'text-anchor'])
        if (element.getAttribute(name) === 'none') element.removeAttribute(name);
    if (element.getAttribute('stroke-dasharray') === '')
        element.removeAttribute('stroke-dasharray');
    if (element.style.mixBlendMode === 'normal')
        element.style.removeProperty('mix-blend-mode');
    if (!element.getAttribute('style')?.trim())
        element.removeAttribute('style');
}

function removeRedundantAttributes(element) {
    for (const [name, fallback] of Object.entries(DEFAULTS)) {
        const inherited = inheritedAttribute(element, name, fallback);
        if (element.getAttribute(name) === inherited) element.removeAttribute(name);
    }
    const join = element.getAttribute('stroke-linejoin')
        ?? inheritedAttribute(element, 'stroke-linejoin', 'miter');
    const hasJoinOverrides = element.querySelector('[stroke-linejoin], [style]');
    if ((join === 'round' || join === 'bevel') && !hasJoinOverrides)
        element.removeAttribute('stroke-miterlimit');
}

export function cleanSvg(geometry) {
    const doc = new DOMParser().parseFromString(geometry, 'image/svg+xml');
    const root = doc.documentElement;
    for (const element of [root, ...root.querySelectorAll('*')]) {
        removeSerializerNoise(element);
        removeRedundantAttributes(element);
    }
    return new XMLSerializer().serializeToString(root);
}
