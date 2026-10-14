/** Move and resize existing controls without replacing their input handlers. */
(() => {
    const STORAGE_KEY = 'dino-control-layout-v1';
    const definitions = [
        ['coin', 'Coin', '#btn-insert-coin'],
        ['start', 'Start', '#btn-start-p1'],
        ['menu', 'Menu ☰', '.ejs_virtualGamepad_open'],
        ['fullscreen', 'Fullscreen', '#game-fullscreen'],
        ['x', 'X', '.ejs_virtualGamepad_button.b_x'],
        ['y', 'Y', '.ejs_virtualGamepad_button.b_y'],
        ['joystick', 'Joystick', '.b_layout_joystick']
    ];
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const copy = value => JSON.parse(JSON.stringify(value));
    const validate = value => {
        const result = {};
        for (const [key] of definitions) {
            const item = value?.[key];
            if (item && ['x', 'y', 'scale'].every(name => Number.isFinite(item[name]))) {
                result[key] = { x: clamp(item.x, 0, 1), y: clamp(item.y, 0, 1), scale: clamp(item.scale, 0.5, 2) };
            }
        }
        return result;
    };

    window.setupControlLayout = () => {
        if (document.getElementById('control-layout-open')) return;
        let saved = {};
        try { saved = validate(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch (_) {}
        let draft = copy(saved);
        let editing = false;
        let selected = 'coin';
        let drag = null;
        const controls = new Map();
        const open = document.createElement('button');
        open.id = 'control-layout-open';
        open.type = 'button';
        open.textContent = '✎';
        open.title = 'Edit control layout';
        open.setAttribute('aria-label', 'Edit control layout');
        const editor = document.createElement('div');
        editor.id = 'control-layout-editor';
        editor.hidden = true;
        editor.innerHTML = `<div class="layout-drag-layer" aria-label="Drag controls to move them"></div>
            <form class="layout-panel" aria-label="Control layout editor">
                <label>Control <select name="control" aria-label="Select control"></select></label>
                <label>Size <input name="size" type="range" min="50" max="200" value="100" step="5" aria-label="Control size"><output>100%</output></label>
                <span class="layout-instruction" role="status">Drag a control to move it.</span>
                <div class="layout-actions"><button type="button" name="reset">Reset</button><button type="button" name="cancel">Cancel</button><button type="submit">Save</button></div>
            </form>`;
        document.body.append(open, editor);
        const layer = editor.querySelector('.layout-drag-layer');
        const form = editor.querySelector('form');
        const select = form.elements.control;
        const size = form.elements.size;
        const output = form.querySelector('output');
        const status = form.querySelector('[role="status"]');
        for (const [key, label] of definitions) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = label;
            select.append(option);
        }

        // NippleJS exposes its live collections; keep its center and movement
        // radius synchronized with the existing joystick's new position and size.
        const joystickCollection = node => {
            const factory = window.nipplejs?.factory;
            const collections = Array.isArray(factory) ? factory : factory?.collections;
            return collections?.find(collection => collection.options.zone === node);
        };
        const defaultRect = node => {
            const rect = node.getBoundingClientRect();
            if (node.matches('.b_layout_joystick')) {
                return node.querySelector('.back')?.getBoundingClientRect() || rect;
            }
            return rect;
        };
        const discover = () => {
            let changed = false;
            for (const [key, label, selector] of definitions) {
                const node = document.querySelector(selector);
                if (!node || controls.get(key)?.node === node) continue;
                const rect = defaultRect(node);
                if (!rect.width || !rect.height) continue;
                const collection = key === 'joystick' ? joystickCollection(node) : null;
                if (key === 'joystick' && !collection) continue;
                const box = document.createElement('button');
                box.type = 'button';
                box.className = 'layout-control-box';
                box.dataset.control = key;
                box.textContent = label;
                box.setAttribute('aria-label', `Move ${label}`);
                controls.get(key)?.box.remove();
                layer.append(box);
                controls.set(key, {
                    node, box, width: rect.width, height: rect.height,
                    style: node.style.cssText, fontSize: parseFloat(getComputedStyle(node).fontSize) || 16,
                    collection,
                    nippleStyles: collection ? collection.map(nipple => ({
                        nipple, size: nipple.options.size,
                        back: nipple.ui.back.style.cssText, front: nipple.ui.front.style.cssText,
                        el: nipple.el.style.cssText
                    })) : []
                });
                changed = true;
            }
            for (const option of select.options) option.disabled = !controls.has(option.value);
            if (changed) apply();
        };
        const restore = control => {
            control.node.style.cssText = control.style;
            if (control.collection) {
                for (const item of control.nippleStyles) {
                    item.nipple.options.size = item.size;
                    item.nipple.ui.back.style.cssText = item.back;
                    item.nipple.ui.front.style.cssText = item.front;
                    item.nipple.el.style.cssText = item.el;
                }
            }
        };
        const syncJoystick = control => {
            if (!control.collection) return;
            // Recalculate on every touch as well, including Safari viewport changes.
            control.collection.options.dynamicPage = true;
            for (const nipple of control.collection) {
                const rect = nipple.el.getBoundingClientRect();
                nipple.position = { x: rect.left + window.scrollX, y: rect.top + window.scrollY };
            }
        };
        const apply = () => {
            const layout = editing ? draft : saved;
            for (const [key, control] of controls) {
                const item = layout[key];
                if (!item) restore(control);
                else {
                    const width = Math.min(control.width * item.scale, innerWidth);
                    const height = Math.min(control.height * item.scale, innerHeight);
                    const left = clamp(item.x * innerWidth - width / 2, 0, innerWidth - width);
                    const top = clamp(item.y * innerHeight - height / 2, 0, innerHeight - height);
                    const style = control.node.style;
                    const properties = { position: 'fixed', left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto',
                        width: `${width}px`, height: `${height}px`, minWidth: '0', minHeight: '0', margin: '0',
                        transform: 'none', transition: 'none', zIndex: '10001', boxSizing: 'border-box', touchAction: 'none' };
                    for (const [property, value] of Object.entries(properties)) style[property] = value;
                    style.fontSize = `${control.fontSize * item.scale}px`;
                    if (key === 'x' || key === 'y') style.lineHeight = `${height}px`;
                    if (control.collection) {
                        for (const nipple of control.collection) {
                            nipple.options.size = width;
                            Object.assign(nipple.el.style, { left: '50%', top: '50%' });
                            Object.assign(nipple.ui.back.style, { width: `${width}px`, height: `${height}px`, marginLeft: `${-width / 2}px`, marginTop: `${-height / 2}px` });
                            Object.assign(nipple.ui.front.style, { width: `${width / 2}px`, height: `${height / 2}px`, marginLeft: `${-width / 4}px`, marginTop: `${-height / 4}px` });
                        }
                    }
                }
                syncJoystick(control);
                const rect = defaultRect(control.node);
                Object.assign(control.box.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
                control.box.classList.toggle('selected', key === selected);
            }
        };
        const materialize = () => {
            // Capture every center before fixed positioning removes a sibling
            // from its original flex layout (notably Coin and Start).
            for (const [key, control] of controls) {
                if (draft[key]) continue;
                const rect = defaultRect(control.node);
                draft[key] = { x: (rect.left + rect.width / 2) / innerWidth, y: (rect.top + rect.height / 2) / innerHeight, scale: 1 };
            }
        };
        const currentItem = key => { materialize(); return draft[key]; };
        const choose = key => {
            selected = key;
            select.value = key;
            size.disabled = !controls.has(key);
            size.value = Math.round((draft[key]?.scale || 1) * 100);
            output.value = `${size.value}%`;
            apply();
        };
        const finish = () => {
            editing = false;
            drag = null;
            editor.hidden = true;
            open.hidden = false;
            apply();
            open.focus();
        };
        open.addEventListener('click', () => {
            discover();
            draft = copy(saved);
            materialize();
            editing = true;
            editor.hidden = false;
            open.hidden = true;
            window.virtualArcadeControls?.releaseAll();
            for (let index = 0; index <= 8; index++) window.EJS_emulator?.gameManager?.simulateInput(0, index, 0);
            status.textContent = 'Drag a control to move it. Use Size to resize it.';
            choose(controls.has(selected) ? selected : 'coin');
        });
        select.addEventListener('change', () => choose(select.value));
        size.addEventListener('input', () => {
            if (!controls.has(selected)) return;
            currentItem(selected).scale = Number(size.value) / 100;
            output.value = `${size.value}%`;
            apply();
        });
        layer.addEventListener('pointerdown', event => {
            const box = event.target.closest('.layout-control-box');
            if (!box) return;
            event.preventDefault();
            choose(box.dataset.control);
            const rect = box.getBoundingClientRect();
            drag = { key: selected, pointer: event.pointerId, dx: event.clientX - rect.left - rect.width / 2, dy: event.clientY - rect.top - rect.height / 2 };
            layer.setPointerCapture(event.pointerId);
        });
        layer.addEventListener('pointermove', event => {
            if (!drag || event.pointerId !== drag.pointer) return;
            const item = currentItem(drag.key);
            item.x = clamp((event.clientX - drag.dx) / innerWidth, 0, 1);
            item.y = clamp((event.clientY - drag.dy) / innerHeight, 0, 1);
            apply();
        });
        for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) layer.addEventListener(name, () => { drag = null; });
        layer.addEventListener('keydown', event => {
            const key = event.target.dataset.control;
            const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
            if (!key || !moves[event.key]) return;
            event.preventDefault();
            choose(key);
            const item = currentItem(key), step = event.shiftKey ? 10 : 2;
            item.x = clamp(item.x + moves[event.key][0] * step / innerWidth, 0, 1);
            item.y = clamp(item.y + moves[event.key][1] * step / innerHeight, 0, 1);
            apply();
        });
        form.addEventListener('submit', event => {
            event.preventDefault();
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(validate(draft)));
                saved = validate(draft);
                finish();
            } catch (_) { status.textContent = 'Storage is unavailable. Allow site storage to save your layout.'; }
        });
        form.elements.cancel.addEventListener('click', finish);
        form.elements.reset.addEventListener('click', () => { draft = {}; choose(selected); });
        editor.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); finish(); }
        });
        // Prevent editing gestures and keys from also triggering gameplay.
        for (const name of ['touchstart', 'touchmove', 'touchend', 'touchcancel', 'pointerdown', 'pointermove', 'pointerup', 'click', 'keydown', 'keyup']) {
            editor.addEventListener(name, event => event.stopPropagation());
        }
        window.addEventListener('resize', () => { drag = null; discover(); apply(); });
        window.refreshControlLayout = discover;
        let pending = false;
        new MutationObserver(() => {
            if (pending) return;
            pending = true;
            requestAnimationFrame(() => { pending = false; discover(); });
        }).observe(document.getElementById('game-viewport'), { childList: true, subtree: true });
        discover();
    };
})();
