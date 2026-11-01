import { isNeutralino } from './environment.js';

export function downloadTextFile(filename, contents, mimeType) {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const download = document.createElement('a');
    download.href = url;
    download.download = filename;
    document.body.append(download);
    download.click();
    download.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function canShowNativeSaveDialog() {
    return typeof globalThis.Neutralino?.os?.showSaveDialog === 'function';
}

export async function requestNativeSavePath(defaultPath) {
    if (!canShowNativeSaveDialog()) return undefined;
    try {
        const picked = await globalThis.Neutralino.os.showSaveDialog(
            'Save icon',
            {
                defaultPath,
                filters: [{ name: 'SVG images', extensions: ['svg'] }],
            },
        );
        return picked || null;
    } catch (error) {
        console.error('Save dialog failed:', error);
        return null;
    }
}

export async function saveTextFile({ path, filename, contents, mimeType }) {    if (isNeutralino() && path) {
        await globalThis.Neutralino.filesystem.writeFile(path, contents);
        return path;
    }
    downloadTextFile(filename, contents, mimeType);
    return filename;
}
