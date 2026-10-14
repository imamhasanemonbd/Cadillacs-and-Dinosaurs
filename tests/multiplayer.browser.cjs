const {chromium}=require('playwright'); const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({...(process.env.DINO_CHROME_PATH ? { executablePath: process.env.DINO_CHROME_PATH } : {}),headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 const contexts=await Promise.all([browser.newContext({viewport:{width:1000,height:650},ignoreHTTPSErrors:true}),browser.newContext({viewport:{width:390,height:664},hasTouch:true,isMobile:true,ignoreHTTPSErrors:true})]);
 const pages=await Promise.all(contexts.map(c=>c.newPage())); const errors=[];
 for(let i=0;i<2;i++){pages[i].on('pageerror',e=>{errors.push(e.message);console.log('ERROR',i,e.message)});await pages[i].goto(process.env.DINO_TEST_URL || 'http://127.0.0.1:3000/',{waitUntil:'domcontentloaded'});await pages[i].waitForFunction(()=>window.EJS_emulator?.started||document.querySelector('#mobile-game-frame')?.contentWindow.EJS_emulator?.started,{},{timeout:60000});}
 const games=pages.map(p=>p.frames().find(f=>f.url().includes('landscape-frame'))||p.mainFrame());const [host,guest]=games;
 for(const f of games)await f.locator('#multiplayer-open').click();
 await host.locator('[data-mp=create]').click();await host.waitForFunction(()=>document.querySelector('#multiplayer-output').value.startsWith('DINO1.'),{},{timeout:20000});const offer=await host.locator('#multiplayer-output').inputValue();console.log('OFFER',offer.length);
 await guest.locator('#multiplayer-input').fill('broken code');await guest.locator('[data-mp=join]').click();assert.equal(await guest.evaluate(()=>window.dinoMultiplayer.busy),false);
 await guest.locator('#multiplayer-input').fill(offer);await guest.locator('[data-mp=join]').click();await guest.waitForFunction(()=>document.querySelector('#multiplayer-output').value.startsWith('DINO1.'),{},{timeout:20000});const reply=await guest.locator('#multiplayer-output').inputValue();console.log('REPLY',reply.length);
 await host.locator('#multiplayer-input').fill(reply);await host.locator('[data-mp=finish]').click();
 for(const f of games)await f.waitForFunction(()=>window.dinoMultiplayer.active,{},{timeout:30000});console.log('ACTIVE');
 for(const f of games)await f.locator('[aria-label="Close multiplayer panel"]').click();
 await pages[0].waitForTimeout(3000);console.log('STATE',await Promise.all(games.map(f=>f.evaluate(()=>({frame:window.dinoMultiplayer.loop?.frame,epoch:window.dinoMultiplayer.epoch,size:[window.EJS_emulator.canvas.width,window.EJS_emulator.canvas.height],verified:window.dinoMultiplayer.lastVerifiedFrame,active:window.dinoMultiplayer.active,paused:window.EJS_emulator.paused,status:document.querySelector('.multiplayer-status').textContent})))));
 await host.locator('#btn-insert-coin').click();await host.locator('#btn-start-p1').click();await guest.locator('#btn-insert-coin').click();await guest.locator('#btn-start-p1').click();
 await guest.evaluate(()=>window.EJS_emulator.gameManager.simulateInput(0,7,1));await pages[0].waitForTimeout(600);await guest.evaluate(()=>window.EJS_emulator.gameManager.simulateInput(0,7,0));
 await pages[0].waitForTimeout(4000);console.log('AFTER INPUT',await Promise.all(games.map(f=>f.evaluate(()=>({frame:window.dinoMultiplayer.loop?.frame,epoch:window.dinoMultiplayer.epoch,size:[window.EJS_emulator.canvas.width,window.EJS_emulator.canvas.height],verified:window.dinoMultiplayer.lastVerifiedFrame,active:window.dinoMultiplayer.active,status:document.querySelector('.multiplayer-status').textContent})))));
 for(const f of games)await f.waitForFunction(()=>window.dinoMultiplayer.lastVerifiedFrame>=120,{},{timeout:30000});
 for(const f of games)assert(await f.evaluate(()=>window.dinoMultiplayer.active && window.dinoMultiplayer.loop.frame>120 && window.dinoMultiplayer.lastVerifiedFrame>=120));
 console.log('VERIFIED',await Promise.all(games.map(f=>f.evaluate(()=>({frame:window.dinoMultiplayer.loop.frame,verified:window.dinoMultiplayer.lastVerifiedFrame,epoch:window.dinoMultiplayer.epoch})))));
 // Background one device: both must stop advancing, then continue the same session.
 await guest.evaluate(()=>{window.testHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.testHidden});document.dispatchEvent(new Event('visibilitychange'));});
 await pages[0].waitForTimeout(200);const stopped=await host.evaluate(()=>window.dinoMultiplayer.loop.frame);await pages[0].waitForTimeout(300);assert.equal(await host.evaluate(()=>window.dinoMultiplayer.loop.frame),stopped);
 await guest.evaluate(()=>{window.testHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
 await host.waitForFunction(f=>window.dinoMultiplayer.loop.frame>f+10,stopped,{timeout:5000});
 assert.equal(await host.evaluate(()=>window.EJS_emulator.elements.menu.inert),true);
 const epoch=await host.evaluate(()=>window.dinoMultiplayer.epoch);await host.evaluate(()=>window.dinoMultiplayer.resync());
 for(const f of games)await f.waitForFunction(e=>window.dinoMultiplayer.active&&window.dinoMultiplayer.epoch>e,epoch,{timeout:10000});
 await pages[0].waitForTimeout(500);assert.equal(await guest.evaluate(()=>document.getElementById('btn-start-p1').getAttribute('aria-label')),'Start player two');
 await guest.evaluate(()=>window.dinoMultiplayer.channel.close());await host.waitForFunction(()=>!window.dinoMultiplayer.active,{},{timeout:5000});
 for(const f of games)await f.evaluate(()=>window.dinoMultiplayer.leave());
 for(const f of games){assert.equal(await f.evaluate(()=>window.dinoMultiplayer.busy),false);assert.equal(await f.evaluate(()=>window.EJS_emulator.elements.menu.inert),false);assert.equal(await f.evaluate(()=>window.EJS_emulator.paused),false);}
 console.log('PASS: actual host/guest pairing, matching frames and RAM checks, remote movement/Coin/Start, background pause/resume, resync, disconnect freeze, Leave restores solo.');
  assert.deepEqual(errors,[]);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
