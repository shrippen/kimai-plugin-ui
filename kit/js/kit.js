/*
 * kimai-plugin-ui kit – JavaScript (ohne Abhängigkeiten)
 *
 * Globales Objekt: window.KimaiPluginUi
 *   KimaiPluginUi.init(root?)                      – Sammelauswahl initialisieren (läuft automatisch)
 *   KimaiPluginUi.update()                         – Auswahl neu zählen (nach eigenem box.checked = …)
 *   KimaiPluginUi.selectedIds(formId)              – ausgewählte IDs (Strings)
 *   KimaiPluginUi.select(formId, ids, checked?)    – Zeilen per ID an-/abwählen (checked = true), löst selection-change aus
 *   KimaiPluginUi.undoToast(message, undo)         – Hinweis mit "Rückgängig"; undo = {url, token, ids?}
 *   KimaiPluginUi.toast(message, type?)            – einfacher Hinweis (type: info|success|warning|danger)
 *   KimaiPluginUi.reloadWithToast(message, undo?)  – Seite neu laden und danach den Hinweis zeigen
 *   KimaiPluginUi.post(url, token, ids, params?)   – POST (FormData: _token, ids[], params) und JSON-Antwort
 *   KimaiPluginUi.setTranslations({...})           – Texte (setzt assets.html.twig aus der Domain "kpu")
 *   KimaiPluginUi.escapeHtml(text)                 – (seit 0.3) Text für HTML maskieren, z. B. vor eigenen Aufrufen von
 *                                                    kimai.getPlugin('alert').question()/error()/…, die HTML einsetzen
 *
 * Sicherheit: kit.js setzt nie HTML aus Attributen oder Antworten ein (nur textContent). Texte für Kimais alert-Plugin
 * (data-kpu-question, Fehlermeldungen) werden maskiert – data-kpu-question ist reiner Text, HTML darin wird angezeigt,
 * nicht ausgeführt.
 *
 * Markup, das kit.js ohne eigenes Skript versteht:
 *   input.kpu-select[data-kpu-form][data-kpu-groups="g1 g2"]  – Zeilen-Checkbox (kit.bulk_checkbox), Gruppen-Schlüssel optional
 *   input.kpu-select-all[data-kpu-form]                        – alle Zeilen (kit.bulk_select_all)
 *   input.kpu-select-group[data-kpu-form][data-kpu-group="g1"] – nur Zeilen mit diesem Gruppen-Schlüssel
 *        (oder [data-kpu-ids="[1,2]"] statt data-kpu-group); zeigt "teilweise" (indeterminate) (kit.bulk_select_group)
 *   [data-kpu-post="<url>"][data-kpu-token][data-kpu-ids="1,2"][data-kpu-params='{"k":"v"}'][data-kpu-question]
 *        – Sofort-Aktion per Klick (z. B. Eintrag im "…"-Menü): POST mit _token, ids[], params; Accept: application/json.
 *          JSON {message, undo?} -> Seite neu laden + Hinweis (mit "Rückgängig"); andere Antwort -> Seite neu laden;
 *          Fehler -> Kimai-Alert. data-kpu-question nur für Endgültiges (Kimai-Bestätigungsmodal vorher; reiner Text).
 *   Event "kpu.reload" auf document (z. B. data-form-event eines Modal-Formulars) -> Seite neu laden
 *
 * Events (bubbles):
 *   kpu:selection-change  auf dem Sammelformular, detail {form: '<form-id>', ids: ['1', …], count}
 *                         – nach jeder Änderung der Auswahl (Zeile, Gruppe, alle, "Auswahl aufheben", select(),
 *                           Neuladen der Tabelle); nicht cancelable
 *   kpu:bulk-done  auf dem Formular, detail {form, submitter, ids, response} – cancelable; ohne preventDefault() lädt die Seite neu
 *   kpu:post-done  auf dem Auslöser [data-kpu-post], detail {element, url, ids, response} – cancelable; ohne
 *                  preventDefault() lädt die Seite neu (mit Hinweis/Rückgängig aus response)
 *   kpu:undo-done  auf document, detail {undo, response} – cancelable; ohne preventDefault() lädt die Seite neu
 *
 * Start: nach "kimai.initialized" (Kimai-Plugins verfügbar) und als Rückfall nach DOMContentLoaded.
 */
