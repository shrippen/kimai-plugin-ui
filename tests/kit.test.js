// Selbsttest für kit/js/kit.js ohne Browser (node tests/kit.test.js, läuft in bin/lint.sh).
// Prüft: Version, escapeHtml, data-kpu-question und Fehlermeldungen kommen maskiert bei Kimais alert-Plugin an.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'kit/js/kit.js'), 'utf8');
const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim();

const handlers = {};
const calls = { question: [], error: [] };
let answer = null;
const alertPlugin = {
    question(message, callback) { calls.question.push(message); answer = callback; },
    error(title, message) { calls.error.push([title, message]); },
};
const document = {
    readyState: 'complete',
    addEventListener(name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    dispatchEvent() { return true; },
};
let fetched = null;
const window = {
    kimai: { getPlugin: (name) => (name === 'alert' ? alertPlugin : null) },
    sessionStorage: { getItem: () => null, removeItem() {}, setItem() {} },
    location: { reload() { throw new Error('unerwartetes Neuladen'); } },
    fetch(url, init) {
        fetched = { url, init };
        return Promise.resolve({
            type: 'basic', ok: false, status: 400,
            headers: { has: () => false, get: () => 'application/json' },
            text: () => Promise.resolve(JSON.stringify({ message: '<img src=x onerror=alert(2)>' })),
        });
    },
    confirm() { throw new Error('natives confirm() benutzt'); },
};
class CustomEvent { constructor(type, init) { this.type = type; Object.assign(this, init); } }
class FormData { constructor() { this.entries = []; } append(k, v) { this.entries.push([k, v]); } }

vm.runInNewContext(source, { window, document, CustomEvent, FormData, JSON, String, Object, Array, Error, Promise });

const ui = window.KimaiPluginUi;
assert.ok(ui, 'window.KimaiPluginUi fehlt');
assert.strictEqual(ui.version, version, 'kit.js VERSION passt nicht zu VERSION');
assert.strictEqual(ui.escapeHtml('<a href="x" title=\'y\'>&</a>'), '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
assert.strictEqual(ui.escapeHtml(null), '');
assert.strictEqual(ui.escapeHtml(5), '5');

function element(attrs) {
    const el = {
        attrs: Object.assign({}, attrs),
        classList: { add() {}, remove() {}, contains: () => false },
        getAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n) ? this.attrs[n] : null; },
        setAttribute(n, v) { this.attrs[n] = String(v); },
        removeAttribute(n) { delete this.attrs[n]; },
        closest(sel) { return sel === '[data-kpu-post]' ? el : null; },
        dispatchEvent() { return true; },
    };
    return el;
}

const trigger = element({
    'data-kpu-post': '/lock',
    'data-kpu-token': 't',
    'data-kpu-ids': '1,2',
    'data-kpu-question': '<img src=x onerror=alert(1)> %count% „Anna & Bob“',
});
let prevented = false;
handlers.click.forEach((fn) => fn({ target: trigger, preventDefault() { prevented = true; } }));
assert.ok(prevented, 'Klick auf [data-kpu-post] nicht abgefangen');
assert.deepStrictEqual(calls.question, ['&lt;img src=x onerror=alert(1)&gt; 2 „Anna &amp; Bob“'],
    'data-kpu-question muss maskiert an alert.question gehen');
assert.strictEqual(fetched, null, 'vor der Bestätigung darf nichts gesendet werden');

answer(true);
setTimeout(() => {
    assert.ok(fetched && fetched.url === '/lock', 'nach Bestätigung kein POST');
    assert.strictEqual(calls.error.length, 1, 'Fehler-Alert fehlt');
    assert.strictEqual(calls.error[0][1], '&lt;img src=x onerror=alert(2)&gt;', 'Server-Meldung muss maskiert an alert.error gehen');
    assert.ok(!/</.test(calls.error[0][0]), 'Fehlertitel unmaskiert');
    console.log('ok   kit.js Tests (Version, escapeHtml, Frage/Fehler maskiert)');
}, 20);
