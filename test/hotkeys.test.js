import assert from 'node:assert/strict';
import test from 'node:test';

import {
    Hotkey,
    HotkeyController,
    isSelectTarget,
    isTextTarget,
} from '../src/editor/hotkeys.js';
import { KeyboardController } from
    '../src/editor/KeyboardController.js';

const textTarget = { matches: (selector) => selector.includes('input') };
const shoelaceTarget = { matches: (selector) => selector.includes('sl-input') };
const selectTarget = { matches: (selector) => selector.includes('select') };
const plainTarget = { matches: () => false };

function keyEvent(key, options = {}) {
    const event = {
        key,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        repeat: false,
        target: plainTarget,
        defaultPrevented: false,
        preventDefault() {
            this.defaultPrevented = true;
        },
        ...options,
    };
    return event;
}

function makeHost(menu = null) {
    return {
        handlers: {},
        addEventListener(type, handler) {
            this.handlers[type] = handler;
        },
        removeEventListener(type) {
            delete this.handlers[type];
        },
        querySelector() {
            return menu;
        },
        fire(event) {
            this.handlers.keydown(event);
        },
    };
}

test('Hotkey parses chords and matches exactly', () => {
    const hotkey = new Hotkey('ctrl+shift+z', () => {});
    assert.equal(hotkey.key, 'z');
    assert.deepEqual(hotkey.modifiers, { ctrl: true, shift: true, alt: false });
    const matched = { key: 'Z', ctrlKey: true, shiftKey: true, altKey: false };
    assert.equal(hotkey.respondsTo(matched), true);
    const missing = { key: 'z', ctrlKey: true, shiftKey: false, altKey: false };
    assert.equal(hotkey.respondsTo(missing), false);
});

test('ctrl and meta count as the same modifier', () => {
    const hotkey = new Hotkey('ctrl+z', () => {});
    const meta = { key: 'z', ctrlKey: false, metaKey: true, shiftKey: false };
    assert.equal(hotkey.respondsTo({ ...meta, altKey: false }), true);
    const plain = { key: 'z', ctrlKey: false, metaKey: false, shiftKey: false };
    assert.equal(hotkey.respondsTo({ ...plain, altKey: false }), false);
});

test('target policy suppresses editable contexts by default', () => {
    assert.equal(isTextTarget(textTarget), true);
    assert.equal(isTextTarget(shoelaceTarget), true);
    assert.equal(isTextTarget(selectTarget), false);
    assert.equal(isTextTarget(plainTarget), false);
    assert.equal(isSelectTarget(selectTarget), true);
    assert.equal(isSelectTarget(textTarget), false);
    assert.equal(isTextTarget(null), false);
    assert.equal(isSelectTarget(undefined), false);
});

test('controller dispatches first match and prevents by default', () => {
    const host = makeHost();
    const calls = [];
    const controller = new HotkeyController(host);
    controller.register('r', () => calls.push('first'));
    controller.register('r', () => calls.push('second'));
    const event = keyEvent('r');
    host.fire(event);
    assert.deepEqual(calls, ['first']);
    assert.equal(event.defaultPrevented, true);
    controller.destroy();
    assert.equal(host.handlers.keydown, undefined);
});

test('declined actions do not prevent default', () => {
    const host = makeHost();
    const controller = new HotkeyController(host);
    controller.register('x', () => false);
    const event = keyEvent('x');
    host.fire(event);
    assert.equal(event.defaultPrevented, false);
});

test('repeat is ignored only when requested', () => {
    const host = makeHost();
    const calls = [];
    const controller = new HotkeyController(host);
    controller.register('r', () => calls.push('once'), { ignoreRepeat: true });
    controller.register('Delete', () => calls.push('repeat'));
    host.fire(keyEvent('r', { repeat: true }));
    host.fire(keyEvent('Delete', { repeat: true }));
    assert.deepEqual(calls, ['repeat']);
});

