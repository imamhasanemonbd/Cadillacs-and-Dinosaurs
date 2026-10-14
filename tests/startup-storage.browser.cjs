const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
    const browser = await chromium.launch({headless:true, ...(process.env.DINO_CHROME_PATH ? {executablePath:process.env.DINO_CHROME_PATH} : {})});
    try {
        const page = await browser.newPage({viewport:{width:390,height:664},hasTouch:true,isMobile:true,ignoreHTTPSErrors:true});
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
            let prepare;
            Object.defineProperty(window,'prepareEmulatorStartup', {
                get:()=>prepare, set:fn=>{ prepare=emulator=>{
                    fn(emulator);
                    const download=emulator.downloadFiles;
                    emulator.downloadFiles=function() {
                        if (!sessionStorage.getItem('test-storage-working')) {
                            const backend=this.Module.FS.filesystems.IDBFS;
                            const getDB=backend.getDB;
                            backend.getDB=(name,callback)=>{
                                window.testLateSaveRead=()=>getDB.call(backend,name,callback);
                            };
                        }
                        return download.call(this);
                    };
                }; }
            });
        });
        const url=process.env.DINO_TEST_URL || 'http://127.0.0.1:3000/';
        async function boot() {
            await page.goto(url,{waitUntil:'domcontentloaded'});
            await page.waitForFunction(()=>document.querySelector('#mobile-game-frame')?.contentWindow.dinoMultiplayer,{}, {timeout:60000}).catch(async error=>{
                console.error('Boot diagnostics', await Promise.all(page.frames().map(frame=>frame.evaluate(()=>({url:location.href, started:window.EJS_emulator?.started,storage:window.EJS_emulator?.Module?.dinoSaveStorage,late:!!window.testLateSaveRead, text:document.querySelector('#game-viewport')?.innerText, error:window.dinoSessionDiagnostics?.current?.error})))));
                throw error;
            });
            return page.frames().find(frame=>frame.url().includes('landscape-frame'));
        }
        let game=await boot();
        assert.equal(await game.evaluate(()=>EJS_emulator.Module.dinoSaveStorage),'unavailable');
        assert.equal(await game.evaluate(()=>EJS_emulator.Module.FS.lookupPath('/data/saves').node.mount.dinoStorageUnavailable),true);
        const before=await game.evaluate(()=>EJS_emulator.gameManager.functions.getFrameNum());
        await game.evaluate(()=>window.testLateSaveRead());
        await game.waitForFunction(frame=>EJS_emulator.gameManager.functions.getFrameNum()>frame+10,before);
        assert.equal(await game.evaluate(()=>EJS_emulator.Module.dinoSaveStorage),'unavailable');
        // A normal next visit still uses the database; fallback isn't permanent.
        await game.evaluate(()=>sessionStorage.setItem('test-storage-working','1'));
        game=await boot();
        assert.equal(await game.evaluate(()=>EJS_emulator.Module.dinoSaveStorage),'available');
        assert.deepEqual(errors,[]);
        console.log('PASS: actual core boots with stalled save IndexedDB, late read cannot restart/import into live play, next visit restores normal persistent storage.');
    } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exit(1)});
