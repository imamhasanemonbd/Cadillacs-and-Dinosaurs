const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(storage = new Map()) {
    const events = {}, timers = [], calls = [];
    const localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
    const emulator = {
        started: true, paused: false,
        gameManager: { getState: () => new Uint8Array([1, 2, 3]), loadState: state => calls.push(['load', [...state]]), simulateInput() {}, restart: () => calls.push(['restart']) },
        pause() { this.paused = true; calls.push(['pause']); }, play() { this.paused = false; calls.push(['play']); }, on() {}
    };
    const context = { localStorage, Uint8Array, Date, btoa: text => Buffer.from(text, 'binary').toString('base64'), atob: text => Buffer.from(text, 'base64').toString('binary'),
        setInterval: callback => { timers.push(callback); return timers.length; }, clearInterval() {},
        document: { hidden: false, addEventListener: (name, callback) => { events[name] = callback; } },
        window: { addEventListener: (name, callback) => { events[name] = callback; } }
    };
    vm.createContext(context); vm.runInContext(fs.readFileSync(require.resolve('../js/session-recovery.js'), 'utf8'), context);
    context.window.setupSessionRecovery(emulator, 'roms/dino.zip');
    return { context, emulator, events, timers, calls, storage, localStorage };
}
test('old recovery checkpoints are ignored and no automatic save timer exists', () => {
    const storage = new Map([['dino-game-recovery-v1', JSON.stringify({rom:'roms/dino.zip',version:'4.2.3',time:Date.now(),data:'AQID'})]]);
    const env = setup(storage);
    assert.deepEqual(env.calls,[]);
    assert.equal(env.timers.length,0);
    assert.equal(storage.has('dino-game-recovery-v1'),true);
});
test('background pause and foreground resume never save or load progress', () => {
    const env = setup();
    env.emulator.gameManager.getState = () => {throw new Error('No automatic saves');};
    env.context.document.hidden = true; env.events.visibilitychange(); env.events.pagehide();
    assert.equal(env.emulator.paused,true);
    env.context.document.hidden = false; env.events.visibilitychange(); env.events.pageshow();
    assert.deepEqual(env.calls,[['pause'],['play']]);
    assert.equal(env.storage.has('dino-game-recovery-v1'),false);
});
test('a manual pause remains paused across background transitions', () => {
    const env = setup(); env.emulator.paused = true;
    env.events.pagehide(); env.events.pageshow();
    assert.equal(env.emulator.paused,true); assert.deepEqual(env.calls,[]);
});
test('lifecycle handling does not pause or resume synchronized multiplayer', () => {
    const env = setup(); env.context.window.dinoMultiplayer = {syncing:true};
    env.events.pagehide(); env.events.pageshow(); assert.deepEqual(env.calls,[]);
});
test('duplicate setup is harmless and restart remains native', () => {
    const env = setup(); const restart = env.emulator.gameManager.restart;
    env.context.window.setupSessionRecovery(env.emulator,'roms/dino.zip');
    assert.equal(env.emulator.gameManager.restart,restart); assert.equal(env.timers.length,0);
});
test('runtime errors are recorded without saving progress', () => {
    const env = setup(); env.events.error({message:'runtime failed'});
    assert.equal(env.context.window.dinoSessionDiagnostics.current.error,'runtime failed');
    assert.equal(env.storage.has('dino-game-recovery-v1'),false);
});
