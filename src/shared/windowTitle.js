export function setWindowTitle(filename) {
    const base = filename.split('/').at(-1) ?? filename;
    const dot = base.lastIndexOf('.');
    const name = dot > 0 ? base.slice(0, dot) : base;
    document.title = `${name} - Set Icon Editor`;
}