(function (window, document) {
    'use strict';

    var VERSION = '0.5.0';
    if (window.KimaiPluginUi && window.KimaiPluginUi.version) {
        return; // bereits von einem anderen Plugin auf dieser Seite geladen
    }

    var STORAGE_KEY = 'kpu.pendingToast';
    var TOAST_DELAY = 10000;
    var bound = false;
    var kimai = null;
    var lastSelection = {};

    var i18n = {
        selected: '%count% selected',
        undo: 'Undo',
        close: 'Close',
        error: 'The action could not be completed.',
        undone: 'Action undone.'
    };

    function t(key, count) {
        var text = i18n[key] || key;
        if (count !== undefined) {
            text = text.replace('%count%', String(count));
        }
        return text;
    }

    function getKimai() {
        return kimai || window.kimai || null;
    }

    function getPlugin(name) {
        var k = getKimai();
        if (k === null) {
            return null;
        }
        try {
            return k.getPlugin(name);
        } catch (e) {
            return null;
        }
    }

    /* ---------- Sammelauswahl ---------- */

    function boxesFor(formId) {
        return Array.prototype.slice.call(
            document.querySelectorAll('input.kpu-select[data-kpu-form="' + formId + '"]')
        ).filter(function (box) { return !box.disabled; });
    }

    function selectedIds(formId) {
        return boxesFor(formId).filter(function (box) { return box.checked; }).map(function (box) { return box.value; });
    }

    function toArray(list) {
        return Array.prototype.slice.call(list);
    }

    /** IDs aus data-Attribut: JSON-Array ("[1,2]") oder durch Komma/Leerzeichen getrennt ("1,2") -> Strings */
    function parseIds(raw) {
        if (raw === null || raw === undefined || raw === '') {
            return [];
        }
        var list = null;
        if (raw.charAt(0) === '[') {
            try { list = JSON.parse(raw); } catch (e) { list = null; }
        }
        if (!Array.isArray(list)) {
            list = raw.split(/[\s,]+/);
        }
        return list.map(function (id) { return String(id); }).filter(function (id) { return id !== ''; });
    }

    function groupBoxesFor(formId) {
        return toArray(document.querySelectorAll('input.kpu-select-group[data-kpu-form="' + formId + '"]'));
    }

    /** Zeilen-Checkboxen, die zu einer Gruppen-Checkbox gehören (Schlüssel in data-kpu-groups oder ID-Liste) */
    function membersOf(groupBox, boxes) {
        var key = groupBox.getAttribute('data-kpu-group');
        if (key) {
            return boxes.filter(function (box) {
                return (' ' + (box.getAttribute('data-kpu-groups') || '') + ' ').indexOf(' ' + key + ' ') !== -1;
            });
        }
        var ids = parseIds(groupBox.getAttribute('data-kpu-ids'));
        return boxes.filter(function (box) { return ids.indexOf(box.value) !== -1; });
    }

    function update(form) {
        var boxes = boxesFor(form.id);
        var ids = boxes.filter(function (box) { return box.checked; }).map(function (box) { return box.value; });
        var count = ids.length;
        var template = form.getAttribute('data-kpu-count-template') || i18n.selected;
        var label = form.querySelector('.kpu-bulk-count');
        if (label !== null) {
            label.textContent = template.replace('%count%', String(count));
        }
        form.hidden = count === 0;
        toArray(form.querySelectorAll('button[type="submit"]')).forEach(function (btn) {
            btn.disabled = count === 0;
        });
        toArray(document.querySelectorAll('input.kpu-select-all[data-kpu-form="' + form.id + '"]')).forEach(function (all) {
            all.checked = count > 0 && count === boxes.length;
            all.indeterminate = count > 0 && count < boxes.length;
        });
        groupBoxesFor(form.id).forEach(function (group) {
            var members = membersOf(group, boxes);
            var checked = members.filter(function (box) { return box.checked; }).length;
            group.disabled = members.length === 0;
            group.checked = checked > 0 && checked === members.length;
            group.indeterminate = checked > 0 && checked < members.length;
        });

        var key = ids.join(',');
        if ((lastSelection[form.id] || '') !== key) {
            lastSelection[form.id] = key;
            form.dispatchEvent(new CustomEvent('kpu:selection-change', {
                bubbles: true,
                detail: { form: form.id, ids: ids, count: count }
            }));
        }
    }

    function updateAll() {
        toArray(document.querySelectorAll('form[data-kpu-bulk]')).forEach(update);
    }

    function formById(id) {
        var form = document.getElementById(id);
        return form !== null && form.hasAttribute('data-kpu-bulk') ? form : null;
    }

    function updateForm(id) {
        var form = formById(id);
        if (form !== null) { update(form); }
    }

    function select(formId, ids, checked) {
        var wanted = parseIds(Array.isArray(ids) ? JSON.stringify(ids) : String(ids));
        var state = checked === undefined ? true : !!checked;
        boxesFor(formId).forEach(function (box) {
            if (wanted.indexOf(box.value) !== -1) { box.checked = state; }
        });
        updateForm(formId);
    }

    function onChange(event) {
        var target = event.target;
        if (!target || !target.classList) {
            return;
        }
        var id = target.getAttribute('data-kpu-form');
        if (target.classList.contains('kpu-select-all')) {
            boxesFor(id).forEach(function (box) { box.checked = target.checked; });
            updateForm(id);
        } else if (target.classList.contains('kpu-select-group')) {
            membersOf(target, boxesFor(id)).forEach(function (box) { box.checked = target.checked; });
            updateForm(id);
        } else if (target.classList.contains('kpu-select')) {
            updateForm(id);
        }
    }

    function onClick(event) {
        if (!event.target || !event.target.closest) {
            return;
        }
        var trigger = event.target.closest('[data-kpu-post]');
        if (trigger !== null) {
            event.preventDefault();
            postAction(trigger);
            return;
        }
        var btn = event.target.closest('.kpu-bulk-clear');
        if (btn === null) {
            return;
        }
        var form = btn.closest('form[data-kpu-bulk]');
        if (form === null) {
            return;
        }
        boxesFor(form.id).forEach(function (box) { box.checked = false; });
        update(form);
    }

    /**
     * Text für HTML maskieren. Kimais alert-Plugin (question, error, warning, info, success) setzt seine Texte als HTML
     * ein (template.innerHTML) – Texte aus Attributen (data-kpu-question) oder Server-Antworten ({message}) müssen
     * deshalb vorher maskiert werden, sonst wird z. B. ein Benutzer- oder Projektname im Text als HTML ausgeführt.
     */
    function escapeHtml(text) {
        return String(text === null || text === undefined ? '' : text).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function ask(question, callback) {
        var alert = getPlugin('alert');
        if (alert !== null && typeof alert.question === 'function') {
            alert.question(escapeHtml(question), callback); // Kimai setzt den Text als HTML ein
        } else {
            callback(window.confirm(question)); // nur Text, kein HTML
        }
    }

    function showError(message) {
        var alert = getPlugin('alert');
        if (alert !== null) {
            // Kimai setzt Titel und Text als HTML ein; message kommt aus der Server-Antwort
            alert.error(escapeHtml(t('error')), message ? escapeHtml(message) : null);
        } else {
            window.alert(t('error') + (message ? '\n' + message : ''));
        }
    }

    function nativeSubmit(form, submitter) {
        var hidden = form.querySelector('input[type="hidden"][name="_token"]');
        if (hidden === null) {
            hidden = document.createElement('input');
            hidden.type = 'hidden';
            hidden.name = '_token';
            form.appendChild(hidden);
        }
        hidden.value = submitter.value;
        form.action = submitter.formAction || form.action;
        form.submit();
    }

    function readJson(response) {
        return response.text().then(function (text) {
            var data = null;
            try { data = text ? JSON.parse(text) : {}; } catch (e) { data = null; }
            if (!response.ok || data === null) {
                var msg = data && (data.message || data.error) ? (data.message || data.error) : null;
                var err = new Error(msg || ('HTTP ' + response.status));
                err.kpuMessage = msg;
                throw err;
            }
            return data;
        });
    }

    function send(url, token, ids, params, manualRedirect) {
        var body = new FormData();
        body.append('_token', token || '');
        (ids || []).forEach(function (id) { body.append('ids[]', id); });
        var extra = params || {};
        Object.keys(extra).forEach(function (name) {
            var value = extra[name];
            if (Array.isArray(value)) {
                value.forEach(function (v) { body.append(name + '[]', v); });
            } else if (value !== null && value !== undefined) {
                body.append(name, value);
            }
        });
        return window.fetch(url, {
            method: 'POST',
            body: body,
            credentials: 'same-origin',
            // manual: einem Redirect NICHT im Hintergrund folgen – sonst rendert fetch die Zielseite und verbraucht
            // dabei die Flash-Meldungen (kpu_result), die nach dem Neuladen sichtbar sein sollen
            redirect: manualRedirect ? 'manual' : 'follow',
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
        });
    }

    function post(url, token, ids, params) {
        return send(url, token, ids, params).then(readJson);
    }

    /* ---------- Sofort-Aktion [data-kpu-post] ---------- */

    function postAction(el) {
        if (el.getAttribute('data-kpu-busy') === '1') {
            return;
        }
        var url = el.getAttribute('data-kpu-post') || el.getAttribute('href') || '';
        if (url === '' || url === '#') {
            return;
        }
        var ids = parseIds(el.getAttribute('data-kpu-ids'));
        var params = {};
        var rawParams = el.getAttribute('data-kpu-params');
        if (rawParams) {
            try { params = JSON.parse(rawParams) || {}; } catch (e) { params = {}; }
        }
        var busy = function (on) {
            if (on) {
                el.setAttribute('data-kpu-busy', '1');
                el.setAttribute('aria-disabled', 'true');
                el.classList.add('disabled');
            } else {
                el.removeAttribute('data-kpu-busy');
                el.removeAttribute('aria-disabled');
                el.classList.remove('disabled');
            }
        };
        var go = function () {
            busy(true);
            send(url, el.getAttribute('data-kpu-token'), ids, params, true).then(function (response) {
                if (response.type === 'opaqueredirect') {
                    window.location.reload(); // Redirect (ohne JS-Pfad im Controller): Seite zeigt neuen Stand + kpu_result
                    return;
                }
                if (response.status === 201 && response.headers.has('x-modal-redirect')) {
                    window.location = response.headers.get('x-modal-redirect'); // Kimai redirectToRouteAfterCreate()
                    return;
                }
                var type = response.headers.get('Content-Type') || '';
                if (response.ok && type.indexOf('json') === -1) {
                    window.location.reload();
                    return;
                }
                return readJson(response).then(function (data) {
                    var done = new CustomEvent('kpu:post-done', {
                        bubbles: true,
                        cancelable: true,
                        detail: { element: el, url: url, ids: ids, response: data }
                    });
                    if (el.dispatchEvent(done)) {
                        if (data.message) {
                            reloadWithToast(data.message, data.undo || null);
                        } else {
                            window.location.reload();
                        }
                    } else {
                        busy(false);
                        if (data.message) {
                            data.undo ? undoToast(data.message, data.undo) : toast(data.message, 'success');
                        }
                    }
                });
            }).catch(function (err) {
                busy(false);
                showError(err.kpuMessage || null);
            });
        };
        var question = el.getAttribute('data-kpu-question');
        if (question) {
            ask(question.replace('%count%', String(ids.length)), function (ok) { if (ok) { go(); } });
        } else {
            go();
        }
    }

    function ajaxSubmit(form, submitter) {
        var ids = selectedIds(form.id);
        submitter.disabled = true;
        post(submitter.formAction, submitter.value, ids).then(function (data) {
            var done = new CustomEvent('kpu:bulk-done', {
                bubbles: true,
                cancelable: true,
                detail: { form: form, submitter: submitter, ids: ids, response: data }
            });
            if (form.dispatchEvent(done)) {
                reloadWithToast(data.message || '', data.undo || null);
            } else {
                if (data.message) {
                    data.undo ? undoToast(data.message, data.undo) : toast(data.message, 'success');
                }
                update(form);
            }
        }).catch(function (err) {
            showError(err.kpuMessage || null);
        }).then(function () {
            submitter.disabled = false;
        });
    }

    function onSubmit(event) {
        var form = event.target;
        if (!form || !form.hasAttribute || !form.hasAttribute('data-kpu-bulk')) {
            return;
        }
        var submitter = event.submitter || form.querySelector('button[type="submit"]');
        if (!submitter || selectedIds(form.id).length === 0) {
            event.preventDefault();
            return;
        }
        var ajax = submitter.hasAttribute('data-kpu-ajax') && typeof window.fetch === 'function';
        var question = submitter.getAttribute('data-kpu-question');
        if (!ajax && !question) {
            return; // normales Absenden: Browser schickt ids[] (form-Attribut) und _token (Knopf) mit
        }
        event.preventDefault();
        var go = function () { ajax ? ajaxSubmit(form, submitter) : nativeSubmit(form, submitter); };
        if (question) {
            ask(question.replace('%count%', String(selectedIds(form.id).length)), function (ok) { if (ok) { go(); } });
        } else {
            go();
        }
    }

    /* ---------- Hinweise (Toasts) ---------- */

    function container() {
        var el = document.getElementById('toast-container');
        if (el === null) {
            el = document.createElement('div');
            el.id = 'toast-container';
            el.className = 'toast-container position-fixed top-0 start-50 translate-middle-x p-3';
            document.body.appendChild(el);
        }
        return el;
    }

    function buildToast(message, type) {
        var el = document.createElement('div');
        el.className = 'toast show kpu-toast' + (type && type !== 'info' ? ' border-' + type : '');
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        var body = document.createElement('div');
        body.className = 'toast-body';
        var text = document.createElement('span');
        text.className = 'kpu-toast-message';
        text.textContent = message;
        body.appendChild(text);
        el.appendChild(body);
        return { el: el, body: body };
    }

    function closeButton(onClose) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-close';
        btn.setAttribute('aria-label', t('close'));
        btn.addEventListener('click', onClose);
        return btn;
    }

    function show(parts, delay) {
        var removed = false;
        var remove = function () {
            if (removed) { return; }
            removed = true;
            if (parts.el.parentNode) { parts.el.parentNode.removeChild(parts.el); }
        };
        parts.body.appendChild(closeButton(remove));
        container().appendChild(parts.el);
        var timer = window.setTimeout(remove, delay || TOAST_DELAY);
        parts.el.addEventListener('mouseenter', function () { window.clearTimeout(timer); });
        parts.el.addEventListener('mouseleave', function () { timer = window.setTimeout(remove, delay || TOAST_DELAY); });
        return remove;
    }

    function toast(message, type) {
        if (!message) { return; }
        show(buildToast(message, type || 'success'), 5000);
    }

    function undoToast(message, undo) {
        if (!undo || !undo.url) {
            toast(message, 'success');
            return;
        }
        var parts = buildToast(message, 'success');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-sm kpu-toast-undo';
        btn.textContent = undo.label || t('undo');
        parts.body.appendChild(btn);
        var remove = show(parts, TOAST_DELAY);
        btn.addEventListener('click', function () {
            btn.disabled = true;
            post(undo.url, undo.token, undo.ids || []).then(function (data) {
                remove();
                var done = new CustomEvent('kpu:undo-done', { bubbles: true, cancelable: true, detail: { undo: undo, response: data } });
                if (document.dispatchEvent(done)) {
                    reloadWithToast(data.message || t('undone'), null);
                } else {
                    toast(data.message || t('undone'), 'info');
                }
            }).catch(function (err) {
                btn.disabled = false;
                showError(err.kpuMessage || null);
            });
        });
    }

    function reloadWithToast(message, undo) {
        try {
            window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ message: message, undo: undo || null }));
        } catch (e) {
            // Speicher gesperrt (privater Modus): Hinweis entfällt, Seite lädt trotzdem neu
        }
        window.location.reload();
    }

    function showPending() {
        var raw = null;
        try {
            raw = window.sessionStorage.getItem(STORAGE_KEY);
            window.sessionStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            raw = null;
        }
        if (!raw) { return; }
        try {
            var data = JSON.parse(raw);
            if (data && data.message) {
                data.undo ? undoToast(data.message, data.undo) : toast(data.message, 'success');
            }
        } catch (e) {
            // ignorieren
        }
    }

    /* ---------- Start ---------- */

    function init() {
        if (!bound) {
            bound = true;
            // am document gebunden: überlebt das Neuladen von section.content durch KimaiDatatable
            document.addEventListener('change', onChange);
            document.addEventListener('click', onClick);
            document.addEventListener('submit', onSubmit);
            showPending();
        }
        updateAll();
    }

    function setTranslations(map) {
        for (var key in map) {
            if (Object.prototype.hasOwnProperty.call(map, key) && map[key]) {
                i18n[key] = map[key];
            }
        }
    }

    window.KimaiPluginUi = {
        version: VERSION,
        init: init,
        update: updateAll,
        selectedIds: selectedIds,
        post: post,
        toast: toast,
        select: select,
        undoToast: undoToast,
        reloadWithToast: reloadWithToast,
        escapeHtml: escapeHtml,
        setTranslations: setTranslations
    };

    document.addEventListener('kimai.initialized', function (event) {
        if (event && event.detail && event.detail.kimai) {
            kimai = event.detail.kimai;
        }
        init();
    });
    // Kimai-Tabellen laden Inhalte per AJAX nach: Auswahl danach neu zählen
    document.addEventListener('kimai.reloadedContent', updateAll);
    // data-form-event="kpu.reload" (Modal-Formular) oder eigenes Skript: ganze Seite neu laden (zeigt kpu_result-Flashes)
    document.addEventListener('kpu.reload', function () { window.location.reload(); });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window, document);
