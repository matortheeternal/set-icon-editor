import { localize } from '../../shared/localize.js';
import { EditorElement, emit } from '../../shared/editorElement.js';
import {
    canvasOpacityMask,
    DEFAULT_DOCUMENT_SIZE,
    fitDocumentScale,
    gridBackgroundImage,
    gridVisualColors,
    MAX_ARTBOARD_DISPLAY_SIZE,
} from './documentSize.js';

const L = localize('editor');
const ARTBOARD_BORDER_SIZE = 2;
const ARTBOARD_OUTER_SIZE = DEFAULT_DOCUMENT_SIZE + ARTBOARD_BORDER_SIZE;

export class EditorCanvas extends EditorElement {
    observer;
    displayMetrics = null;
    resizeQueued = false;
    pendingResizeEntry = null;

    get canvas() {
        return this.querySelector('canvas');
    }

    get stage() {
        return this.querySelector('.stage');
    }

    get artboard() {
        return this.querySelector('.artboard');
    }

    connectedCallback() {
        this.render();
        this.observeViewportSize();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.observer?.disconnect();
        this.observer = undefined;
    }

    render() {
        if (this.firstElementChild) return;
        this.innerHTML = `
            <div class="stage">
                <div class="artboard"></div>
            </div>
            <canvas width="${DEFAULT_DOCUMENT_SIZE}"
                height="${DEFAULT_DOCUMENT_SIZE}"></canvas>
        `;
        this.configure();
        this.setCanvasScale(1);
        this.setAttribute('aria-label', L`Drawing workspace`);
        const canvasHint = L`SVG shape canvas`;
        this.canvas.setAttribute('aria-label', canvasHint);
    }

    configure({ gridColor, showGrid = true } = {}) {
        if (!this.artboard) return;
        const colors = gridVisualColors(gridColor);
        this.artboardGrid = showGrid
            ? gridBackgroundImage(undefined, undefined, colors.line)
            : 'none';
        this.artboard.style.setProperty('--grid-border', colors.border);
        this.artboard.style.setProperty('--grid-shade', colors.shade);
        this.artboard.style.backgroundImage = this.artboardGrid;
    }

    observeViewportSize() {
        this.observer?.disconnect();
        if (!globalThis.ResizeObserver) {
            const message = 'ResizeObserver unavailable: no auto-resize.';
            console.warn(message);
            return;
        }
        const onResize = (entries) => this.onResize(entries);
        this.observer = new ResizeObserver(onResize);
        this.observer.observe(this);
    }

    onResize(entries) {
        this.pendingResizeEntry = entries.at(-1);
        if (this.resizeQueued) return;
        this.resizeQueued = true;
        requestAnimationFrame(() => {
            this.resizeQueued = false;
            this.fitCanvas(this.pendingResizeEntry);
            this.pendingResizeEntry = null;
        });
    }

    fitCanvas(entry) {
        if (!entry) return;
        const { width, height } = entry.contentRect;
        this.setCanvasScale(fitDocumentScale(
            width,
            height,
            ARTBOARD_OUTER_SIZE,
            MAX_ARTBOARD_DISPLAY_SIZE * ARTBOARD_OUTER_SIZE
                / DEFAULT_DOCUMENT_SIZE,
        ), width, height);
    }

    setCanvasScale(scale, viewportWidth = 0, viewportHeight = 0) {
        if (!this.stage || !this.artboard) return;
        const safeScale = Math.max(1 / ARTBOARD_OUTER_SIZE, Number(scale) || 1);
        const displaySize = ARTBOARD_OUTER_SIZE * safeScale;
        this.stage.style.width = `${displaySize}px`;
        this.stage.style.height = `${displaySize}px`;
        this.artboard.style.transform = `scale(${safeScale})`;

        const rect = this.getBoundingClientRect?.();
        const width = rect?.width || Number(viewportWidth) || 0;
        const height = rect?.height || Number(viewportHeight) || 0;
        if (!width || !height) return;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        const mask = canvasOpacityMask(width, height, safeScale);
        this.canvas.style.maskImage = mask;
        this.canvas.style.webkitMaskImage = mask;
        this.displayMetrics = {
            scale: safeScale,
            width,
            height,
        };
        emit(this, 'canvas-display-scale', this.displayMetrics);
    }
}

customElements.define('sei-canvas', EditorCanvas);
