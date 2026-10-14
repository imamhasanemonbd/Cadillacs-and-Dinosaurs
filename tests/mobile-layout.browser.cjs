const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
    const browser = await chromium.launch({headless: true, ...(process.env.DINO_CHROME_PATH ? {executablePath: process.env.DINO_CHROME_PATH} : {})});
    try {
        const page = await browser.newPage({viewport: {width:390,height:664}, hasTouch:true, isMobile:true, ignoreHTTPSErrors:true,
            userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'});
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(process.env.DINO_TEST_URL || 'http://127.0.0.1:3000/');
        await page.waitForFunction(() => document.querySelector('#mobile-game-frame')?.contentWindow.dinoMultiplayer, {}, {timeout:60000});
        const game = page.frames().find(frame => frame.url().includes('landscape-frame'));
        await game.locator('.b_x').waitFor({state:'visible'});
        await game.evaluate(() => {
            window.testEmulator = EJS_emulator; window.testInputs = [];
            const input = EJS_emulator.gameManager.simulateInput.bind(EJS_emulator.gameManager);
            EJS_emulator.gameManager.simulateInput = (...args) => { window.testInputs.push(args); return input(...args); };
        });
        async function checkPortrait(width, height) {
            await page.setViewportSize({width,height});
            await game.waitForFunction(w => innerWidth === w, width);
            const screen = await game.locator('.ejs_canvas_parent').boundingBox();
            assert(screen.y + screen.height <= height * 0.5 + 1);
            for (const selector of ['.b_layout_joystick .back', '.b_x', '.b_y', '#btn-insert-coin', '#btn-start-p1']) {
                const box = await game.locator(selector).boundingBox();
                assert(box && box.y >= height * 0.5, selector + ' must be below the screen');
                assert(box.x >= 0 && box.x + box.width <= width && box.y + box.height <= height, selector + ' must fit');
            }
        }
        await checkPortrait(390,664); await checkPortrait(320,568);
        const attack = await game.locator('.b_x').boundingBox();
        await page.touchscreen.tap(attack.x+attack.width/2, attack.y+attack.height/2);
        assert(await game.evaluate(() => window.testInputs.some(([,index,value]) => index === 8 && value === 1)));
        const stick = await game.locator('.b_layout_joystick .back').boundingBox();
        const touch = await page.context().newCDPSession(page);
        const point = {x:stick.x+stick.width/2, y:stick.y+stick.height/2, id:1};
        await touch.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[point]});
        await touch.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{...point,x:point.x+40}]});
        await touch.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
        assert(await game.evaluate(() => window.testInputs.some(([,index,value]) => index === 7 && value === 1)));
        // Save a portrait button size; rotating must use a separate saved layout.
        await game.locator('#control-layout-open').click();
        await game.locator('[name=control]').selectOption('x');
        await game.locator('[name=size]').fill('125');
        await game.locator('.layout-actions [type=submit]').click();
        assert(await game.evaluate(() => JSON.parse(localStorage.getItem('dino-control-layout-v1-portrait')).x.scale === 1.25));
        await page.setViewportSize({width:844,height:390});
        await game.waitForFunction(() => innerWidth === 844);
        await game.waitForFunction(() => document.querySelector('.b_x').getBoundingClientRect().width === 50);
        const wide = await game.locator('.ejs_canvas_parent').boundingBox();
        assert(Math.abs(wide.width / wide.height - 4/3) < 0.01);
        assert.equal(wide.height,390);
        assert(Math.abs(wide.x - (844-wide.width)/2) < 1);
        const picture = await game.locator('.ejs_canvas').boundingBox();
        assert(Math.abs(picture.width / picture.height - 4/3) < 0.01);
        assert(picture.y >= 0 && picture.y + picture.height <= 390);
        const button = await game.locator('.b_x').boundingBox();
        assert(button.x > wide.x + wide.width); // controls stay in the full viewport

        assert(await game.evaluate(() => EJS_emulator === window.testEmulator && !EJS_emulator.paused));
        await page.setViewportSize({width:390,height:664});
        await game.waitForFunction(() => document.querySelector('.b_x').getBoundingClientRect().width === 62.5);
        assert.deepEqual(errors,[]);
        console.log('PASS: portrait game/controls fit two phone sizes, native X/joystick input works, landscape picture fits 4:3 without cropping or restart, orientation layouts save independently.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
