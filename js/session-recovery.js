/** Pause/resume the current document; saving and loading are manual only. */
window.setupSessionRecovery = (emulator, rom) => {
    if (emulator.dinoRecoveryInstalled || typeof rom !== 'string' || rom.startsWith('blob:')) return;
    emulator.dinoRecoveryInstalled = true;
    let pausedByApp = false;
    // Keep just the preceding session and the current sample, never an event log.
    // An unfinished session is evidence of an abrupt exit, not proof of its cause.
    const diagnosticKey = 'dino-session-diagnostics-v1';
    let previous = null;
    try { previous = JSON.parse(localStorage.getItem(diagnosticKey))?.current || null; } catch (_) {}
    const current = { started: Date.now(), phase: 'running', navigation: window.performance?.getEntriesByType?.('navigation')?.[0]?.type || 'unknown' };
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
    const suspend = () => {
        if (!emulator.started || window.dinoMultiplayer?.syncing) return;
        current.phase = 'backgrounded';
        releaseInputs();
        record();
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
    emulator.on?.('exit', () => { current.phase = 'exited'; record(); });
};
