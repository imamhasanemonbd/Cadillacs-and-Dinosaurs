/** Recover the current game after a mobile OS discards the web app process. */
window.setupSessionRecovery = (emulator, rom) => {
    if (emulator.dinoRecoveryInstalled || typeof rom !== 'string' || rom.startsWith('blob:')) return;
    emulator.dinoRecoveryInstalled = true;
    const key = 'dino-game-recovery-v1';
    const maxBytes = 2 * 1024 * 1024;
    let pausedByApp = false;
    // Keep just the preceding session and the current sample, never an event log.
    // An unfinished session is evidence of an abrupt exit, not proof of its cause.
    const diagnosticKey = 'dino-session-diagnostics-v1';
    let previous = null;
    try { previous = JSON.parse(localStorage.getItem(diagnosticKey))?.current || null; } catch (_) {}
    const current = { started: Date.now(), phase: 'running', navigation: window.performance?.getEntriesByType?.('navigation')?.[0]?.type || 'unknown', checkpoint: null, restored: false };
    const diagnostics = window.dinoSessionDiagnostics = { previous, current };
    const record = () => {
        current.sampled = Date.now();
        current.wasmBytes = emulator.Module?.HEAPU8?.byteLength || null;
        current.saveStorage = emulator.Module?.dinoSaveStorage || 'unknown';
        try { localStorage.setItem(diagnosticKey, JSON.stringify(diagnostics)); } catch (_) {}
    };
    const errorText = error => String(error?.message || error || 'Unknown error').slice(0, 512);
    window.addEventListener('error', event => { current.error = errorText(event.error || event.message); record(); });
    window.addEventListener('unhandledrejection', event => { current.error = errorText(event.reason); record(); });
    record();
    const releaseInputs = () => {
        window.virtualArcadeControls?.releaseAll();
        for (let index = 0; index <= 8; index++) emulator.gameManager.simulateInput(0, index, 0);
        const app = window.dinoApp;
        app?.pressedKeys?.clear();
        if (app?.buttonRefCounts) Object.keys(app.buttonRefCounts).forEach(index => { app.buttonRefCounts[index] = 0; });
    };
    const save = () => {
        if (!emulator.started || window.dinoMultiplayer?.syncing) return;
        try {
            const state = emulator.gameManager.getState();
            if (!state?.length || state.length > maxBytes) return;
            let binary = '';
            for (let offset = 0; offset < state.length; offset += 8192) {
                binary += String.fromCharCode(...state.subarray(offset, offset + 8192));
            }
            localStorage.setItem(key, JSON.stringify({ rom, version: '4.2.3', time: Date.now(), data: btoa(binary) }));
            current.checkpoint = Date.now(); current.checkpointBytes = state.length;
            delete current.storageError;
            record();
        } catch (error) {
            current.storageError = errorText(error); record();
            // Storage limits must never interrupt a running game.
        }
    };
    try {
        const record = JSON.parse(localStorage.getItem(key));
        if (record?.rom === rom && record.version === '4.2.3' && Date.now() - record.time < 86400000 &&
            typeof record.data === 'string' && record.data.length <= Math.ceil(maxBytes / 3) * 4) {
            const bytes = Uint8Array.from(atob(record.data), char => char.charCodeAt(0));
            if (bytes.length) {
                emulator.gameManager.loadState(bytes);
                releaseInputs();
                current.restored = true; current.restoredCheckpoint = record.time;
            }
        }
    } catch (_) {
        // Ignore invalid recovery data; manual save states remain untouched.
    }
    record();
    // An intentional restart from the native menu starts a fresh session.
    if (typeof emulator.gameManager.restart === 'function') {
        const restart = emulator.gameManager.restart.bind(emulator.gameManager);
        emulator.gameManager.restart = (...args) => {
            try { localStorage.removeItem(key); } catch (_) {}
            return restart(...args);
        };
    }
    const suspend = () => {
        if (!emulator.started || window.dinoMultiplayer?.syncing) return;
        current.phase = 'backgrounded';
        releaseInputs();
        save();
        if (!emulator.paused) { emulator.pause(true); pausedByApp = true; }
    };
    const resume = () => {
        if (window.dinoMultiplayer?.syncing) return;
        current.phase = 'running'; record();
        if (pausedByApp) { pausedByApp = false; emulator.play(true); }
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); else resume(); });
    window.addEventListener('pagehide', () => { current.pagehideAt = Date.now(); record(); suspend(); });
    window.addEventListener('pageshow', resume);
    // Periodic checkpoints cover process termination without a lifecycle event.
    const timer = setInterval(() => { if (!document.hidden && !emulator.paused) save(); }, 5000);
    emulator.on?.('exit', () => { clearInterval(timer); current.phase = 'exited'; record(); });
};
