import paper from 'paper';
import { EditorElement } from '../shared/editorElement.js';
import { getBootOptions, setBootOptions } from '../shared/environment.js';
import {
    applyVisualSettings,
    loadSettings,
    normalizeSettings,
    saveSettings,
} from '../shared/settings.js';
import { initializeTheme } from '../shared/theme.js';
import { EditorController } from './EditorController.js';
import { KeyboardController } from './KeyboardController.js';
import { SHAPE_STYLE } from './Shape.js';
import { editorViewModels } from './viewModels.js';
import { HANDLE_THEME } from './canvas/selectionOverlays.js';
import './canvas/EditorCanvas.js';
import './layers/Layers.js';
import './menu-bar/MenuBar.js';
import './preview/PreviewDialog.js';
import './settings/SettingsDialog.js';
import './toolbox/Toolbox.js';

export class Editor extends EditorElement {
    settings = loadSettings();
    stopThemeWatch = null;

    connectedCallback() {
        if (this.editor) return;
        this.render();
        this.resetListeners();
        if (!this.hasAttribute('tabindex')) this.tabIndex = -1;
        this.addEventListener('pointerdown', (event) => this.claimKeyboard(event), {
            capture: true, signal: this.signal,
        });
        this.on('sei-command', (event) => this.routeCommand(event.detail));
        this.on('canvas-display-scale', (event) => {
            const { width, height, scale } = event.detail;
            this.editor?.resizeViewport(width, height, scale);
        });
        this.settings = {
            ...this.settings,
            theme: getBootOptions().theme,
        };
        this.applySettings(this.settings, { persist: false, refresh: false });
        this.startController();
        if (document.activeElement === document.body) this.focus({ preventScroll: true });
    }

    render() {
        this.innerHTML = `
            <sei-menu-bar></sei-menu-bar>
            <main>
                <sei-toolbox></sei-toolbox>
                <sei-canvas></sei-canvas>
                <sei-layers></sei-layers>
            </main>
            <sei-preview-dialog></sei-preview-dialog>
            <sei-settings-dialog></sei-settings-dialog>
        `;
    }

    get menuBar() {
        return this.querySelector('sei-menu-bar');
    }

    get toolbox() {
        return this.querySelector('sei-toolbox');
    }

    get canvasView() {
        return this.querySelector('sei-canvas');
    }

    get layersView() {
        return this.querySelector('sei-layers');
    }

    get previewDialog() {
        return this.querySelector('sei-preview-dialog');
    }

    get settingsDialog() {
        return this.querySelector('sei-settings-dialog');
    }

    routeCommand(detail) {
        if (detail?.command === 'open-preview') return this.openPreview();
        if (detail?.command === 'open-settings') {
            return this.settingsDialog.show(this.settings);
        }
        if (detail?.command === 'apply-settings') {
            return this.applySettings(detail.settings);
        }
        if (detail?.command === 'set-theme') {
            return this.applySettings({
                ...this.settings,
                theme: detail.theme,
            });
        }
        this.editor.command(detail);
    }

    openPreview() {
        const svg = this.editor.previewSvg();
        if (svg) this.previewDialog.show(svg);
    }

    applySettings(settings, { persist = true, refresh = true } = {}) {
        const normalized = persist
            ? saveSettings(settings)
            : normalizeSettings(settings);
        this.settings = applyVisualSettings(normalized, {
            shapeStyle: SHAPE_STYLE,
            handleTheme: HANDLE_THEME,
        });
        this.canvasView.configure(this.settings);
        setBootOptions({ ...getBootOptions(), theme: this.settings.theme });
        this.stopThemeWatch?.();
        this.stopThemeWatch = initializeTheme({
            preference: this.settings.theme,
        });
        this.menuBar.updateThemeItems();
        if (refresh) this.editor?.refresh();
        return this.settings;
    }

    startController() {
        this.editor = new EditorController({
            paperLibrary: paper,
            canvas: this.canvasView.canvas,
            onStateChange: (state) => this.distribute(state),
        });
        const metrics = this.canvasView.displayMetrics;
        if (metrics) {
            this.editor.resizeViewport(
                metrics.width,
                metrics.height,
                metrics.scale,
            );
        }
        this.keyboard = new KeyboardController(this.editor, this);
    }

    get controller() {
        return this.editor;
    }

    claimKeyboard(event) {
        const form = [
            'button', 'input', 'select', 'textarea',
            'sl-input', 'sl-textarea', 'sl-select',
            'sl-color-picker', 'sl-switch',
        ].join(', ');
        if (!event.target.closest?.(form)) {
            this.focus({ preventScroll: true });
        }
    }

    distribute(state) {
        this.update(state);
    }

    update(state) {
        const views = editorViewModels(state);
        this.menuBar.state = views.menubar;
        this.toolbox.state = views.toolbox;
        this.layersView.state = views.layers;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.keyboard?.destroy();
        this.editor?.destroy();
        this.stopThemeWatch?.();
        this.stopThemeWatch = null;
        this.keyboard = null;
        this.editor = null;
    }
}

customElements.define('sei-app', Editor);
