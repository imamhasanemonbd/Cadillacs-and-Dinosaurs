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

    window.prepareEmulatorStartup = emulator => {
        if (emulator.dinoStartupPrepared) return;
        emulator.dinoStartupPrepared = true;
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
                    return runtime({ ...options,
                        preMainLoop: () => options.preMainLoop?.() === false ? false : module?.dinoPreFrame?.(),
                        postMainLoop: () => { options.postMainLoop?.(); module?.dinoPostFrame?.(); }
                    }).then(result => { module = result; module.dinoFrameHooks = true; return module; });
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