test('undo fires from a select but not from a text field', () => {
    const host = makeHost();
    const calls = [];
    const controller = new HotkeyController(host);
    controller.register('ctrl+z', () => calls.push('undo'), { allowInSelect: true });
    host.fire(keyEvent('z', { ctrlKey: true, target: selectTarget }));
    host.fire(keyEvent('z', { ctrlKey: true, target: textTarget }));
    host.fire(keyEvent('z', { ctrlKey: true, target: plainTarget }));
    assert.deepEqual(calls, ['undo', 'undo']);
});

function makeEditor() {
    return {
        commands: [],
        deleted: [],
        nudged: [],
        tools: [],
        selection: { isEmpty: false, toArray: () => [7] },
        state: { pointEditingId: null, activeTool: null },
        command(detail) {
            this.commands.push(detail);
        },
        deleteLayers(ids) {
            this.deleted.push(ids);
        },
        nudgeSelected(x, y) {
            this.nudged.push([x, y]);
        },
        toggleTool(type) {
            this.tools.push(type);
        },
        deactivateTool() {
            return false;
        },
        exitPointEditing() {
            return false;
        },
        selectLayers() {},
        togglePointEditing() {},
    };
}

test('layers-pane focus still undoes via the wiring', () => {
    const host = makeHost();
    const editor = makeEditor();
    const keyboard = new KeyboardController(editor, host);
    host.fire(keyEvent('z', { ctrlKey: true, target: selectTarget }));
    host.fire(keyEvent('y', { ctrlKey: true, target: selectTarget }));
    assert.deepEqual(editor.commands, [{ command: 'undo' }, { command: 'redo' }]);
    keyboard.destroy();
});

test('typing targets keep native behavior', () => {
    const host = makeHost();
    const editor = makeEditor();
    const keyboard = new KeyboardController(editor, host);
    const undo = keyEvent('z', { ctrlKey: true, target: textTarget });
    host.fire(undo);
    const tool = keyEvent('r', { target: textTarget });
    host.fire(tool);
    assert.deepEqual(editor.commands, []);
    assert.deepEqual(editor.tools, []);
    assert.equal(undo.defaultPrevented, false);
    keyboard.destroy();
});

test('tool, delete, and nudge shortcuts route', () => {
    const host = makeHost();
    const editor = makeEditor();
    const keyboard = new KeyboardController(editor, host);
    host.fire(keyEvent('r'));
    host.fire(keyEvent('Delete'));
    host.fire(keyEvent('ArrowLeft'));
    host.fire(keyEvent('ArrowRight', { shiftKey: true }));
    assert.deepEqual(editor.tools, ['rectangle']);
    assert.deepEqual(editor.commands, [{ command: 'delete-selected' }]);
    assert.deepEqual(editor.nudged, [[-2, 0], [10, 0]]);
    keyboard.destroy();
});

test('shift+s toggles point smoothing only while point editing', () => {
    const host = makeHost();
    const editor = makeEditor();
    const keyboard = new KeyboardController(editor, host);
    host.fire(keyEvent('s', { shiftKey: true }));
    assert.deepEqual(editor.commands, []);
    editor.state.pointEditingId = 7;
    host.fire(keyEvent('s', { shiftKey: true }));
    assert.deepEqual(editor.commands, [{ command: 'toggle-point-smooth' }]);
    keyboard.destroy();
});

test('file chords delegate to the menu bar', () => {
    const calls = [];
    const menu = {
        openPicker: () => calls.push('picker'),
        saveOrPrompt: () => calls.push('save'),
    };
    const host = makeHost(menu);
    const editor = makeEditor();
    const keyboard = new KeyboardController(editor, host);
    host.fire(keyEvent('o', { ctrlKey: true }));
    host.fire(keyEvent('s', { ctrlKey: true }));
    host.fire(keyEvent('a', { ctrlKey: true }));
    assert.deepEqual(calls, ['picker', 'save']);
    assert.deepEqual(editor.commands, [{ command: 'select-all' }]);
    keyboard.destroy();
});

test('save falls back to a command without a menu', () => {
    const host = makeHost();
    const editor = makeEditor();
    const keyboard = new KeyboardController(editor, host);
    host.fire(keyEvent('s', { ctrlKey: true }));
    host.fire(keyEvent('o', { ctrlKey: true }));
    assert.deepEqual(editor.commands, [{ command: 'save-document' }]);
    keyboard.destroy();
});
