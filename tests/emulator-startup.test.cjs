const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(plans = []) {
    const requests = [], timers = new Map(), listeners = {};
    let id = 0;
    class XHR {
        constructor() { requests.push(this); }
        open(method, url) { this.method = method; this.url = url; }
        getResponseHeader() { return '12'; }
        send() {
            const plan = plans.shift();
            queueMicrotask(() => {
                if (plan === 'error') this.onerror();
                else if (plan === 'ok') { this.status = 200; this.response = 'bytes'; this.onload(); }
            });
        }
        abort() { this.aborted = true; this.onabort(); }
    }
    const context = {
        URL, XMLHttpRequest: XHR, location: { href: 'https://arcade.test/' },
        setTimeout: (callback, delay) => { timers.set(++id, { callback, delay }); return id; },
        clearTimeout: key => timers.delete(key),
        window: { addEventListener: (name, callback) => { listeners[name] = callback; } }
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(require.resolve('../js/emulator-startup.js'), 'utf8'), context);
    const emulator = { config: { dataPath: 'https://cdn.test/data/' }, storage: {}, downloadFile: () => 'native' };
    const install = () => context.window.prepareEmulatorStartup(emulator);
    const expire = delay => {
        for (const [key, timer] of timers) {
            if (timer.delay === delay) { timers.delete(key); timer.callback(); break; }
        }
    };
    return { context, emulator, requests, timers, listeners, install, expire };
}

test('failed HEAD falls back to GET instead of breaking the cache-validation chain', async () => {
    const env = setup(['error', 'ok']); env.install();
    const head = await env.emulator.downloadFile('roms/dino.zip', null, true, { method: 'HEAD' });
    assert.deepEqual(Object.keys(head.headers), []);
    const game = await env.emulator.downloadFile('roms/dino.zip', null, true, { method: 'GET', responseType: 'arraybuffer' });
    assert.equal(game.data, 'bytes');
    assert.equal(env.requests[1].responseType, 'arraybuffer');
    assert.equal(env.timers.size, 0);
});

test('interrupted GET retries once and resolves', async () => {
    const env = setup(['error', 'ok']); env.install();
    const game = await env.emulator.downloadFile('cores/fbneo.data', null, false, { method: 'GET' });
    assert.equal(game.data, 'bytes');
    assert.equal(env.requests.length, 2);
    assert.equal(env.requests[0].url, 'https://cdn.test/data/cores/fbneo.data');
});

test('persistent download failure is bounded to two attempts', async () => {
    const env = setup(['error', 'error']); env.install();
    assert.equal(await env.emulator.downloadFile('rom.zip', null, true, { method: 'GET' }), -1);
    assert.equal(env.requests.length, 2);
});

test('stalled HEAD is aborted and still permits startup to continue', async () => {
    const env = setup(); env.install();
    const result = env.emulator.downloadFile('rom.zip', null, true, { method: 'HEAD' });
    env.expire(2500);
    assert.deepEqual(Object.keys((await result).headers), []);
    assert.equal(env.requests[0].aborted, true);
});

test('blocked cache reads time out without changing saved data or storage writes', async () => {
    const env = setup(); const put = () => 'saved';
    env.emulator.storage.rom = { get: () => new Promise(() => {}), put };
    const states = { get: () => 'existing state' }; env.emulator.storage.states = states;
    env.install(); const result = env.emulator.storage.rom.get('dino.zip');
    await Promise.resolve(); env.expire(2000);
    assert.equal(await result, undefined);
    assert.equal(env.emulator.storage.rom.put, put);
    assert.equal(env.emulator.storage.states, states);
    assert.equal(env.timers.size, 0);
});

test('native File and blob handling remains available and installing guards twice is safe', async () => {
    const env = setup(); env.install(); const download = env.emulator.downloadFile; env.install();
    assert.equal(env.emulator.downloadFile, download);
    assert.equal(await download({}, null, true), 'native');
    assert.equal(await download('blob:https://arcade.test/rom', null, true), 'native');
    assert.equal(env.requests.length, 0);
});

test('touch resumes suspended Safari audio without resuming intentionally paused gameplay', () => {
    const env = setup(); let resumed = 0;
    const audio = { state: 'suspended', resume: () => { resumed++; return Promise.resolve(); } };
    env.context.window.EJS_emulator = { paused: true, Module: { AL: { currentCtx: { ctx: audio, sources: [{ gain: { context: audio } }] } } } };
    env.listeners.pointerdown();
    assert.equal(resumed, 1);
    assert.equal(env.context.window.EJS_emulator.paused, true);
});


test('Safari startup uses audio unlock without a blocking resume popup or polling loop', () => {
    const env = setup(); let resumed = 0;
    env.emulator.checkStarted = () => { throw new Error('legacy blocking popup'); };
    env.emulator.Module = { AL: { currentCtx: { ctx: { state: 'suspended', resume: () => { resumed++; return Promise.resolve(); } } } } };
    env.context.window.EJS_emulator = env.emulator;
    env.install(); env.emulator.checkStarted();
    assert.equal(resumed, 1);
    assert.equal(env.timers.size, 0);
});
