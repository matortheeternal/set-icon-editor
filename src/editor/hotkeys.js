const MODIFIERS = ['ctrl', 'shift', 'alt'];
const TEXT_SELECTOR = 'input, textarea, sl-input, sl-textarea, [contenteditable="true"]';

export class Hotkey {
    constructor(keyStr, action, options = {}) {
        this.keyStr = keyStr;
        this.action = action;
        this.allowInText = options.allowInText ?? false;
        this.allowInSelect = options.allowInSelect ?? false;
        this.ignoreRepeat = options.ignoreRepeat ?? false;
        this.key = '';
        this.modifiers = { ctrl: false, shift: false, alt: false };
        keyStr.toLowerCase().split('+').forEach((part) => {
            if (MODIFIERS.includes(part)) this.modifiers[part] = true;
            else this.key = part;
        });
    }

    respondsTo(event) {
        const mod = event.ctrlKey || event.metaKey;
        return this.key === event.key.toLowerCase()
            && mod === this.modifiers.ctrl
            && event.shiftKey === this.modifiers.shift
            && event.altKey === this.modifiers.alt;
    }
}

export function isTextTarget(target) {
    return !!target?.matches?.(TEXT_SELECTOR);
}

export function isSelectTarget(target) {
    return !!target?.matches?.('select');
}

export class HotkeyController {
    constructor(host) {
        this.host = host;
        this.hotkeys = [];
        this.onKeydownBound = (event) => this.onKeydown(event);
        this.host.addEventListener('keydown', this.onKeydownBound);
    }

    register(keyStr, action, options) {
        const hotkey = new Hotkey(keyStr, action, options);
        this.hotkeys.push(hotkey);
        return hotkey;
    }

    targetAllows(hotkey, target) {
        if (isTextTarget(target)) return hotkey.allowInText;
        if (isSelectTarget(target)) return hotkey.allowInSelect;
        return true;
    }

    onKeydown(event) {
        const hotkey = this.hotkeys.find((candidate) => {
            return candidate.respondsTo(event)
                && this.targetAllows(candidate, event.target);
        });
        if (!hotkey) return;
        if (event.repeat && hotkey.ignoreRepeat) return;
        const handled = hotkey.action(event);
        if (handled !== false) event.preventDefault();
    }

    destroy() {
        this.host.removeEventListener('keydown', this.onKeydownBound);
    }
}
