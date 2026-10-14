const fs = require('node:fs');
const path = require('node:path');
const destination = path.join(__dirname, '../js/vendor');
fs.mkdirSync(destination, { recursive: true });
for (const [source, name] of [
    ['qrcode-generator/qrcode.js', 'qrcode.js'],
    ['jsqr/dist/jsQR.js', 'jsQR.js'],
    ['jsqr/LICENSE', 'jsQR-LICENSE.txt']
]) {
    const target = path.join(destination, name);
    fs.copyFileSync(require.resolve(source), target);
    if (name.endsWith('LICENSE.txt')) fs.writeFileSync(target, fs.readFileSync(target, 'utf8').trimEnd() + '\n');
}

// qrcode-generator 1.4.4 omits LICENSE from its npm package.
// Keep the checked-in upstream qrcode-LICENSE.txt alongside its source header.
