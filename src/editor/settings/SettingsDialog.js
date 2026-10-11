import { localize } from '../../shared/localize.js';
import { EditorElement } from '../../shared/editorElement.js';
import {
    defaultSettings,
    normalizeSettings,
} from '../../shared/settings.js';

const L = localize('editor');

const COLOR_FIELDS = [
    ['gridColor', 'Grid color'],
    ['shapeFill', 'Default shape fill'],
    ['shapeStroke', 'Default shape stroke'],
    ['handleColor', 'Handle color'],
    ['selectionColor', 'Selection line color'],
];

export class SettingsDialog extends EditorElement {
    connectedCallback() {
        this.render();
        this.bind();
    }

    show(settings) {
        this.setForm(normalizeSettings(settings));
        this.dialog.show();
    }

    render() {
        if (this.firstElementChild) return;
        const dialog = document.createElement('sl-dialog');
        dialog.setAttribute('label', L`Settings`);
        dialog.classList.add('settings-dialog');
        dialog.innerHTML = `
            <div class="settings-form">
                <section>
                    <h3>${L`Appearance`}</h3>
                    <div class="appearance-settings">
                        <sl-select class="theme-select">
                            <sl-option value="auto">${L`System`}</sl-option>
                            <sl-option value="light">${L`Light`}</sl-option>
                            <sl-option value="dark">${L`Dark`}</sl-option>
                        </sl-select>
                        <sl-switch class="show-grid"></sl-switch>
                    </div>
                </section>
                <section>
                    <h3>${L`Canvas colors`}</h3>
                    <div class="color-settings"></div>
                </section>
            </div>
            <sl-button slot="footer" data-action="resetSettings"></sl-button>
            <sl-button slot="footer" data-action="cancelSettings"></sl-button>
            <sl-button slot="footer" data-action="saveSettings"
                variant="primary"></sl-button>
        `;

        const colors = dialog.querySelector('.color-settings');
        for (const [field, caption] of COLOR_FIELDS) {
            const label = document.createElement('label');
            const text = document.createElement('span');
            const picker = document.createElement('sl-color-picker');
            text.textContent = L([caption]);
            picker.dataset.field = field;
            picker.setAttribute('format', 'hex');
            label.append(text, picker);
            colors.appendChild(label);
        }

        this.appendChild(dialog);
        this.themeSelect.setAttribute('label', L`Theme`);
        this.showGrid.textContent = L`Show grid`;
        this.actionButton('resetSettings').textContent = L`Reset defaults`;
        this.actionButton('cancelSettings').textContent = L`Cancel`;
        this.actionButton('saveSettings').textContent = L`Save settings`;
    }

    get dialog() {
        return this.querySelector('.settings-dialog');
    }

    get themeSelect() {
        return this.querySelector('.theme-select');
    }

    get showGrid() {
        return this.querySelector('.show-grid');
    }

    get colors() {
        return this.querySelector('.color-settings');
    }

    actionButton(action) {
        return this.querySelector(`[data-action="${action}"]`);
    }

    bind() {
        this.resetListeners();
        this.on('click', (event) => this.onAction(event));
    }

    onAction(event) {
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (action === 'resetSettings') this.setForm(defaultSettings());
        if (action === 'cancelSettings') this.dialog.hide();
        if (action === 'saveSettings') this.save();
    }

    setForm(settings) {
        this.themeSelect.value = settings.theme;
        this.showGrid.checked = settings.showGrid;
        for (const [field] of COLOR_FIELDS) {
            const picker = this.colors.querySelector(`[data-field="${field}"]`);
            picker.value = settings[field];
        }
    }

    save() {
        const settings = {
            theme: this.themeSelect.value,
            showGrid: this.showGrid.checked,
        };
        for (const [field] of COLOR_FIELDS) {
            settings[field] = this.colors
                .querySelector(`[data-field="${field}"]`).value;
        }
        this.emit({ command: 'apply-settings', settings });
        this.dialog.hide();
    }
}

customElements.define('sei-settings-dialog', SettingsDialog);
