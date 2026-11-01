export const BUILT_IN_RARITIES = [
    {
        id: 'common',
        name: 'Common',
        g1: '#000000',
        g2: '#000000',
        g3: '#000000',
        g4: '#000000',
        outline: '#ffffff',
    },
    {
        id: 'uncommon',
        name: 'Uncommon',
        g1: '#6c7d8f',
        g2: '#c0d6e5',
        g3: '#c0d6e5',
        g4: '#9ab4c8',
        outline: '#000000',
    },
    {
        id: 'rare',
        name: 'Rare',
        g1: '#876c13',
        g2: '#f6e8a3',
        g3: '#f6e8a3',
        g4: '#d7bf55',
        outline: '#000000',
    },
    {
        id: 'mythic',
        name: 'Mythic Rare',
        g1: '#b02929',
        g2: '#ffb347',
        g3: '#ffb347',
        g4: '#ff8a00',
        outline: '#000000',
    },
    {
        id: 'special',
        name: 'Special',
        g1: '#240f3d',
        g2: '#a07baa',
        g3: '#907697',
        g4: '#1a0a34',
        outline: '#ffffff',
    },
];

export const CUSTOM_RARITIES_KEY = 'set-icon-editor.rarities';

function storageBackend(storage) {
    if (storage !== undefined) return storage ?? null;
    try {
        return globalThis.localStorage ?? null;
    } catch {
        return null;
    }
}

export function loadCustomRarities(storage) {
    const backend = storageBackend(storage);
    if (!backend) return [];
    let raw = null;
    try {
        raw = backend.getItem(CUSTOM_RARITIES_KEY);
    } catch {
        return [];
    }
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((entry) => typeof entry?.id === 'string');
    } catch {
        return [];
    }
}

function persistCustomRarities(list, backend) {
    try {
        backend.setItem(CUSTOM_RARITIES_KEY, JSON.stringify(list));
    } catch {
    }
    return list;
}

export function saveCustomRarity(preset, storage) {
    const backend = storageBackend(storage);
    const list = loadCustomRarities(backend);
    const clean = {
        id: String(preset?.id ?? `custom-${Date.now()}`),
        name: String(preset?.name ?? 'Custom').trim() || 'Custom',
        g1: preset?.g1 ?? '#000000',
        g2: preset?.g2 ?? '#000000',
        g3: preset?.g3 ?? '#000000',
        g4: preset?.g4 ?? '#000000',
        outline: preset?.outline ?? '#ffffff',
        custom: true,
    };
    const next = [...list.filter((entry) => entry.id !== clean.id), clean];
    if (!backend) return next;
    return persistCustomRarities(next, backend);
}

export function deleteCustomRarity(id, storage) {
    const backend = storageBackend(storage);
    const next = loadCustomRarities(backend).filter((entry) => entry.id !== id);
    if (!backend) return next;
    return persistCustomRarities(next, backend);
}

export function allRarities(storage) {
    return [...BUILT_IN_RARITIES, ...loadCustomRarities(storage)];
}

export function findRarity(id, storage) {
    return allRarities(storage).find((entry) => entry.id === id)
        ?? BUILT_IN_RARITIES[0];
}
