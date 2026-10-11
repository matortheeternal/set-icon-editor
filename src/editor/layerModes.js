export const LAYER_MODES = ['overlap', 'merge', 'intersection', 'difference'];

export function isLayerMode(mode) {
    return LAYER_MODES.includes(mode);
}
