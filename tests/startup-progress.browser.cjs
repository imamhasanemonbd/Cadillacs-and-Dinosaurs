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
        await game.evaluate(()=>window.testContinueStart());
        await game.waitForFunction(()=>window.EJS_emulator?.started && !document.querySelector('.dino-startup-progress'),{},{timeout:30000});
        assert.deepEqual(errors,[]);
        console.log('PASS: progress stays visible after decompression, elapsed time updates, game-data percentages remain visible, first running frame removes progress.');
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
