import { localize } from '../../shared/localize.js';
import { EditorElement } from '../../shared/editorElement.js';
import { LAYER_MODES } from '../layerModes.js';
import { SHAPE_STYLE, shapeDisplayFor } from '../Shape.js';
import { rowSkeleton } from './layerRowTemplate.js';

const L = localize('editor');
let draggedIds = [];
let dropRow = null;

export class LayerRow extends EditorElement {
    connectedCallback() {
        this.render();
        this.update();
        this.bind();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        const id = this._state.id;
        draggedIds = draggedIds.filter((dragged) => dragged !== id);
        if (dropRow === this) dropRow = null;
    }

    get layerId() {
        return this._state.id;
    }

    get isSelected() {
        return this._state.selected === true;
    }

    get modeSelect() {
        return this.querySelector('select');
    }

    get nameElement() {
        return this.querySelector('.layer-details strong');
    }

    get previewElement() {
        return this.querySelector('.shape-preview');
    }

    render() {
        if (this.firstElementChild) return;
        this.innerHTML = rowSkeleton();
        const labels = [
            L`Overlap`,
            L`Merge`,
            L`Intersection`,
            L`Difference`,
        ];
        LAYER_MODES.forEach((mode, index) => {
            this.modeSelect.add(new Option(labels[index], mode));
        });
        this.draggable = true;
        this.tabIndex = 0;
        this.setAttribute('role', 'option');
    }

    update() {
        const { name = '', mode = 'overlap' } = this._state;
        const selected = this.isSelected;
        this.setAttribute('aria-selected', String(selected));
        const hint = L`Select or drag to reorder ${name}`;
        this.setAttribute('aria-label', hint);
        this.nameElement.textContent = L`${name}`;
        this.modeSelect.value = mode;
        const modeHint = L`${name} layer mode`;
        this.modeSelect.setAttribute('aria-label', modeHint);
        this.modeSelect.title = L`Combine this layer with the geometry beneath it`;
        const shape = shapeDisplayFor(this._state.shapeType);
        this.previewElement.innerHTML = shape.preview;
        this.previewElement.style.color = this._state.color ?? SHAPE_STYLE.fillColor;
    }

    bind() {
        this.resetListeners();
        this.on('click', (event) => this.onClick(event));
        this.on('keydown', (event) => this.onKeydown(event));
        this.on('change', (event) => this.onChange(event));
        this.on('dragstart', (event) => this.onDragStart(event));
        this.on('dragover', (event) => this.onDragOver(event));
        this.on('dragleave', (event) => this.onDragLeave(event));
        this.on('drop', (event) => this.onDrop(event));
        this.on('dragend', () => this.onDragEnd());
    }

    onClick(event) {
        if (event.target.closest('select')) return;
        const extend = event.ctrlKey || event.metaKey;
        const range = event.shiftKey;
        const detail = { command: 'select-layer', ids: [this.layerId] };
        this.emit({ ...detail, extend, range });
    }

    onKeydown(event) {
        const activating = ['Enter', ' '].includes(event.key);
        if (event.target !== this || !activating) return;
        event.preventDefault();
        this.emit({ command: 'select-layer', ids: [this.layerId] });
    }

    onChange(event) {
        if (!event.target.matches('select')) return;
        this.emit({
            command: 'set-layer-mode',
            ids: [this.layerId],
            mode: event.target.value,
        });
    }

    onDragStart(event) {
        if (event.target.closest('select')) return event.preventDefault();
        draggedIds = [this.layerId];
        const data = event.dataTransfer;
        data?.setData('text/plain', String(this.layerId));
        if (data) data.effectAllowed = 'move';
        this.classList.add('is-dragging');
        this.emitDrag('start', draggedIds);
    }

    onDragOver(event) {
        const self = draggedIds.includes(this.layerId);
        if (!draggedIds.length || self) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        this.showPlacement(this.placement(event));
    }

    onDrop(event) {
        const self = draggedIds.includes(this.layerId);
        if (!draggedIds.length || self) return;
        event.preventDefault();
        event.stopPropagation();
        this.emit({
            command: 'drop',
            ids: [...draggedIds],
            targetId: this.layerId,
            placement: this.placement(event),
        });
        this.clearPlacement();
    }

    onDragEnd() {
        draggedIds = [];
        this.classList.remove('is-dragging');
        dropRow?.clearPlacement();
        this.emitDrag('end', [this.layerId]);
    }

    onDragLeave(event) {
        if (!this.contains(event.relatedTarget)) this.clearPlacement();
    }

    placement(event) {
        const bounds = this.getBoundingClientRect();
        const middle = bounds.top + bounds.height / 2;
        return event.clientY < middle ? 'before' : 'after';
    }

    showPlacement(placement) {
        if (dropRow !== this) dropRow?.clearPlacement();
        dropRow = this;
        const before = placement === 'before';
        const after = placement === 'after';
        this.classList.toggle('is-drop-before', before);
        this.classList.toggle('is-drop-after', after);
    }

    clearPlacement() {
        this.classList.remove('is-drop-before', 'is-drop-after');
        if (dropRow === this) dropRow = null;
    }

    emitDrag(phase, ids) {
        this.dispatchEvent(new CustomEvent('sei-layer-drag', {
            bubbles: true,
            detail: { phase, ids: [...ids] },
        }));
    }
}

customElements.define('sei-layer-row', LayerRow);
