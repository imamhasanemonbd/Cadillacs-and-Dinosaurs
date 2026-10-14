const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
    const browser=await chromium.launch({headless:true,...(process.env.DINO_CHROME_PATH?{executablePath:process.env.DINO_CHROME_PATH}:{})});
    try {
        const page=await browser.newPage({viewport:{width:390,height:664},hasTouch:true,isMobile:true,ignoreHTTPSErrors:true});
        const errors=[];page.on('pageerror',error=>errors.push(error.message));
        await page.addInitScript(()=>{
            let prepare;
            Object.defineProperty(window,'prepareEmulatorStartup',{get:()=>prepare,set:fn=>{
                prepare=emulator=>{
                    fn(emulator);
                    // Hold after decompression but before actual core initialization.
                    const init=emulator.initModule;
                    emulator.initModule=function(...args){window.testContinueCore=()=>init.apply(this,args);};
                    const start=emulator.startGame;
                    emulator.startGame=function(...args){window.testContinueStart=()=>start.apply(this,args);};
                };
            }});
        });
        await page.addInitScript(()=>{
            let setup;
            Object.defineProperty(window,'setupSessionRecovery',{get:()=>setup,set:fn=>{
                setup=(emulator,rom)=>{
                    fn(emulator,rom);
                    const counter=emulator.gameManager.getFrameNum.bind(emulator.gameManager);
                    emulator.gameManager.getFrameNum=()=>window.testReleaseFrames ? counter() : 0;
                };
            }});
        });
        await page.goto(process.env.DINO_TEST_URL||'http://127.0.0.1:3000/',{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>document.querySelector('#mobile-game-frame')?.contentWindow.testContinueCore,{},{timeout:90000});
        const game=page.frames().find(frame=>frame.url().includes('landscape-frame'));
        const panel=game.locator('.dino-startup-progress');
        assert(await panel.isVisible());
        assert.match(await panel.innerText(),/Preparing game core/);
        await page.waitForTimeout(1100);
        assert.match(await panel.innerText(),/[1-9]\d*s/);
        await game.evaluate(()=>{window.testNow=Date.now;Date.now=()=>window.testNow()+16000;});
        await game.waitForFunction(()=>document.querySelector('.dino-startup-progress').textContent.includes('taking longer'));
        await game.evaluate(()=>{Date.now=window.testNow;});
        await game.evaluate(()=>window.testContinueCore());
        await game.waitForFunction(()=>!!window.testContinueStart,{},{timeout:60000});
        assert(await panel.isVisible());
        await game.evaluate(()=>{EJS_emulator.textElem.textContent='Loading game data 75%';});
        await game.waitForFunction(()=>document.querySelector('.dino-startup-progress strong').textContent.includes('75%'));
        await game.evaluate(()=>{
            // Reproduce a core pause flag that JS resumeMainLoop alone can't clear.
            const run=EJS_emulator.Module.callMain;
            EJS_emulator.Module.callMain=(...args)=>{
                const result=run(...args);
                EJS_emulator.gameManager.toggleMainLoop(0);
                return result;
            };
            window.testContinueStart();
        });
        await game.waitForFunction(()=>window.EJS_emulator?.started && document.querySelector('.dino-startup-progress strong')?.textContent.includes('Waiting for game frames'),{},{timeout:30000});
        await page.waitForTimeout(250);
        assert(await panel.isVisible()); // frontend callbacks alone cannot dismiss it
        assert(await game.evaluate(()=>EJS_emulator.gameManager.functions.getFrameNum()>2));
        await game.evaluate(()=>{window.testNow=Date.now;Date.now=()=>window.testNow()+16000;});
        await game.waitForFunction(()=>document.querySelector('.dino-startup-progress').textContent.includes('not advancing frames'));
        await game.evaluate(()=>{Date.now=window.testNow;window.testReleaseFrames=true;});
        await game.waitForFunction(()=>!document.querySelector('.dino-startup-progress'));
        assert.equal(await game.evaluate(()=>window.dinoStartupStatus.phase),'running');
        await game.evaluate(()=>EJS_emulator.canvas.dispatchEvent(new Event('webglcontextlost')));
        assert(await panel.isVisible());
        assert.match(await panel.innerText(),/browser lost the game graphics/);
        await game.evaluate(()=>EJS_emulator.canvas.dispatchEvent(new Event('webglcontextrestored')));
        await game.waitForFunction(()=>!document.querySelector('.dino-startup-progress'));

        assert.deepEqual(errors,[]);
        console.log('PASS: stages stay visible, paused native core starts, frozen counter cannot dismiss loading, stalled frames and lost graphics are reported, advancing frames clear loading.');
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
