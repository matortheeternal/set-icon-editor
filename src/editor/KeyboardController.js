import { SHAPES } from './Shape.js';
import {
    HotkeyController,
    isSelectTarget,
    isTextTarget,
} from './hotkeys.js';

const STEP_MOVES = {
    ArrowLeft: [-1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowRight: [1, 0],
};

export class KeyboardController {
    constructor(controller, host) {
        this.controller = controller;
        this.host = host;
        this.hotkeys = new HotkeyController(host);
        for (const shape of SHAPES) {
            this.hotkeys.register(shape.shortcut, () => {
                this.controller.toggleTool(shape.type);
            }, { ignoreRepeat: true });
        }
        const once = { ignoreRepeat: true };
        this.hotkeys.register('p', () => this.togglePoints(), once);
        this.hotkeys.register('escape', (event) => this.handleEscape(event), {
            allowInText: true,
            allowInSelect: true,
        });
        const history = { allowInSelect: true };
        this.hotkeys.register('ctrl+z', () => this.history('undo'), history);
        this.hotkeys.register('ctrl+y', () => this.history('redo'), history);
        this.hotkeys.register('ctrl+shift+z', () => this.history('redo'), history);
        this.hotkeys.register('ctrl+o', () => this.menuBar()?.openPicker(), history);
        this.hotkeys.register('ctrl+s', () => this.saveShortcut(), history);
        this.hotkeys.register('ctrl+a', () => this.selectAll(), history);
        this.hotkeys.register('ctrl+c', () => this.copySelected(), history);
        this.hotkeys.register('ctrl+v', () => this.pasteClipboard(), history);
        this.hotkeys.register('ctrl+d', () => this.duplicateSelected(), history);
        this.hotkeys.register('ctrl+x', () => this.cutSelected(), history);
        this.hotkeys.register('delete', () => this.deleteSelected());
        this.hotkeys.register('backspace', () => this.deleteSelected());
        this.hotkeys.register('shift+s', () => this.toggleSmooth(), once);
        for (const [key, [dx, dy]] of Object.entries(STEP_MOVES)) {
            this.hotkeys.register(key, (event) => this.nudge(event, dx, dy));
            this.hotkeys.register(`shift+${key}`, (event) => {
                this.nudge(event, dx, dy);
            });
        }
    }

    get hasSelection() {
        return !this.controller.selection.isEmpty;
    }

    get isPointEditing() {
        return this.controller.state.pointEditingId != null;
    }

    togglePoints() {
        if (!this.hasSelection) return false;
        this.controller.togglePointEditing();
    }

    history(command) {
        this.controller.command({ command });
    }

    menuBar() {
        return this.host.querySelector?.('sei-menu-bar') ?? null;
    }

    saveShortcut() {
        const bar = this.menuBar();
        if (bar) bar.saveOrPrompt();
        else this.controller.command({ command: 'save-document' });
    }

    selectAll() {
        this.controller.command({ command: 'select-all' });
    }

    copySelected() {
        if (!this.hasSelection) return false;
        this.controller.command({ command: 'copy-selected' });
    }

    pasteClipboard() {
        this.controller.command({ command: 'paste' });
    }

    duplicateSelected() {
        if (!this.hasSelection) return false;
        this.controller.command({ command: 'duplicate-selected' });
    }

    cutSelected() {
        if (!this.hasSelection) return false;
        this.controller.command({ command: 'cut-selected' });
    }

    deleteSelected() {
        if (!this.hasSelection) return false;
        // Route through the command so point editing deletes points.
        this.controller.command({ command: 'delete-selected' });
    }

    toggleSmooth() {
        if (!this.isPointEditing) return false;
        this.controller.command({ command: 'toggle-point-smooth' });
    }

    handleEscape(event) {
        if (this.controller.deactivateTool()) return true;
        const editable = isTextTarget(event.target)
            || isSelectTarget(event.target);
        if (editable) return false;
        if (this.controller.exitPointEditing()) return true;
        if (!this.hasSelection) return false;
        this.controller.selectLayers([]);
        return true;
    }

    nudge(event, dx, dy) {
        if (!this.hasSelection || this.isPointEditing) return false;
        const distance = event.shiftKey ? 10 : 2;
        this.controller.nudgeSelected(dx * distance, dy * distance);
    }

    destroy() {
        this.hotkeys.destroy();
    }
}
