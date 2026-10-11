export function localize(namespace) {
    void namespace;
    return (strings, ...values) => strings.reduce((text, part, index) => (
        text + part + (index < values.length ? String(values[index]) : '')
    ), '');
}
