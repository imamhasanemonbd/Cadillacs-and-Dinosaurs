/** Startup guards for the pinned EmulatorJS 4.2.3 runtime. */
(() => {
    const withDeadline = (operation, milliseconds, fallback) => new Promise(resolve => {
        let settled = false;
        const finish = value => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
        };
        const timer = setTimeout(() => finish(fallback), milliseconds);
        Promise.resolve().then(operation).then(finish, () => finish(fallback));
    });

    // Start from empty core save RAM every visit. Manual Save State / Load State
    // uses EmulatorJS.storage.states separately and remains persistent.
    const useMemorySaveStorage = module => {
        const filesystems = module.FS?.filesystems;
        if (!filesystems?.MEMFS) return;
        filesystems.IDBFS = filesystems.MEMFS;
        module.dinoSaveStorage = 'memory-only';
    };

    const setupProgress = emulator => {
        const parent = emulator.elements?.parent;
        if (!parent || typeof document === 'undefined') return;
        const panel = document.createElement('div');
        panel.className = 'dino-startup-progress'; panel.hidden = true;
        panel.setAttribute('role', 'status'); panel.setAttribute('aria-live', 'polite');
        const spinner = document.createElement('span'); spinner.className = 'dino-startup-spinner'; spinner.setAttribute('aria-hidden', 'true');
        const label = document.createElement('strong'), detail = document.createElement('span');
        panel.append(spinner, label, detail); parent.appendChild(panel);
        let timer, began = 0, finished = false, lastText = '', firstFrame = null, waitingForFrames = false;
        const status = window.dinoStartupStatus = { phase: 'loading', frame: null, graphicsLost: false };
        const tick = () => {
            const seconds = Math.floor((Date.now() - began) / 1000);
            if (waitingForFrames && seconds >= 15) {
                detail.textContent = `${seconds}s · Game files loaded, but the engine is not advancing frames. This is not a download delay.`;
                return;
            }
            detail.textContent = seconds < 15 ? `${seconds}s · Please wait` : `${seconds}s · This step is taking longer than usual. If it stays here, check your connection.`;
        };
        const show = text => {
            if (finished) return;
            if (label.textContent !== text) { began = Date.now(); label.textContent = text; }
            status.phase = text;
            panel.hidden = false; parent.classList.add('dino-starting'); tick();
            if (emulator.textElem) observer.observe(emulator.textElem, {childList:true, characterData:true, subtree:true});
            if (!timer) timer = setInterval(tick, 1000);
        };
        const finish = () => {
            if (finished || !emulator.started || status.graphicsLost) return;
            if (!waitingForFrames) { waitingForFrames = true; show('Waiting for game frames…'); }
            const frame = emulator.gameManager?.getFrameNum?.();
            status.frame = Number.isFinite(frame) ? frame : null;
            if (!Number.isFinite(frame)) return;
            if (firstFrame === null) firstFrame = frame;
            if (frame < firstFrame + 2) return;
            status.phase = 'running';
            finished = true; clearInterval(timer); observer?.disconnect();
            parent.classList.remove('dino-starting'); panel.remove();
            window.dispatchEvent(new Event('dino-startup-status'));
        };
        const observer = new MutationObserver(() => {
            const text = emulator.textElem?.textContent?.trim();
            if (text && text !== lastText && !panel.hidden) { lastText = text; show(text); }
        });
        const error = emulator.startGameError;
        if (typeof error === 'function') emulator.startGameError = function(message, ...args) {
            show(message || 'Game could not start.'); clearInterval(timer); observer?.disconnect();
            panel.classList.add('is-error'); detail.textContent = 'Check your connection and try again.';
            return error.call(this, message, ...args);
        };
        // Paint the stage label before synchronous script/core initialization.
        for (const [name, text] of [['initGameCore', 'Preparing game core…'], ['startGame', 'Starting game…']]) {
            const original = emulator[name];
            if (typeof original !== 'function') continue;
            emulator[name] = function(...args) {
                show(text);
                requestAnimationFrame(() => setTimeout(() => original.apply(this, args), 0));
            };
        }
        emulator.canvas?.addEventListener('webglcontextlost', () => {
            status.graphicsLost = true; status.phase = 'graphics-context-lost';
            // Keep a visible explanation even if the loading panel was removed.
            finished = false; waitingForFrames = false;
            if (!panel.isConnected) parent.appendChild(panel);
            show('The graphics renderer was interrupted.');
            status.phase = 'graphics-context-lost';
            panel.classList.add('is-error'); clearInterval(timer); timer = null;
            detail.textContent = 'The browser lost the game graphics. No automatic reload will occur.';
            window.dispatchEvent(new Event('dino-startup-status'));
        });
        emulator.canvas?.addEventListener('webglcontextrestored', () => {
            status.graphicsLost = false; firstFrame = null; panel.classList.remove('is-error');
            show('Graphics restored. Waiting for game frames…');
        });
        emulator.on?.('start', () => {
            waitingForFrames = true;
            const frame = emulator.gameManager?.getFrameNum?.();
            firstFrame = Number.isFinite(frame) ? frame : null;
            status.frame = firstFrame;
            show('Waiting for game frames…');
            // resumeMainLoop alone doesn't clear RetroArch's separate pause flag.
            if (!document.hidden && !emulator.paused && !window.dinoMultiplayer?.busy) {
                emulator.gameManager?.toggleMainLoop?.(1);
            }
        });
        emulator.dinoStartupProgress = { show, finish };
    };

    window.prepareEmulatorStartup = emulator => {
        if (emulator.dinoStartupPrepared) return;
        emulator.dinoStartupPrepared = true;
        setupProgress(emulator);
        // The pinned runtime polls Safari audio every 10 ms behind a blocking
        // resume popup. Keep autoplay visible and unlock audio on existing controls.
        emulator.checkStarted = resumeAudio;
        // Emscripten captures these callbacks during runtime creation. Install
        // stable dispatchers now so LAN play can attach frame hooks later.
        if (typeof emulator.initModule === 'function') {
            const init = emulator.initModule;
            emulator.initModule = function(...args) {
                const runtime = window.EJS_Runtime;
                window.EJS_Runtime = options => {
                    let module;
                    if (emulator.textElem) emulator.textElem.textContent = 'Initializing game core…';
                    emulator.dinoStartupProgress?.show('Initializing game core…');
                    return runtime({ ...options,
                        preMainLoop: () => options.preMainLoop?.() === false ? false : module?.dinoPreFrame?.(),
                        postMainLoop: () => { options.postMainLoop?.(); module?.dinoPostFrame?.(); emulator.dinoStartupProgress?.finish(); }
                    }).then(result => {
                        module = result; module.dinoFrameHooks = true;
                        useMemorySaveStorage(module);
                        if (emulator.textElem) emulator.textElem.textContent = 'Loading game data…';
                        emulator.dinoStartupProgress?.show('Loading game data…');
                        return module;
                    });
                };
                try { return init.apply(this, args); }
                finally { window.EJS_Runtime = runtime; }
            };
        }
        // Cache reads are optional. A blocked IndexedDB request must not stop boot.
        // Writes and save-state storage stay untouched, preserving existing saves.
        for (const name of ['core', 'rom', 'bios']) {
            const store = emulator.storage?.[name];
            if (!store) continue;
            const get = store.get.bind(store);
            store.get = key => withDeadline(() => get(key), 2000, undefined);
        }
        const originalDownload = emulator.downloadFile.bind(emulator);
        emulator.downloadFile = async (path, progress, direct, options = {}) => {
            // Keep native handling of File/Blob/ArrayBuffer and other protocols.
            if (typeof path !== 'string') return originalDownload(path, progress, direct, options);
            let url = direct ? path : emulator.config.dataPath + path;
            if (!direct && emulator.config.filePaths?.[path.split('/').pop()]) url = emulator.config.filePaths[path.split('/').pop()];
            try { url = new URL(url, location.href); } catch (_) { return originalDownload(path, progress, direct, options); }
            if (!['http:', 'https:'].includes(url.protocol)) return originalDownload(path, progress, direct, options);
            const head = options.method === 'HEAD';
            const request = () => new Promise(resolve => {
                const xhr = new XMLHttpRequest();
                let idleTimer;
                const finish = result => { clearTimeout(idleTimer); resolve(result); };
                const keepAlive = () => {
                    clearTimeout(idleTimer);
                    // A slow connection can keep downloading; abort only when idle.
                    idleTimer = setTimeout(() => xhr.abort(), head ? 2500 : 20000);
                };
                xhr.open(options.method || 'GET', url.href, true);
                if (options.responseType) xhr.responseType = options.responseType;
                xhr.timeout = head ? 3000 : 180000;
                xhr.onprogress = event => {
                    keepAlive();
                    if (typeof progress === 'function') {
                        const amount = event.lengthComputable && event.total
                            ? ` ${Math.floor(event.loaded / event.total * 100)}%`
                            : ` ${(event.loaded / 1048576).toFixed(2)}MB`;
                        progress(amount);
                    }
                };
                xhr.onload = () => {
                    if (xhr.status < 200 || xhr.status >= 300) return finish(-1);
                    let data = xhr.response;
                    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) {} }
                    finish({ data, headers: { 'content-length': xhr.getResponseHeader('content-length') } });
                };
                xhr.onerror = xhr.ontimeout = xhr.onabort = () => finish(-1);
                keepAlive();
                xhr.send();
            });
            let result = await request();
            // HEAD only validates cache. Always allow the following GET on failure.
            if (head) return result === -1 ? { headers: {} } : result;
            if (result === -1) result = await request();
            return result;
        };
    };

    // Safari may suspend audio on automatic launch. Resume during a real gesture;
    // this does not change pause state or require a new Play button.
    const resumeAudio = () => {
        const module = window.EJS_emulator?.Module;
        const contexts = new Set();
        const audio = module?.AL?.currentCtx;
        if (audio?.ctx) contexts.add(audio.ctx);
        if (audio?.audioCtx) contexts.add(audio.audioCtx);
        audio?.sources?.forEach(source => { if (source?.gain?.context) contexts.add(source.gain.context); });
        if (module?.SDL?.audioContext) contexts.add(module.SDL.audioContext);
        for (const context of contexts) {
            if (context.state === 'suspended') {
                try { context.resume()?.catch(() => {}); } catch (_) {}
            }
        }
    };
    window.addEventListener('pointerdown', resumeAudio, { capture: true });
    window.addEventListener('touchend', resumeAudio, { capture: true, passive: true });
    window.addEventListener('keydown', resumeAudio, { capture: true });
})();
