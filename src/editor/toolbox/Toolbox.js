import { localize } from '../../shared/localize.js';
import { EditorElement } from '../../shared/editorElement.js';
import { SHAPES } from '../Shape.js';

const L = localize('editor');

export class Toolbox extends EditorElement {
    connectedCallback() {
        this.render();
        this.update();
        this.bind();
    }

    render() {
        if (this.firstElementChild) return;
        this.innerHTML = `
            <h2>${L`Draw shape`}</h2>
            <div class="shape-tools"></div>
            <label class="point-count-field">
                <span>${L`Points / spokes`}</span>
                <input class="point-count" type="number" min="3" max="32"
                    step="1" inputmode="numeric">
            </label>
            <section class="geometry-tools">
                <h2>${L`Edit Geometry`}</h2>
                <button data-action="editPoints" type="button"></button>
                <div class="point-tools" hidden>
                    <button data-action="smoothPoint" type="button"></button>
                    <button data-action="deletePoint" type="button"></button>
                    <p class="point-hint"></p>
                </div>
            </section>
            <section class="transform-tools">
                <h2>${L`Transform`}</h2>
                <div class="reflect-tools">
                    <button data-action="reflectHorizontal" type="button"></button>
                    <button data-action="reflectVertical" type="button"></button>
                </div>
            </section>
        `;
        for (const shape of SHAPES) {
            this.shapeTools.append(this.createShapeTool(shape));
        }
    }

    get shapeTools() {
        return this.querySelector('.shape-tools');
    }

    get pointCountInput() {
        return this.querySelector('.point-count');
    }

    get pointTools() {
        return this.querySelector('.point-tools');
    }

    get pointHint() {
        return this.querySelector('.point-hint');
    }

    actionButton(action) {
        return this.querySelector(`[data-action="${action}"]`);
    }

    createShapeTool(shape) {
        const button = document.createElement('button');
        const label = document.createElement('span');
        const caption = shape.label(L);
        button.type = 'button';
        button.className = 'shape-tool';
        button.dataset.tool = shape.type;
        button.setAttribute('aria-label', L`Draw ${caption.toLowerCase()}`);
        button.innerHTML = shape.preview;
        label.textContent = caption;
        button.append(label);
        return button;
    }

    update() {
        const { activeTool = null } = this._state;
        const { pointCount = 6 } = this._state;
        const { canEditPoints = false } = this._state;
        const { isEditingPoints = false } = this._state;
        for (const shape of SHAPES) {
            const selector = `[data-tool="${shape.type}"]`;
            const pressed = String(shape.type === activeTool);
            this.shapeTools.querySelector(selector).setAttribute(
                'aria-pressed',
                pressed,
            );
        }
        const nextCount = String(pointCount);
        const countInput = this.pointCountInput;
        if (countInput.value !== nextCount) countInput.value = nextCount;
        const editLabel = isEditingPoints
            ? L`Finish editing points`
            : L`Edit points`;
        const editPoints = this.actionButton('editPoints');
        editPoints.textContent = editLabel;
        editPoints.setAttribute('aria-label', editLabel);
        const pressed = String(isEditingPoints);
        editPoints.setAttribute('aria-pressed', pressed);
        editPoints.disabled = !canEditPoints;
        this.updatePointTools();
        this.updateReflectTools();
    }

    updateReflectTools() {
        const { canReflect = false } = this._state;
        const horizontalLabel = L`Reflect horizontal`;
        const horizontal = this.actionButton('reflectHorizontal');
        horizontal.textContent = horizontalLabel;
        horizontal.setAttribute('aria-label', horizontalLabel);
        horizontal.disabled = !canReflect;
        const verticalLabel = L`Reflect vertical`;
        const vertical = this.actionButton('reflectVertical');
        vertical.textContent = verticalLabel;
        vertical.setAttribute('aria-label', verticalLabel);
        vertical.disabled = !canReflect;
    }

    updatePointTools() {
        const { isEditingPoints = false } = this._state;
        const { selectedPointCount = 0 } = this._state;
        const { canDeletePoints = false } = this._state;
        const smoothLabel = L`Smooth / sharpen`;
        const deleteLabel = L`Delete points`;
        const smooth = this.actionButton('smoothPoint');
        const remove = this.actionButton('deletePoint');
        smooth.textContent = smoothLabel;
        smooth.setAttribute('aria-label', smoothLabel);
        remove.textContent = deleteLabel;
        remove.setAttribute('aria-label', deleteLabel);
        this.pointHint.textContent = L`Double-click a curve to add a point. Shift-click selects more. Delete removes.`;
        this.pointTools.hidden = !isEditingPoints;
        if (!isEditingPoints) return;
        smooth.disabled = selectedPointCount === 0;
        remove.disabled = !canDeletePoints;
    }

    bind() {
        this.resetListeners();
        this.on('click', (event) => this.onClick(event));
        this.on('change', (event) => this.onPointCount(event));
    }

    onClick(event) {
        const toolButton = event.target.closest('button[data-tool]');
        if (toolButton) {
            return this.emit({
                command: 'select-tool',
                tool: toolButton.dataset.tool,
            });
        }
        const action = event.target.closest('[data-action]')?.dataset.action;
        const commands = {
            editPoints: 'toggle-point-editing',
            reflectHorizontal: 'reflect-horizontal',
            reflectVertical: 'reflect-vertical',
            smoothPoint: 'toggle-point-smooth',
            deletePoint: 'delete-points',
        };
        if (commands[action]) return this.emit({ command: commands[action] });
    }

    onPointCount(event) {
        if (!event.target.matches('.point-count')) return;
        const pointCount = Number(event.target.value);
        if (!Number.isFinite(pointCount)) return;
        this.emit({ command: 'set-point-count', pointCount });
    }
}

customElements.define('sei-toolbox', Toolbox);
