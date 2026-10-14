const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
    const browser = await chromium.launch({
        ...(process.env.DINO_CHROME_PATH ? { executablePath: process.env.DINO_CHROME_PATH } : {}),
        headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding']
    });
    try {
        const pages = [];
        const games = [];
        const errors = [];
        for (const mobile of [false, true]) {
            const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 664 } : { width: 1000, height: 650 }, hasTouch: mobile, isMobile: mobile, ignoreHTTPSErrors: true });
            const page = await context.newPage(); pages.push(page);
            page.on('pageerror', error => errors.push(error.message));
            await page.goto(process.env.DINO_TEST_URL || 'http://127.0.0.1:3000/', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => window.EJS_emulator?.started || document.querySelector('#mobile-game-frame')?.contentWindow.EJS_emulator?.started, {}, { timeout: 60000 });
            games.push(page.frames().find(frame => frame.url().includes('landscape-frame')) || page.mainFrame());
        }
        const [host, guest] = games;
        for (const game of games) await game.locator('#multiplayer-open').click();
        // Camera denial leaves copy/paste and the solo game available.
        await guest.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); }; });
        await guest.locator('[data-mp=qr-scan]').click();
        await guest.waitForFunction(() => document.querySelector('.multiplayer-status').textContent.includes('permission was denied'));
        assert.equal(await guest.evaluate(() => window.dinoMultiplayer.busy), false);
        await host.locator('[data-mp=create]').click();
        await host.waitForFunction(() => !!document.querySelector('.pairing-qr-image svg'), {}, { timeout: 20000 });
        async function cameraFromQr(target, svg, width = 640, height = 640) {
            await target.evaluate(async ({markup, width, height}) => {
                const image = new Image(); image.src = 'data:image/svg+xml;base64,' + btoa(markup); await image.decode();
                const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; window.testCameraCanvas = canvas;
                const context = canvas.getContext('2d'); context.imageSmoothingEnabled = false;
                window.testCameraStream = canvas.captureStream(10);
                window.testCameraTimer = setInterval(() => {
                    const side = Math.min(canvas.width, canvas.height);
                    context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
                    context.drawImage(image, (canvas.width-side)/2, (canvas.height-side)/2, side, side);
                }, 100);
                navigator.mediaDevices.getUserMedia = async () => window.testCameraStream;
            }, {markup: svg, width, height});
        }
        const offerSvg = await host.locator('.pairing-qr-image').innerHTML();
        await cameraFromQr(guest, offerSvg, 640, 960); await guest.locator('[data-mp=qr-scan]').click();
        await guest.waitForFunction(() => document.querySelector('#multiplayer-output').value.startsWith('DINO1.') && !!document.querySelector('.pairing-qr-image svg'), {}, { timeout: 20000 });
        assert.equal(await guest.evaluate(() => window.testCameraStream.getTracks()[0].readyState), 'ended');
        await guest.evaluate(() => clearInterval(window.testCameraTimer));
        assert.equal(await guest.locator('.pairing-copy').getAttribute('open'), null);
        const replySvg = await guest.locator('.pairing-qr-image').innerHTML();
        await cameraFromQr(host, replySvg); await host.locator('[data-mp=qr-scan]').click();
        for (const game of games) await game.waitForFunction(() => window.dinoMultiplayer.active, {}, { timeout: 15000 });
        assert.equal(await host.evaluate(() => window.testCameraStream.getTracks()[0].readyState), 'ended');
        await host.evaluate(() => clearInterval(window.testCameraTimer));
        for (const game of games) await game.locator('[aria-label="Close multiplayer panel"]').click();
        for (const game of games) await game.waitForFunction(() => window.dinoMultiplayer.lastVerifiedFrame >= 120, {}, { timeout: 10000 });
        for (const game of games) await game.evaluate(() => window.dinoMultiplayer.leave());
        // Mobile portrait camera frames stay in a landscape viewport, including
        // orientation changes while scanning. Desktop retains its original sizing.
        await guest.locator('#multiplayer-open').click();
        await cameraFromQr(guest, '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="640" height="640" fill="white"/></svg>', 360, 640);
        await guest.locator('[data-mp=qr-scan]').click();
        await guest.waitForFunction(() => document.querySelector('.portrait-camera') && document.querySelector('video').videoHeight > document.querySelector('video').videoWidth);
        const cameraUpright = () => {
            const outer = Number(window.frameElement?.dataset.gameRotation) || 0;
            const matrix = new DOMMatrix(getComputedStyle(document.querySelector('video')).transform);
            const camera = Math.round(Math.atan2(matrix.b, matrix.a) * 180 / Math.PI);
            return outer + camera === 0;
        };
        const landscapePreview = () => {
            const box = document.querySelector('.pairing-camera-viewport');
            return box.clientWidth > box.clientHeight && getComputedStyle(document.querySelector('video')).transform !== 'none';
        };
        assert.equal(await host.evaluate(() => getComputedStyle(document.querySelector('.pairing-camera-viewport video')).transform), 'none');
        assert.equal(await guest.evaluate(landscapePreview), true);
        assert.equal(await guest.evaluate(cameraUpright), true);
        await pages[1].setViewportSize({width: 844, height: 390});
        await guest.waitForFunction(() => innerWidth === 844);
        assert.equal(await guest.evaluate(landscapePreview), true);
        assert.equal(await guest.evaluate(cameraUpright), true);
        await guest.evaluate(() => { window.testCameraCanvas.width = 640; window.testCameraCanvas.height = 360; });
        await guest.waitForFunction(() => document.querySelector('video').videoWidth > document.querySelector('video').videoHeight && !document.querySelector('.portrait-camera'));
        assert.equal(await guest.evaluate(cameraUpright), true);
        await pages[1].setViewportSize({width: 390, height: 664});
        await guest.waitForFunction(() => innerWidth === 390);
        assert.equal(await guest.evaluate(landscapePreview), true);
        assert.equal(await guest.evaluate(cameraUpright), true);
        await guest.locator('[aria-label="Close multiplayer panel"]').click();
        await guest.evaluate(() => clearInterval(window.testCameraTimer));
        // Closing the popup also stops an ongoing camera preview.
        await guest.locator('#multiplayer-open').click();
        await cameraFromQr(guest, '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="640" height="640" fill="white"/></svg>');
        await guest.locator('[data-mp=qr-scan]').click();
        await guest.waitForFunction(() => !!document.querySelector('video').srcObject);
        await guest.locator('[aria-label="Close multiplayer panel"]').click();
        await guest.waitForFunction(() => window.testCameraStream.getTracks()[0].readyState === 'ended');
        await guest.evaluate(() => clearInterval(window.testCameraTimer));
        // A late permission response after closing must also release its tracks.
        await guest.locator('#multiplayer-open').click();
        await cameraFromQr(guest, '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="640" height="640" fill="white"/></svg>');
        await guest.evaluate(() => { navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { window.testResolveCamera = resolve; }); });
        await guest.locator('[data-mp=qr-scan]').click();
        await guest.waitForFunction(() => !!window.testResolveCamera);
        await guest.locator('[aria-label="Close multiplayer panel"]').click();
        await guest.evaluate(() => window.testResolveCamera(window.testCameraStream));
        await guest.waitForFunction(() => window.testCameraStream.getTracks()[0].readyState === 'ended');
        await guest.evaluate(() => clearInterval(window.testCameraTimer));
        assert.deepEqual(errors, []);
        console.log('PASS: landscape mobile preview through camera/device rotations, unchanged desktop styling, denied camera fallback, actual portrait QR decoding through video, automatic host/guest pairing, shared gameplay checks, tracks stopped after detection and popup close.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
