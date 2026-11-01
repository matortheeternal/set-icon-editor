import { localize } from '../../shared/localize.js';
import { EditorElement } from '../../shared/editorElement.js';
import { getBootOptions, setBootOptions } from '../../shared/environment.js';
import { normalizeThemePreference } from '../../shared/theme.js';
import { setWindowTitle } from '../../shared/windowTitle.js';
import { requestNativeSavePath } from '../../shared/saveFile.js';

const L = localize('editor');

export class MenuBar extends EditorElement {
    itemElements = new Map();

    connectedCallback() {
        this.render();
        this.update();
        this.bind();
    }

    fileItems() {
        return [
            { command: 'new-document', label: L`New`, shortcut: '' },
            { action: 'open-picker', label: L`Open…`, shortcut: 'Ctrl+O' },
            { action: 'save', label: L`Save`, shortcut: 'Ctrl+S' },
            { action: 'save-as', label: L`Save As…`, shortcut: '' },
        ];
    }

    editItems() {
        const { canUndo = false, canRedo = false } = this._state;
        const undo = { command: 'undo', label: L`Undo`, shortcut: 'Ctrl+Z' };
        const redo = { command: 'redo', label: L`Redo`, shortcut: 'Ctrl+Shift+Z' };
        return [
            { ...undo, disabled: !canUndo },
            { ...redo, disabled: !canRedo },
            { divider: true },
            { command: 'cut-selected', label: L`Cut`, shortcut: 'Ctrl+X' },
            { command: 'copy-selected', label: L`Copy`, shortcut: 'Ctrl+C' },
            { command: 'paste', label: L`Paste`, shortcut: 'Ctrl+V' },
            { command: 'duplicate-selected', label: L`Duplicate`, shortcut: 'Ctrl+D' },
            { divider: true },
            { command: 'delete-selected', label: L`Delete`, shortcut: 'Del' },
            { command: 'select-all', label: L`Select All`, shortcut: 'Ctrl+A' },
            { divider: true },
            { action: 'settings', label: L`Settings…`, shortcut: '' },
        ];
    }

    menus() {
        return [
            { title: L`File`, items: this.fileItems() },
            { title: L`Edit`, items: this.editItems() },
            { title: L`View`, items: this.viewItems() },
        ];
    }

    viewItems() {
        return [
            { action: 'preview', label: L`Preview…`, shortcut: '' },
            { divider: true },
            ...this.themeItems(),
        ];
    }

    themeItems() {
        const preference = normalizeThemePreference(getBootOptions().theme);
        const mark = (mode) => (mode === preference ? '✓ ' : '');
        return [
            { theme: 'auto', label: `${mark('auto')}${L`System`}` },
            { theme: 'light', label: `${mark('light')}${L`Light`}` },
            { theme: 'dark', label: `${mark('dark')}${L`Dark`}` },
        ];
    }

    render() {
        if (this.firstElementChild) return;
        this.innerHTML = '<input class="file-picker" type="file" hidden>';
        this.picker.setAttribute('accept', '.svg,image/svg+xml');
        this.append(this.renderSaveDialog());
        for (const menu of this.menus()) {
            this.appendChild(this.renderDropdown(menu));
        }
    }

    get picker() {
        return this.querySelector('.file-picker');
    }

    get saveDialog() {
        return this.querySelector('.save-dialog');
    }

    get savePath() {
        return this.querySelector('.save-path');
    }

    renderSaveDialog() {
        const dialog = document.createElement('sl-dialog');
        dialog.setAttribute('label', L`Save As`);
        dialog.classList.add('save-dialog');
        dialog.innerHTML = `
            <sl-input class="save-path"></sl-input>
            <sl-button slot="footer" data-action="cancelSave"></sl-button>
            <sl-button slot="footer" variant="primary"
                data-action="confirmSave"></sl-button>
        `;
        dialog.querySelector('.save-path').setAttribute('label', L`File path`);
        dialog.querySelector('[data-action="cancelSave"]').textContent = L`Cancel`;
        dialog.querySelector('[data-action="confirmSave"]').textContent = L`Save`;
        return dialog;
    }

