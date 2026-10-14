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
test('checkpoints recover game progress after a new document is created', () => {
    const original = setup(); original.timers[0]();
    const reopened = setup(original.storage);
    assert.deepEqual(reopened.calls[0], ['load', [1, 2, 3]]);
    assert.equal(reopened.timers.length, 1);
});
test('backgrounding saves and pauses, foregrounding resumes without reinitializing', () => {
    const env = setup(); env.context.document.hidden = true; env.events.visibilitychange();
    assert.equal(env.storage.size, 1); assert.equal(env.emulator.paused, true);
    env.events.pagehide(); env.context.document.hidden = false; env.events.visibilitychange(); env.events.pageshow();
    assert.deepEqual(env.calls, [['pause'], ['play']]);
});
test('manual pause remains paused across background transitions', () => {
    const env = setup(); env.emulator.paused = true;
    env.events.pagehide(); env.events.pageshow(); assert.equal(env.emulator.paused, true); assert.deepEqual(env.calls, []);
});
test('storage failure and oversized snapshots cannot stop gameplay', () => {
    const env = setup(); env.localStorage.setItem = () => { throw new Error('quota'); };
    assert.doesNotThrow(env.timers[0]); env.emulator.gameManager.getState = () => new Uint8Array(3 * 1024 * 1024);
    assert.doesNotThrow(env.timers[0]); assert.equal(env.emulator.paused, false);
});
test('expired and mismatched ROM recovery does not overwrite the current game', () => {
    const first = setup(); first.timers[0](); const key = 'dino-game-recovery-v1';
    let record = JSON.parse(first.storage.get(key)); record.time = 0; first.storage.set(key, JSON.stringify(record));
    assert.deepEqual(setup(first.storage).calls, []);
    record.time = Date.now(); record.rom = 'different.zip'; first.storage.set(key, JSON.stringify(record));
    assert.deepEqual(setup(first.storage).calls, []);
});
test('duplicate setup never creates another checkpoint timer', () => {
    const env = setup(); env.context.window.setupSessionRecovery(env.emulator, 'roms/dino.zip');
    assert.equal(env.timers.length, 1);
});

test('an intentional native restart clears the old recovery checkpoint', () => {
    const env = setup(); env.timers[0](); assert.equal(env.storage.size, 1);
    env.emulator.gameManager.restart(); assert.equal(env.storage.size, 0);
    assert.deepEqual(env.calls, [['restart']]);
});

test('local recovery never saves, pauses, or resumes an active multiplayer session', () => {
    const env = setup(); env.context.window.dinoMultiplayer = { busy: true, syncing: true };
    env.timers[0](); env.events.pagehide(); env.events.pageshow();
    assert.equal(env.storage.size, 0); assert.deepEqual(env.calls, []);
});

test('pending pairing retains normal background pause and recovery', () => {
    const env = setup(); env.context.window.dinoMultiplayer = { busy: true, syncing: false };
    env.context.document.hidden = true; env.events.visibilitychange();
    assert.equal(env.emulator.paused, true);
    env.context.document.hidden = false; env.events.visibilitychange();
    assert.equal(env.emulator.paused, false);
});
