const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = { window: {} }; vm.createContext(context);
vm.runInContext(fs.readFileSync(require.resolve('../js/lockstep.js'), 'utf8'), context);
const Loop = context.window.DinoLockstep;

test('peers apply identical player inputs at identical frames with packet delay', () => {
    const sentA = [], sentB = [], appliedA = [], appliedB = [];
    const a = new Loop((f, m) => sentA.push([f, m]), (local, remote) => appliedA.push([a.frame, local, remote]));
    const b = new Loop((f, m) => sentB.push([f, m]), (local, remote) => appliedB.push([b.frame, remote, local]));
    for (let tick = 0; tick < 1000; tick++) {
        a.mask = tick < 80 ? 1 << 8 : 0; b.mask = tick > 20 && tick < 120 ? 1 << 7 : 0;
        if (a.before()) a.after(); if (b.before()) b.after();
        if (tick % 4 === 0) { while (sentA.length) b.receive(...sentA.shift()); while (sentB.length) a.receive(...sentB.shift()); }
    }
    const count = Math.min(appliedA.length, appliedB.length);
    assert(count > 500); assert.deepEqual(appliedA.slice(0, count), appliedB.slice(0, count));
    assert(a.local.size <= 4 && b.remote.size <= 8);
});
test('missing input stalls instead of advancing with guessed controls', () => {
    const sent = []; let applied = 0;
    const loop = new Loop((f, m) => sent.push([f, m]), () => applied++);
    for (let i = 0; i < 3; i++) { assert.equal(loop.before(), true); loop.after(); }
    assert.equal(loop.before(), false); assert.equal(loop.before(), false);
    assert.equal(loop.frame, 3); assert.equal(applied, 3); assert.equal(sent.length, 4);
    loop.receive(3, 128); assert.equal(loop.before(), true); loop.after(); assert.equal(loop.frame, 4);
});
test('short Coin and Start taps survive a network stall', () => {
    const packets = []; const loop = new Loop((f, m) => packets.push([f, m]), () => {});
    loop.before(); loop.after();
    loop.pulses |= 1 << 2; loop.mask = 0;
    loop.before(); loop.after(); loop.before();
    assert(packets.some(([, mask]) => mask & (1 << 2)));
    assert.equal(packets.at(-1)[1], 0);
});
test('malformed and unbounded input frames are rejected', () => {
    const loop = new Loop(() => {}, () => {});
    for (const [frame, mask] of [[-1, 0], [1.5, 0], [999999, 0], [0, -1], [0, 512], [0, NaN]]) assert.equal(loop.receive(frame, mask), false);
    assert.equal(loop.receive(3, 511), true);
});
