import { DOMParser } from 'linkedom';

globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = class {
    serializeToString(node) { return node.toString(); }
};
