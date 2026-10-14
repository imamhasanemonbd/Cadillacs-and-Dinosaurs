const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
    const browser=await chromium.launch({headless:true,...(process.env.DINO_CHROME_PATH?{executablePath:process.env.DINO_CHROME_PATH}:{})});
    try {
        const page=await browser.newPage({viewport:{width:390,height:664},hasTouch:true,isMobile:true,ignoreHTTPSErrors:true});
        const errors=[]; page.on('pageerror',error=>{errors.push(error.message);console.error(error.stack);});
        await page.addInitScript(()=>{
            let setup;
            Object.defineProperty(window,'setupSessionRecovery',{get:()=>setup,set:fn=>{
                setup=(emulator,rom)=>{
                    window.testLoads=0; window.testSaves=0;
                    const put=emulator.storage.states.put.bind(emulator.storage.states);
                    emulator.storage.states.put=(key,bytes)=>put(key,bytes).then(async()=>{
                        const stored=await emulator.storage.states.get(key);
                        if (key.endsWith('.state')) window.testStoredBytes=stored?.byteLength || 0;
                    });
                    const load=emulator.gameManager.loadState.bind(emulator.gameManager);
                    const save=emulator.gameManager.getState.bind(emulator.gameManager);
                    emulator.gameManager.loadState=bytes=>{
                        window.testLoads++;
                        const expected=new Uint8Array(bytes);
                        emulator.Module.dinoPostFrame=()=>{
                            const actual=save();
                            window.testRestoreMatches=expected.length>0 && actual.length===expected.length && expected.every((b,i)=>actual[i]===b);
                            emulator.Module.dinoPostFrame=null;
                        };
                        return load(bytes);
                    };
                    emulator.gameManager.getState=()=>{window.testSaves++;return save();};
                    return fn(emulator,rom);
                };
            }});
        });
        async function boot(){
            await page.goto(process.env.DINO_TEST_URL||'http://127.0.0.1:3000/',{waitUntil:'domcontentloaded'});
            await page.waitForFunction(()=>document.querySelector('#mobile-game-frame')?.contentWindow.dinoMultiplayer && !document.querySelector('#mobile-game-frame').contentDocument.querySelector('.dino-startup-progress'),{},{timeout:90000}).catch(async error=>{console.error('Boot diagnostics',await Promise.all(page.frames().map(f=>f.evaluate(()=>({url:location.href,started:window.EJS_emulator?.started,text:document.querySelector('#game-viewport')?.innerText})) )));throw error;});
            return page.frames().find(frame=>frame.url().includes('landscape-frame'));
        }
        let game=await boot();
        assert.equal(await game.evaluate(()=>EJS_emulator.Module.dinoSaveStorage),'memory-only');
        await game.evaluate(()=>{
            localStorage.setItem('dino-game-recovery-v1',JSON.stringify({rom:'roms/dino.zip',version:'4.2.3',time:Date.now(),data:btoa('old checkpoint')}));
            EJS_emulator.changeSettingOption('save-state-location','browser');
            EJS_emulator.elements.bottomBar.saveState[0].click();
        });
        await game.waitForFunction(()=>window.testStoredBytes>0);
        assert.equal(await game.evaluate(()=>window.testSaves),1);
        game=await boot();
        await page.waitForTimeout(5500);
        assert.equal(await game.evaluate(()=>window.testLoads),0);
        assert.equal(await game.evaluate(()=>window.testSaves),0);
        await game.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
        assert.equal(await game.evaluate(()=>EJS_emulator.paused),true);
        await game.evaluate(()=>window.dispatchEvent(new Event('pageshow')));
        assert.equal(await game.evaluate(()=>EJS_emulator.paused),false);
        assert.equal(await game.evaluate(()=>window.testSaves),0);
        await game.evaluate(()=>EJS_emulator.elements.bottomBar.loadState[0].click());
        await game.waitForFunction(()=>window.testLoads===1 && window.testRestoreMatches!==undefined);
        assert.equal(await game.evaluate(()=>window.testRestoreMatches),true);
        assert.deepEqual(errors,[]);
        console.log('PASS: manual native Save persists; reload ignores saved state and old checkpoint; no timed/background saves; native Load restores byte-for-byte only when clicked.');
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
