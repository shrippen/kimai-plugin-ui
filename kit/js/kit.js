/*
 * kimai-plugin-ui kit – JavaScript (ohne Abhängigkeiten)
 *
 * Globales Objekt: window.KimaiPluginUi
 *   KimaiPluginUi.init(root?)                      – Sammelauswahl initialisieren (läuft automatisch)
 *   KimaiPluginUi.undoToast(message, undo)         – Hinweis mit "Rückgängig"; undo = {url, token, ids?}
 *   KimaiPluginUi.toast(message, type?)            – einfacher Hinweis (type: info|success|warning|danger)
 *   KimaiPluginUi.reloadWithToast(message, undo?)  – Seite neu laden und danach den Hinweis zeigen
 *   KimaiPluginUi.post(url, token, ids)            – POST (FormData: _token, ids[]) und JSON-Antwort
 *   KimaiPluginUi.setTranslations({...})           – Texte (setzt assets.html.twig aus der Domain "kpu")
 *
 * Events (auf dem Formular, bubbles):
 *   kpu:bulk-done  detail {form, submitter, ids, response}  – cancelable; ohne preventDefault() lädt die Seite neu
 *   kpu:undo-done  detail {undo, response}                    – cancelable; ohne preventDefault() lädt die Seite neu
 *
 * Start: nach "kimai.initialized" (Kimai-Plugins verfügbar) und als Rückfall nach DOMContentLoaded.
 */
(function (window, document) {
    'use strict';

    var VERSION = '0.1.0';
    if (window.KimaiPluginUi && window.KimaiPluginUi.version) {
        return; // bereits von einem anderen Plugin auf dieser Seite geladen
    }

    var STORAGE_KEY = 'kpu.pendingToast';
    var TOAST_DELAY = 10000;
    var bound = false;
    var kimai = null;

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

    function update(form) {
        var boxes = boxesFor(form.id);
        var count = boxes.filter(function (box) { return box.checked; }).length;
        var template = form.getAttribute('data-kpu-count-template') || i18n.selected;
        var label = form.querySelector('.kpu-bulk-count');
        if (label !== null) {
            label.textContent = template.replace('%count%', String(count));
        }
        form.hidden = count === 0;
        Array.prototype.forEach.call(form.querySelectorAll('button[type="submit"]'), function (btn) {
            btn.disabled = count === 0;
        });
        Array.prototype.forEach.call(
            document.querySelectorAll('input.kpu-select-all[data-kpu-form="' + form.id + '"]'),
            function (all) {
                all.checked = count > 0 && count === boxes.length;
                all.indeterminate = count > 0 && count < boxes.length;
            }
        );
    }

    function updateAll() {
        Array.prototype.forEach.call(document.querySelectorAll('form[data-kpu-bulk]'), update);
    }

    function formById(id) {
        var form = document.getElementById(id);
        return form !== null && form.hasAttribute('data-kpu-bulk') ? form : null;
    }

    function onChange(event) {
        var target = event.target;
        if (!target || !target.classList) {
            return;
        }
        if (target.classList.contains('kpu-select-all')) {
            var id = target.getAttribute('data-kpu-form');
            boxesFor(id).forEach(function (box) { box.checked = target.checked; });
            var f = formById(id);
            if (f !== null) { update(f); }
        } else if (target.classList.contains('kpu-select')) {
            var form = formById(target.getAttribute('data-kpu-form'));
            if (form !== null) { update(form); }
        }
    }

    function onClick(event) {
        var btn = event.target && event.target.closest ? event.target.closest('.kpu-bulk-clear') : null;
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

    function ask(question, callback) {
        var alert = getPlugin('alert');
        if (alert !== null && typeof alert.question === 'function') {
            alert.question(question, callback);
        } else {
            callback(window.confirm(question));
        }
    }

    function showError(message) {
        var alert = getPlugin('alert');
        if (alert !== null) {
            alert.error(t('error'), message || null);
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

    function post(url, token, ids) {
        var body = new FormData();
        body.append('_token', token);
        (ids || []).forEach(function (id) { body.append('ids[]', id); });
        return window.fetch(url, {
            method: 'POST',
            body: body,
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
        }).then(readJson);
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
        undoToast: undoToast,
        reloadWithToast: reloadWithToast,
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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window, document);
