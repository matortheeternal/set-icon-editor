export function editorViewModels(state) {
    return {
        menubar: {
            canUndo: state.canUndo ?? false,
            canRedo: state.canRedo ?? false,
        },
        toolbox: state,
        layers: state,
    };
}
