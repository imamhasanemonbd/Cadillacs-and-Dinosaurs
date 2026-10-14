const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const qrcode = require('qrcode-generator');
const jsQR = require('jsqr');
function codec(compressed = true) {
    const context = { window: { CompressionStream: compressed ? CompressionStream : undefined, DecompressionStream }, CompressionStream, DecompressionStream, Blob, Response, Uint8Array, atob, btoa };
    vm.createContext(context); vm.runInContext(fs.readFileSync(require.resolve('../js/pairing-qr.js'), 'utf8'), context);
    return context.window.DinoQrCodec;
}
const original = 'DINO1.' + btoa(JSON.stringify({ type: 'offer', room: 'test-room', sdp: 'v=0\r\na=ice-ufrag:test\r\na=candidate:1 1 UDP 2122260223 192.168.1.8 5000 typ host\r\n'.repeat(12) }));
function pixels(payload) {
    const qr = qrcode(0, 'M'); qr.addData(payload, 'Byte'); qr.make();
    const module = 6, margin = 4, width = (qr.getModuleCount() + margin * 2) * module;
    const data = new Uint8ClampedArray(width * width * 4); data.fill(255);
    for (let row = 0; row < qr.getModuleCount(); row++) for (let column = 0; column < qr.getModuleCount(); column++) {
        if (!qr.isDark(row, column)) continue;
        for (let y = 0; y < module; y++) for (let x = 0; x < module; x++) {
            const offset = (((row + margin) * module + y) * width + (column + margin) * module + x) * 4;
            data[offset] = data[offset + 1] = data[offset + 2] = 0;
        }
    }
    return { data, width };
}
test('compressed pairing QR decodes to every byte of the original connection code', async () => {
    const tools = codec(); const payload = await tools.encode(original);
    assert(payload.length < original.length);
    const image = pixels(payload); const found = jsQR(image.data, image.width, image.width);
    assert(found); assert.equal(await tools.decode(found.data), original);
});
test('uncompressed QR remains readable when compression is unavailable', async () => {
    const tools = codec(false); assert.equal(await tools.encode(original), original);
    const image = pixels(original); const found = jsQR(image.data, image.width, image.width);
    assert.equal(await tools.decode(found.data), original);
});
test('unrelated or damaged QR payloads are rejected', async () => {
    const tools = codec();
    await assert.rejects(tools.decode('https://unrelated.example/'));
    await assert.rejects(tools.decode('DINOQR1.not-valid-base64!'));
});

test('compact QR is smaller than the old double-base64 format and old QRs still decode', async () => {
    const data=await new Response(new Blob([original]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer();
    const legacy='DINOQR1.'+btoa(String.fromCharCode(...new Uint8Array(data)));
    const tools=codec(); const compact=await tools.encode(original);
    assert(compact.startsWith('DINOQR2.'));
    assert(compact.length<legacy.length);
    assert.equal(await tools.decode(legacy),original);
});
