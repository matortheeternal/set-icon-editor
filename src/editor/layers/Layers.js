import { localize } from '../../shared/localize.js';
import { EditorElement } from '../../shared/editorElement.js';
import '../layer-row/LayerRow.js';

const L = localize('editor');

export class Layers extends EditorElement {
    rows = new Map();
    draggedIds = [];

    get hasDrag() {
        return this.draggedIds.length > 0;
    }

    get deleteButton() {
        return this.querySelector('[data-action="deleteLayers"]');
    }

    get list() {
        return this.querySelector('.layer-list');
    }

    connectedCallback() {
        this.render();
        this.update();
        this.bind();
    }

    render() {
        if (this.firstElementChild) return;
        this.innerHTML = `
            <header>
                <h2>${L`Layers`}</h2>
                <button type="button" data-action="deleteLayers"></button>
            </header>
            <div class="layer-list" role="list"></div>
        `;
    }

    update() {
        const { layers = [], selectedIds = [] } = this._state;
        const ids = new Set(selectedIds);
        const remove = this.deleteButton;
        remove.textContent = L`Delete`;
        const label = ids.size > 1
            ? L`Delete selected layers`
            : L`Delete selected layer`;
        remove.setAttribute('aria-label', label);
        remove.disabled = ids.size === 0;
        this.syncRows(layers, ids);
        this.syncEmpty(layers.length);
    }

    syncRows(layers, selectedIds) {
        const liveIds = new Set(layers.map(({ id }) => id));
        for (const [id, row] of this.rows) {
            if (!liveIds.has(id)) {
                row.remove();
                this.rows.delete(id);
            }
        }
        for (const layer of layers) {
            const row = this.ensureRow(layer.id);
            const selected = selectedIds.has(layer.id);
            row.state = { ...layer, selected };
            this.list.append(row);
        }
    }

    ensureRow(id) {
        if (!this.rows.has(id)) {
            const row = document.createElement('sei-layer-row');
            this.rows.set(id, row);
        }
        return this.rows.get(id);
    }

    syncEmpty(count) {
        this.querySelector('.empty-message')?.remove();
        if (count) return;
        const empty = document.createElement('p');
        empty.className = 'empty-message';
        empty.textContent = L`No layers`;
        this.list.append(empty);
    }

    bind() {
        this.resetListeners();
        this.on('click', (event) => this.onClick(event));
        this.on('sei-layer-drag', (event) => this.trackDrag(event));
        const list = this.list;
        this.on('dragover', (event) => this.onListDragOver(event), list);
        this.on('drop', (event) => this.onListDrop(event), list);
    }

    onClick(event) {
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (action === 'deleteLayers') this.emit({ command: 'delete-selected' });
    }

    trackDrag(event) {
        if (event.detail.phase === 'start') {
            this.draggedIds = [...event.detail.ids];
        }
        if (event.detail.phase === 'end') this.draggedIds = [];
    }

    onListDragOver(event) {
        const foreign = event.target !== event.currentTarget;
        if (!this.hasDrag || foreign) return;
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = 'move';
        }
    }

    onListDrop(event) {
        const foreign = event.target !== event.currentTarget;
        if (!this.hasDrag || foreign) return;
        event.preventDefault();
        this.emit({ command: 'drop-bottom', ids: [...this.draggedIds] });
        this.draggedIds = [];
    }
}

customElements.define('sei-layers', Layers);
