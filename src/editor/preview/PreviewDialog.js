import { localize } from '../../shared/localize.js';
import { EditorElement } from '../../shared/editorElement.js';
import {
    allRarities,
    deleteCustomRarity,
    findRarity,
    saveCustomRarity,
} from './rarityPresets.js';
import { renderSetSymbol } from './renderSetSymbol.js';

const L = localize('editor');

const COLOR_FIELDS = ['g1', 'g2', 'g3', 'g4', 'outline'];

export class PreviewDialog extends EditorElement {
    sourceSvg = '';
    activeId = 'common';

    connectedCallback() {
        this.render();
        this.bind();
    }

    show(svgText) {
        this.sourceSvg = svgText ?? '';
        this.refreshOptions();
        this.renderPreview();
        this.dialog.show();
    }

    render() {
        if (this.firstElementChild) return;
        const dialog = document.createElement('sl-dialog');
        dialog.setAttribute('label', L`Preview`);
        dialog.classList.add('preview-dialog');
        dialog.innerHTML = `
            <sl-select class="preset-select"></sl-select>
            <div class="preview"></div>
            <details class="preset-form">
                <summary>${L`Add preset…`}</summary>
                <sl-input class="preset-name"></sl-input>
                <div class="preset-colors"></div>
                <sl-button data-action="addPreset" variant="primary"></sl-button>
            </details>
            <div class="custom-presets"></div>
        `;
        const colors = dialog.querySelector('.preset-colors');
        for (const field of COLOR_FIELDS) {
            const label = document.createElement('label');
            const caption = document.createElement('span');
            caption.textContent = field === 'outline' ? L`Outline` : L`Gradient ${field.slice(1)}`;
            const picker = document.createElement('sl-color-picker');
            picker.dataset.field = field;
            picker.setAttribute('value', field === 'outline' ? '#ffffff' : '#000000');
            picker.setAttribute('format', 'hex');
            label.append(caption, picker);
            colors.appendChild(label);
        }
        this.appendChild(dialog);
        this.presetSelect.setAttribute('label', L`Rarity`);
        this.presetName.setAttribute('label', L`Preset name`);
        this.presetName.setAttribute('placeholder', L`My foil`);
        this.actionButton('addPreset').textContent = L`Add preset`;
    }

    get dialog() {
        return this.querySelector('.preview-dialog');
    }

    get presetSelect() {
        return this.querySelector('.preset-select');
    }

    get preview() {
        return this.querySelector('.preview');
    }

    get presetForm() {
        return this.querySelector('.preset-form');
    }

    get presetName() {
        return this.querySelector('.preset-name');
    }

    get customPresets() {
        return this.querySelector('.custom-presets');
    }

    actionButton(action) {
        return this.querySelector(`[data-action="${action}"]`);
    }

    bind() {
        this.resetListeners();
        this.on('sl-change', () => this.onPresetChange(), this.presetSelect);
        this.on('click', (event) => this.onAction(event));
    }

    refreshOptions() {
        const rarities = allRarities();
        const options = rarities.map((entry) => {
            const option = document.createElement('sl-option');
            option.value = entry.id;
            option.textContent = entry.name;
            return option;
        });
        this.presetSelect.replaceChildren(...options);
        if (!rarities.some((entry) => entry.id === this.activeId)) {
            this.activeId = 'common';
        }
        this.presetSelect.value = this.activeId;
        this.refreshCustoms(allRarities());
    }

    refreshCustoms(rarities) {
        const customs = rarities.filter((entry) => entry.custom);
        const rows = customs.map((entry) => {
            const row = document.createElement('div');
            const name = document.createElement('span');
            const button = document.createElement('button');
            row.className = 'custom-preset';
            name.textContent = entry.name;
            button.type = 'button';
            button.dataset.action = 'deletePreset';
            button.dataset.id = entry.id;
            button.textContent = L`Delete`;
            row.append(name, button);
            return row;
        });
        this.customPresets.replaceChildren(...rows);
    }

    renderPreview() {
        const preset = findRarity(this.activeId);
        this.preview.innerHTML = renderSetSymbol(this.sourceSvg, preset);
    }

    onPresetChange() {
        this.activeId = this.presetSelect.value ?? 'common';
        this.renderPreview();
    }

    onAdd() {
        const colors = {};
        for (const field of COLOR_FIELDS) {
            const picker = this.presetForm.querySelector(`[data-field="${field}"]`);
            colors[field] = picker?.value ?? '#000000';
        }
        const [saved] = saveCustomRarity({
            name: this.presetName.value,
            ...colors,
        }).filter((entry) => entry.custom).slice(-1);
        this.activeId = saved?.id ?? this.activeId;
        this.presetName.value = '';
        this.presetForm.open = false;
        this.refreshOptions();
        this.renderPreview();
    }

    onAction(event) {
        const button = event.target.closest('[data-action]');
        if (button?.dataset.action === 'addPreset') return this.onAdd();
        if (button?.dataset.action !== 'deletePreset') return;
        deleteCustomRarity(button.dataset.id);
        if (this.activeId === button.dataset.id) this.activeId = 'common';
        this.refreshOptions();
        this.renderPreview();
    }
}

customElements.define('sei-preview-dialog', PreviewDialog);
