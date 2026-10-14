/** Serverless copy/paste pairing. Two-player LAN synchronization prototype. */
(() => {
    const BUILD = '4.2.3:08f524a10263a86a61de60cb9a143ffec508bb2f9d770c9cea9029fc716c273f';
    const hash = bytes => {
        let result = 2166136261;
        for (const byte of bytes) result = Math.imul(result ^ byte, 16777619);
        return (result >>> 0).toString(16);
    };
    const encode = record => 'DINO1.' + btoa(JSON.stringify(record));
    const decode = (text, type) => {
        const code = text.trim().replace(/\s/g, '');
        if (!code.startsWith('DINO1.') || code.length > 65536) throw new Error('Paste the complete DINO1 connection code.');
        let data;
        try { data = JSON.parse(atob(code.slice(6))); } catch (_) { throw new Error('That connection code is incomplete or invalid.'); }
        if (data.build !== BUILD) throw new Error('Game versions differ. Leave and reload both devices before pairing.');
        if (data.type !== type || typeof data.sdp !== 'string' || typeof data.room !== 'string') throw new Error(`Expected a ${type === 'offer' ? 'host' : 'reply'} code.`);
        if (!Number.isFinite(data.time) || Date.now() - data.time > 600000) throw new Error('This code expired. Create a new connection.');
        return data;
    };
    window.setupMultiplayer = emulator => {
        if (window.dinoMultiplayer) return;
        const gm = emulator.gameManager;
        const toggle = emulator.togglePlaying.bind(emulator);
        const native = {
            input: gm.simulateInput.bind(gm), load: gm.loadState.bind(gm),
            pause: () => { if (!emulator.paused) toggle(true); },
            play: () => { if (emulator.paused) toggle(true); }
        };
        // Game-specific RAM-prefix check for the tested dino/FBNeo state layout.
        // The full state includes device-timed audio mixer history, which differs
        // without gameplay drift. This checks the first 256 KiB (frame metadata,
        // video RAM and main RAM prefix), not proof of full-core determinism.
        const fingerprint = () => hash(gm.getState().subarray(0, 0x40000));
        const settingsSignature = () => {
            const values = { ...emulator.defaultCoreOpts?.settings };
            for (const [key, value] of Object.entries(emulator.settings || {})) if (/^(fbneo|fba)[-_]/.test(key)) values[key] = value;
            return hash(new TextEncoder().encode(JSON.stringify(Object.entries(values).sort(([a], [b]) => a.localeCompare(b)))));
        };
        const state = window.dinoMultiplayer = { busy: false, active: false, role: null, peer: null, channel: null, loop: null, epoch: 0 };
        let closing = false, ready = false, remotePaused = false, pendingState = null;
        let chunks = [], received = 0, priorPre, priorPost, didRun = false, prime = null;
        let heartbeat, connectionTimer, snapshotTimer, gatheringCancel, operation = 0;
        let hashes = new Map(), remoteHashes = new Map(), resyncs = 0;
        const guarded = [];
        const open = document.createElement('button');
        open.id = 'multiplayer-open'; open.type = 'button'; open.textContent = '2P Connect';
        const dialog = document.createElement('dialog'); dialog.id = 'multiplayer-dialog';
        dialog.innerHTML = `<form method="dialog"><header><strong>Two-player Wi-Fi test</strong><button aria-label="Close multiplayer panel">×</button></header></form>
            <p>Use the same Wi-Fi or hotspot. Both devices need the full game loaded. Exchange codes using Messages or another app; no camera or paid server needed.</p>
            <p class="multiplayer-status" role="status">Ready to pair. Host is Player 1; guest is Player 2.</p>
            <div class="multiplayer-actions"><button data-mp="create">Create game (host)</button><button data-mp="join">Join with host code</button><button data-mp="finish">Accept reply (host)</button></div>
            <label>Paste a host code or reply code<textarea id="multiplayer-input" rows="3" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="DINO1.…"></textarea></label>
            <label>Your code — send all of it to the other player<textarea id="multiplayer-output" rows="3" readonly spellcheck="false"></textarea></label>
            <div class="multiplayer-actions"><button data-mp="copy">Copy code</button><button data-mp="resync">Resync (host)</button><button data-mp="leave">Leave / cancel pairing</button></div>
            <small>1. Host creates and sends a code. 2. Guest pastes it, taps Join, and sends the reply. 3. Host pastes the reply and taps Accept. Close this panel to play. Coin and Start apply to your own player. If a device is backgrounded, both games wait. This two-player test buffers 3 frames (about 50 ms at 60 FPS). Slow connections can pause play. Native settings, cheats and save loads are locked until you Leave.</small>`;
        document.body.append(open, dialog);
        const input = dialog.querySelector('#multiplayer-input'), output = dialog.querySelector('#multiplayer-output');
        const status = dialog.querySelector('[role=status]');
        const say = message => { status.textContent = message; open.title = message; };
        const send = data => {
            if (state.channel?.readyState !== 'open') return false;
            if (state.channel.bufferedAmount > 512 * 1024) { fail('Connection is too slow. Leave and pair again on the same Wi-Fi.'); return false; }
            try { state.channel.send(JSON.stringify(data)); return true; }
            catch (_) { fail('Connection closed. Leave and pair again.'); return false; }
        };
        const release = () => {
            if (state.loop) { state.loop.mask = 0; state.loop.pulses = 0; }
            for (let player = 0; player < 2; player++) for (let index = 0; index <= 8; index++) gm.functions.simulateInput(player, index, 0);
            window.dinoApp?.pressedKeys?.clear();
            if (window.dinoApp?.buttonRefCounts) Object.keys(window.dinoApp.buttonRefCounts).forEach(index => { window.dinoApp.buttonRefCounts[index] = 0; });
        };
        const fail = message => {
            ready = false; state.active = false;
            say(message); open.textContent = '2P · Paused';
        };
        const guard = (object, name) => {
            if (typeof object[name] !== 'function') return;
            const original = object[name]; guarded.push(() => { object[name] = original; });
            object[name] = (...args) => state.busy ? undefined : original.apply(object, args);
        };
        const install = role => {
            if (gm.getState().length !== 275792) throw new Error('The emulator state format changed. This multiplayer test needs an update.');
            if (!emulator.Module.dinoFrameHooks) throw new Error('Reload this device to enable synchronized frame support.');
            if (state.busy) throw new Error('Leave the current connection before creating another.');
            if (emulator.isFastForward || emulator.isSlowMotion || emulator.rewindEnabled) throw new Error('Disable fast-forward, slow motion and rewind before pairing.');
            if (window.dinoApp?.cheats.immortal || window.dinoApp?.cheats.ammo || emulator.cheats?.some(cheat => cheat.checked)) throw new Error('Turn off cheats before pairing.');
            state.busy = true; state.role = role; state.epoch = 0; closing = false;
            document.documentElement.classList.add('multiplayer-active');
            native.pause(true); release();
            priorPre = emulator.Module.dinoPreFrame; priorPost = emulator.Module.dinoPostFrame;
            emulator.Module.dinoPreFrame = () => {
                didRun = false;
                if (prime) return true;
                if (!ready || remotePaused || document.hidden || !state.active) return false;
                if (priorPre?.() === false) return false;
                didRun = state.loop.before();
                return didRun;
            };
            emulator.Module.dinoPostFrame = () => {
                if (prime) {
                    const callback = prime; prime = null; native.pause(true);
                    try { callback(); } catch (error) { send({ t: 'stop' }); fail(error.message); }
                    return;
                }
                if (!didRun) return;
                priorPost?.(); state.loop.after();
                if (state.loop.frame % 120 === 0) {
                    const frame = state.loop.frame, digest = fingerprint();
                    hashes.set(frame, digest); send({ t: 'hash', epoch: state.epoch, frame, digest });
                    compare(frame);
                    for (const key of hashes.keys()) if (key < frame - 600) { hashes.delete(key); remoteHashes.delete(key); }
                }
            };
            gm.simulateInput = (player, index, value) => {
                if (!state.busy) return native.input(player, index, value);
                if (!Number.isInteger(index) || index < 0 || index > 8 || !state.loop) return;
                if (value) {
                    state.loop.mask |= 1 << index;
                    if ([0, 2, 3, 8].includes(index)) state.loop.pulses |= 1 << index;
                } else state.loop.mask &= ~(1 << index);
            };
            const menu = emulator.elements.menu;
            const inert = menu.inert; menu.inert = true; guarded.push(() => { menu.inert = inert; });
            for (const name of ['restart', 'loadState', 'quickLoad']) guard(gm, name);
            for (const name of ['pause', 'play', 'togglePlaying', 'cheatChanged', 'changeSettingOption']) guard(emulator, name);
        };
        const resetLoop = () => {
            hashes = new Map(); remoteHashes = new Map(); state.lastVerifiedFrame = 0;
            state.loop = new window.DinoLockstep(
                (frame, mask) => send({ t: 'input', epoch: state.epoch, frame, mask }),
                (local, remote) => {
                    const masks = state.role === 'host' ? [local, remote] : [remote, local];
                    for (let player = 0; player < 2; player++) for (let index = 0; index <= 8; index++) gm.functions.simulateInput(player, index, (masks[player] >> index) & 1);
                });
        };
        const compare = frame => {
            if (!hashes.has(frame) || !remoteHashes.has(frame)) return;
            if (hashes.get(frame) === remoteHashes.get(frame)) { state.lastVerifiedFrame = frame; return; }
            ready = false;
            say('State mismatch detected. Resynchronizing…');
            if (state.role === 'host') {
                if (++resyncs > 3) { send({ t: 'stop' }); fail('Devices repeatedly diverged. Leave this test; this device combination needs further work.'); }
                else snapshot().catch(error => fail(error.message));
            } else send({ t: 'resync' });
        };
        const waitBuffer = channel => new Promise((resolve, reject) => {
            if (channel.bufferedAmount < 128 * 1024) return resolve();
            channel.bufferedAmountLowThreshold = 64 * 1024;
            const finish = error => { clearTimeout(timer); channel.removeEventListener('bufferedamountlow', low); error ? reject(error) : resolve(); };
            const low = () => finish();
            const timer = setTimeout(() => finish(new Error('State transfer timed out. Leave and pair again.')), 10000);
            channel.addEventListener('bufferedamountlow', low, { once: true });
        });
        let transferring = false;
        const snapshot = async () => {
            if (transferring) return;
            transferring = true;
            const transferOperation = operation, channel = state.channel;
            try {
                ready = false; state.active = false; native.pause(true); release();
                const bytes = gm.getState();
                if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error('This game state is too large to synchronize.');
                state.epoch++; resetLoop();
                send({ t: 'state', epoch: state.epoch, size: bytes.length, digest: hash(bytes) });
                for (let offset = 0; offset < bytes.length; offset += 16384) {
                    await waitBuffer(channel);
                    if (operation !== transferOperation || state.channel !== channel) return;
                    if (closing || state.channel?.readyState !== 'open') throw new Error('Connection closed during synchronization.');
                    channel.send(bytes.slice(offset, offset + 16384));
                }
                say('Game state sent. Waiting for the other player…');
            } finally { if (operation === transferOperation) transferring = false; }
        };
        const begin = () => {
            ready = true; state.active = true;
            native.play(true);
            open.textContent = state.role === 'host' ? 'P1 · Connected' : 'P2 · Connected';
            say('Connected directly. Close this panel and use Coin / Start to join the game.');
            clearTimeout(connectionTimer);
            const start = document.getElementById('btn-start-p1');
            start.setAttribute('aria-label', state.role === 'host' ? 'Start player one' : 'Start player two');
            start.title = state.role === 'host' ? '1P Start (1 / Enter)' : '2P Start (1 / Enter)';
        };
        const receive = async event => {
            const receiveOperation = operation;
            if (closing || !state.busy) return;
            try {
                if (typeof event.data !== 'string') {
                    if (state.role !== 'guest' || !pendingState) throw new Error('Unexpected game state data.');
                    const data = new Uint8Array(event.data instanceof Blob ? await event.data.arrayBuffer() : event.data);
                    received += data.length;
                    if (received > pendingState.size) throw new Error('Invalid state transfer.');
                    chunks.push(data);
                    if (received === pendingState.size) {
                        const bytes = new Uint8Array(received); let offset = 0;
                        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
                        if (hash(bytes) !== pendingState.digest) throw new Error('Game state transfer was damaged. Pair again.');
                        native.load(bytes);
                        const expected = pendingState.digest;
                        resetLoop(); release(); pendingState = null; chunks = [];
                        // RetroArch applies a queued load on its next frontend
                        // iteration. Let it finish while paused, before frame zero.
                        prime = () => {
                            if (hash(gm.getState()) !== expected) { send({ t: 'stop' }); fail('The initial game state did not load. Leave and pair again.'); return; }
                            clearTimeout(snapshotTimer); send({ t: 'ready', epoch: state.epoch });
                        };
                        native.play(true);
                    }
                    return;
                }
                if (event.data.length > 8192) throw new Error('Invalid multiplayer message.');
                const message = JSON.parse(event.data);
                if (message.t === 'hello') {
                    if (message.build !== BUILD) throw new Error('Game versions differ. Reload both devices.');
                    if (message.settings !== settingsSignature()) throw new Error('Emulator core settings differ. Use matching defaults on both devices and pair again.');
                    if (state.role === 'host') await snapshot();
                } else if (message.t === 'state' && state.role === 'guest') {
                    if (!Number.isSafeInteger(message.size) || message.size < 1 || message.size > 2 * 1024 * 1024 || !Number.isSafeInteger(message.epoch)) throw new Error('Invalid game state.');
                    ready = false; state.active = false; native.pause(true); state.epoch = message.epoch;
                    pendingState = message; received = 0; chunks = [];
                    clearTimeout(snapshotTimer); snapshotTimer = setTimeout(() => fail('State transfer stalled. Leave and pair again.'), 15000);
                } else if (message.t === 'ready' && state.role === 'host' && message.epoch === state.epoch) {
                    send({ t: 'go', epoch: state.epoch }); begin();
                } else if (message.t === 'go' && state.role === 'guest' && message.epoch === state.epoch) begin();
                else if (message.t === 'input' && message.epoch === state.epoch) state.loop?.receive(message.frame, message.mask);
                else if (message.t === 'hash' && message.epoch === state.epoch && Number.isSafeInteger(message.frame) && typeof message.digest === 'string' && message.frame >= Math.max(0, (state.loop?.frame || 0) - 600) && message.frame <= (state.loop?.frame || 0) + 240) {
                    remoteHashes.set(message.frame, message.digest); compare(message.frame);
                } else if (message.t === 'resync' && state.role === 'host' && ready && state.active) {
                    if (++resyncs > 3) { send({ t: 'stop' }); fail('Repeated synchronization failures. Leave and pair again.'); }
                    else await snapshot();
                } else if (message.t === 'paused') {
                    remotePaused = !!message.value;
                    if (remotePaused) say('The other device is backgrounded. Waiting without restarting.');
                    else say('Other device returned. Continuing the same game.');
                } else if (message.t === 'ping') send({ t: 'pong', at: message.at });
                else if (message.t === 'pong' && Number.isFinite(message.at)) {
                    const latency = Math.round(performance.now() - message.at);
                    if (state.active && !remotePaused) open.textContent = `${state.role === 'host' ? 'P1' : 'P2'} · ${latency} ms RTT`;
                } else if (message.t === 'stop') fail('Synchronization stopped. Leave and pair again.');
            } catch (error) { if (receiveOperation === operation) { send({ t: 'stop' }); fail(error.message); } }
        };
        const wire = channel => {
            state.channel = channel; channel.binaryType = 'arraybuffer';
            let messages = Promise.resolve(), opened = false;
            channel.onmessage = event => { messages = messages.then(() => receive(event)); };
            const connected = () => {
                if (opened) return;
                opened = true;
                say('Direct connection established. Synchronizing the host’s game…');
                send({ t: 'hello', build: BUILD, settings: settingsSignature() });
                heartbeat = setInterval(() => send({ t: 'ping', at: performance.now() }), 2000);
            };
            channel.onopen = connected;
            if (channel.readyState === 'open') connected();
            channel.onclose = () => { if (!closing) { clearInterval(heartbeat); fail('Connection closed. Game paused; leave and pair again.'); } };
            channel.onerror = () => { if (!closing) fail('Direct connection failed. Try the same Wi-Fi and pair again.'); };
        };
        const peer = () => {
            const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
            state.peer = pc;
            pc.onconnectionstatechange = () => {
                if (!closing && ['failed', 'disconnected'].includes(pc.connectionState)) fail('Connection interrupted. Game paused; leave and pair again.');
            };
            connectionTimer = setTimeout(() => { if (!state.active) fail('Pairing timed out. Leave and create fresh codes on the same Wi-Fi.'); }, 600000);
            return pc;
        };
        const gather = pc => new Promise((resolve, reject) => {
            const done = () => {
                if (pc.iceGatheringState !== 'complete') return;
                clearTimeout(timer); pc.removeEventListener('icegatheringstatechange', done); gatheringCancel = null; resolve();
            };
            gatheringCancel = () => { clearTimeout(timer); pc.removeEventListener('icegatheringstatechange', done); reject(new Error('Pairing cancelled.')); };
            const timer = setTimeout(() => { pc.removeEventListener('icegatheringstatechange', done); gatheringCancel = null; resolve(); }, 10000);
            pc.addEventListener('icegatheringstatechange', done); done();
        });
        const code = pc => encode({ build: BUILD, room: state.room, time: Date.now(), type: pc.localDescription.type, sdp: pc.localDescription.sdp });
        const create = async () => {
            if (!window.RTCPeerConnection) throw new Error('This browser does not support direct multiplayer.');
            install('host'); state.room = crypto.randomUUID(); resyncs = 0;
            say('Preparing host code…'); const pc = peer(); wire(pc.createDataChannel('dino-inputs', { ordered: true }));
            await pc.setLocalDescription(await pc.createOffer()); await gather(pc);
            if (closing) return; output.value = code(pc); say('Send your code. Then paste the guest’s reply and tap Accept reply.');
        };
        const join = async () => {
            const offer = decode(input.value, 'offer'); install('guest'); state.room = offer.room; resyncs = 0;
            say('Preparing reply…'); const pc = peer(); pc.ondatachannel = event => { if (!state.channel) wire(event.channel); };
            await pc.setRemoteDescription({ type: offer.type, sdp: offer.sdp });
            await pc.setLocalDescription(await pc.createAnswer()); await gather(pc);
            if (closing) return; output.value = code(pc); say('Send this reply to the host. Keep this page open while they accept it.');
        };
        const accept = async () => {
            if (state.role !== 'host' || !state.peer) throw new Error('Create a host code first.');
            const reply = decode(input.value, 'answer');
            if (reply.room !== state.room) throw new Error('This reply belongs to another host code.');
            await state.peer.setRemoteDescription({ type: reply.type, sdp: reply.sdp });
            clearTimeout(connectionTimer);
            connectionTimer = setTimeout(() => { if (!state.active) fail('No direct connection was found. Leave and try the same Wi-Fi. This test has no relay fallback.'); }, 30000);
            say('Connecting directly…');
        };
        const leave = () => {
            operation++; closing = true; gatheringCancel?.();
            ready = false; prime = null; state.active = false; clearInterval(heartbeat); clearTimeout(connectionTimer); clearTimeout(snapshotTimer);
            state.channel?.close(); state.peer?.close();
            if (state.busy) {
                emulator.Module.dinoPreFrame = priorPre; emulator.Module.dinoPostFrame = priorPost;
                guarded.splice(0).forEach(restore => restore()); gm.simulateInput = native.input;
                release(); state.busy = false; native.play(true);
            }
            state.peer = null; state.channel = null; state.loop = null; pendingState = null; chunks = [];
            remotePaused = false; transferring = false;
            document.documentElement.classList.remove('multiplayer-active'); output.value = ''; input.value = '';
            document.getElementById('btn-start-p1').setAttribute('aria-label', 'Start player one');
            document.getElementById('btn-start-p1').title = '1P Start (1 / Enter)';
            open.textContent = '2P Connect'; say('Not connected. Create or join a new game.');
        };
        open.addEventListener('click', () => dialog.showModal());
        dialog.querySelectorAll('[data-mp]').forEach(button => button.addEventListener('click', async () => {
            const current = operation;
            try {
                if (button.dataset.mp === 'create') await create();
                if (button.dataset.mp === 'join') await join();
                if (button.dataset.mp === 'finish') await accept();
                if (button.dataset.mp === 'leave') leave();
                if (button.dataset.mp === 'resync') { if (state.role !== 'host' || !state.channel || state.channel.readyState !== 'open') throw new Error('Only a connected host can resynchronize.'); await snapshot(); }
                if (button.dataset.mp === 'copy') {
                    if (!output.value) throw new Error('Create or join first to generate a code.');
                    try { await navigator.clipboard.writeText(output.value); say('Code copied. Send the complete code to the other player.'); }
                    catch (_) { output.focus(); output.select(); say('Code selected. Use Copy, then send it to the other player.'); }
                }
            } catch (error) { if (current === operation) say(error.message); }
        }));
        // Game hotkeys use capture listeners; explicitly exclude this panel in app.js.
        for (const name of ['keydown', 'keyup', 'pointerdown', 'touchstart', 'touchend', 'click']) dialog.addEventListener(name, event => event.stopPropagation());
        document.addEventListener('visibilitychange', () => {
            if (!state.busy) return;
            if (document.hidden && state.loop) { state.loop.mask = 0; state.loop.pulses = 0; }
            send({ t: 'paused', value: document.hidden });
        });
        window.addEventListener('blur', () => { if (state.loop) state.loop.mask = 0; });
        state.leave = leave;
        state.resync = snapshot;
        state.hash = fingerprint;
    };
})();
