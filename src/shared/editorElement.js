export function emit(element, name, detail = {}) {
    return element.dispatchEvent(new CustomEvent(name, {
        detail,
        bubbles: true,
        composed: true,
    }));
}

export function emitCommand(element, detail) {
    return emit(element, 'sei-command', detail);
}

export class EditorElement extends HTMLElement {
    _state = {};
    _abort = null;

    get state() {
        return this._state;
    }

    set state(value) {
        this._state = value ?? {};
        if (this.isConnected) this.update();
    }

    get signal() {
        this._abort ??= new AbortController();
        return this._abort.signal;
    }

    on(type, handler, target = this) {
        target.addEventListener(type, handler, { signal: this.signal });
    }

    emit(detail) {
        return emitCommand(this, detail);
    }

    resetListeners() {
        this._abort?.abort();
        this._abort = new AbortController();
    }

    disconnectedCallback() {
        this._abort?.abort();
        this._abort = null;
    }
}