    renderDropdown(menu) {
        const dropdown = document.createElement('sl-dropdown');
        const trigger = document.createElement('sl-button');
        trigger.slot = 'trigger';
        trigger.variant = 'text';
        trigger.textContent = menu.title;
        dropdown.appendChild(trigger);
        const list = document.createElement('sl-menu');
        for (const item of menu.items) {
            list.appendChild(this.renderItem(item, dropdown));
        }
        dropdown.appendChild(list);
        return dropdown;
    }

    renderItem(item, dropdown) {
        if (item.divider) {
            const divider = document.createElement('sl-divider');
            divider.style.setProperty('--spacing', '0.5rem');
            return divider;
        }
        const element = document.createElement('sl-menu-item');
        element.disabled = item.disabled ?? false;
        const row = document.createElement('div');
        const label = document.createElement('div');
        const shortcut = document.createElement('div');
        row.className = 'menu-item';
        label.className = 'menu-label';
        label.textContent = item.label;
        shortcut.textContent = item.shortcut ?? '';
        row.append(label, shortcut);
        element.append(row);
        element.addEventListener('click', () => {
            dropdown.hide();
            this.activate(item);
        });
        const key = item.command ?? item.action
            ?? (item.theme ? `theme:${item.theme}` : null);
        if (key) this.itemElements.set(key, element);
        return element;
    }

    updateThemeItems() {
        const labels = new Map(
            this.themeItems().map((item) => [`theme:${item.theme}`, item.label]),
        );
        for (const [key, label] of labels) {
            const labelCell = this.itemElements.get(key)?.querySelector('.menu-label');
            if (labelCell) labelCell.textContent = label;
        }
    }

    update() {
        const { canUndo = false, canRedo = false } = this._state;
        this.itemElements.get('undo').disabled = !canUndo;
        this.itemElements.get('redo').disabled = !canRedo;
    }

    bind() {
        this.resetListeners();
        this.on('change', (event) => this.pickFile(event), this.picker);
        this.on('click', (event) => this.onDialogAction(event));
    }

    onDialogAction(event) {
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (action === 'confirmSave') this.confirmSaveDialog();
        if (action === 'cancelSave') this.saveDialog.hide();
    }

    activate(item) {
        if (item.command === 'new-document') {
            setWindowTitle('Untitled Icon');
        }
        if (item.theme) return this.setTheme(item.theme);
        if (item.command) return this.emit({ command: item.command });
        if (item.action === 'open-picker') return this.openPicker();
        if (item.action === 'preview') return this.emit({ command: 'open-preview' });
        if (item.action === 'settings') return this.emit({ command: 'open-settings' });
        if (item.action === 'save') return this.saveOrPrompt();
        if (item.action === 'save-as') return this.openSaveDialog();
    }

    setTheme(preference) {
        const normalized = normalizeThemePreference(preference);
        this.emit({ command: 'set-theme', theme: normalized });
    }

    openPicker() {
        this.picker.click();
    }

    async pickFile(event) {
        const [file] = event.target.files ?? [];
        event.target.value = '';
        if (!file) return;
        this.emit({
            command: 'open-document',
            svgText: await file.text(),
            filename: file.name,
        });
    }

    saveOrPrompt() {
        if (getBootOptions().filename) {
            this.emit({ command: 'save-document' });
        } else {
            this.openSaveDialog();
        }
    }

    async openSaveDialog() {
        const fallback = getBootOptions().filename ?? 'untitled-icon.svg';
        const picked = await requestNativeSavePath(fallback);
        if (picked) {
            setBootOptions({ ...getBootOptions(), filename: picked });
            setWindowTitle(picked);
            this.emit({ command: 'save-document' });
            return;
        }
        if (picked === undefined) {
            this.savePath.value = fallback;
            this.saveDialog.show();
        }
    }

    confirmSaveDialog() {
        const path = this.savePath.value.trim();
        const output = path || 'untitled-icon.svg';
        setBootOptions({ ...getBootOptions(), filename: output });
        setWindowTitle(output);
        this.saveDialog.hide();
        this.emit({ command: 'save-document' });
    }
}

customElements.define('sei-menu-bar', MenuBar);
