const {chromium}=require('playwright'); const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({...(process.env.DINO_CHROME_PATH ? { executablePath: process.env.DINO_CHROME_PATH } : {}),headless:true,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 const contexts=await Promise.all([browser.newContext({viewport:{width:1000,height:650},ignoreHTTPSErrors:true}),browser.newContext({viewport:{width:390,height:664},hasTouch:true,isMobile:true,ignoreHTTPSErrors:true})]);
 const pages=await Promise.all(contexts.map(c=>c.newPage())); const errors=[];
 for(let i=0;i<2;i++){pages[i].on('pageerror',e=>{errors.push(e.message);console.log('ERROR',i,e.message)});await pages[i].goto(process.env.DINO_TEST_URL || 'http://127.0.0.1:3000/',{waitUntil:'domcontentloaded'});await pages[i].waitForFunction(()=>window.EJS_emulator?.started||document.querySelector('#mobile-game-frame')?.contentWindow.EJS_emulator?.started,{},{timeout:60000}).catch(async error=>{console.error('Startup diagnostics',await Promise.all(pages[i].frames().map(f=>f.evaluate(()=>({url:location.href,started:window.EJS_emulator?.started,loading:document.querySelector('.ejs_loading_text')?.textContent,text:document.querySelector('#game-viewport')?.textContent?.slice(0,300)})))));throw error;});}
 const games=pages.map(p=>p.frames().find(f=>f.url().includes('landscape-frame'))||p.mainFrame());const [host,guest]=games;
 for(const f of games){await f.locator('#multiplayer-open').click();await f.locator('.pairing-copy summary').click();}
 // Leaving the panel open and generating a code must not freeze solo play.
 const frame = () => window.EJS_emulator.gameManager.getState().slice(0, 0x40000).reduce((a,b)=>((a*31+b)>>>0),0);
 const beforePanel = await host.evaluate(frame);
 await pages[0].waitForTimeout(16000);
 assert.notEqual(await host.evaluate(frame), beforePanel);
 await host.locator('[data-mp=create]').click();
 await host.waitForFunction(()=>document.querySelector('#multiplayer-output').value.startsWith('DINO1.'),{},{timeout:20000});
 const beforePairing = await host.evaluate(frame);
 await pages[0].waitForTimeout(1000);
 assert.notEqual(await host.evaluate(frame), beforePairing);
 assert.equal(await host.evaluate(()=>window.EJS_emulator.paused),false);
 await host.evaluate(()=>{window.testOldChannelClose=window.dinoMultiplayer.channel.onclose;window.testOldChannelError=window.dinoMultiplayer.channel.onerror;});
 await host.locator('[aria-label="Close multiplayer panel"]').click();
 await host.waitForFunction(()=>!window.dinoMultiplayer.busy);
 assert.equal(await host.evaluate(()=>window.EJS_emulator.paused),false);
 await host.locator('#multiplayer-open').click();
 await host.locator('[data-mp=create]').click();await host.waitForFunction(()=>document.querySelector('#multiplayer-output').value.startsWith('DINO1.'),{},{timeout:20000});const offer=await host.locator('#multiplayer-output').inputValue();console.log('OFFER',offer.length);
 await host.evaluate(()=>{window.testOldChannelClose();window.testOldChannelError();});
 assert.equal(await host.evaluate(()=>window.dinoMultiplayer.busy && window.dinoMultiplayer.role==='host'),true);
 await guest.locator('#multiplayer-input').fill('broken code');await guest.locator('[data-mp=join]').click();assert.equal(await guest.evaluate(()=>window.dinoMultiplayer.busy),false);
 await guest.locator('#multiplayer-input').fill(offer);await guest.locator('[data-mp=join]').click();await guest.waitForFunction(()=>document.querySelector('#multiplayer-output').value.startsWith('DINO1.'),{},{timeout:20000});const reply=await guest.locator('#multiplayer-output').inputValue();console.log('REPLY',reply.length);
 await guest.evaluate(()=>{const pc=window.dinoMultiplayer.peer;Object.defineProperty(pc,'connectionState',{configurable:true,value:'disconnected'});pc.onconnectionstatechange();delete pc.connectionState;});
 assert.equal(await guest.evaluate(()=>window.dinoMultiplayer.busy),true);
 await host.locator('#multiplayer-input').fill(reply);await host.locator('[data-mp=finish]').click();
 for(const f of games)await f.waitForFunction(()=>window.dinoMultiplayer.active,{},{timeout:30000});console.log('ACTIVE');
 for(const f of games)await f.locator('[aria-label="Close multiplayer panel"]').click();
 await pages[0].waitForTimeout(3000);console.log('STATE',await Promise.all(games.map(f=>f.evaluate(()=>({frame:window.dinoMultiplayer.loop?.frame,epoch:window.dinoMultiplayer.epoch,size:[window.EJS_emulator.canvas.width,window.EJS_emulator.canvas.height],verified:window.dinoMultiplayer.lastVerifiedFrame,active:window.dinoMultiplayer.active,paused:window.EJS_emulator.paused,status:document.querySelector('.multiplayer-status').textContent})))));
 // Checksums must match the old copied prefix without allocating state copies.
 assert.equal(await host.evaluate(()=>{
   const gm=EJS_emulator.gameManager, original=gm.getState;
   const bytes=original.call(gm).subarray(0,0x40000);let hash=2166136261;
   for(const byte of bytes)hash=Math.imul(hash^byte,16777619);
   let copies=0;gm.getState=(...args)=>{copies++;return original.apply(gm,args);};
   try {return window.dinoMultiplayer.hash()===(hash>>>0).toString(16) && copies===0;}
   finally {gm.getState=original;}
 }),true);
 const idleInputs=await host.evaluate(()=>{
   const original=EJS_emulator.gameManager.functions.simulateInput;window.testNativeInputs=0;
   EJS_emulator.gameManager.functions.simulateInput=(...args)=>{window.testNativeInputs++;return original(...args);};
   return window.testNativeInputs;
 });
 await pages[0].waitForTimeout(1000);
 assert(await host.evaluate(()=>window.testNativeInputs)<36,'idle play must not repeatedly resend every native input');
 await host.locator('#btn-insert-coin').click();await host.locator('#btn-start-p1').click();await guest.locator('#btn-insert-coin').click();await guest.locator('#btn-start-p1').click();
 await guest.evaluate(()=>window.EJS_emulator.gameManager.simulateInput(0,7,1));await pages[0].waitForTimeout(600);await guest.evaluate(()=>window.EJS_emulator.gameManager.simulateInput(0,7,0));
 await pages[0].waitForTimeout(4000);console.log('AFTER INPUT',await Promise.all(games.map(f=>f.evaluate(()=>({frame:window.dinoMultiplayer.loop?.frame,epoch:window.dinoMultiplayer.epoch,size:[window.EJS_emulator.canvas.width,window.EJS_emulator.canvas.height],verified:window.dinoMultiplayer.lastVerifiedFrame,active:window.dinoMultiplayer.active,status:document.querySelector('.multiplayer-status').textContent})))));
 for(const f of games)await f.waitForFunction(()=>window.dinoMultiplayer.lastVerifiedFrame>=120,{},{timeout:30000});
 for(const f of games)assert(await f.evaluate(()=>window.dinoMultiplayer.active && window.dinoMultiplayer.loop.frame>120 && window.dinoMultiplayer.lastVerifiedFrame>=120));
 console.log('VERIFIED',await Promise.all(games.map(f=>f.evaluate(()=>({frame:window.dinoMultiplayer.loop.frame,verified:window.dinoMultiplayer.lastVerifiedFrame,epoch:window.dinoMultiplayer.epoch})))));
 // A transient transport disconnect must stall, then recover the same session.
 const reconnectEpoch=await host.evaluate(()=>window.dinoMultiplayer.epoch);
 const reconnectVerified=await host.evaluate(()=>window.dinoMultiplayer.lastVerifiedFrame);
 await host.evaluate(()=>{const pc=window.dinoMultiplayer.peer;Object.defineProperty(pc,'connectionState',{configurable:true,value:'disconnected'});pc.onconnectionstatechange();});
 await pages[0].waitForTimeout(150);
 const disconnectedFrame=await host.evaluate(()=>window.dinoMultiplayer.loop.frame);
 await pages[0].waitForTimeout(250);
 assert.equal(await host.evaluate(()=>window.dinoMultiplayer.loop.frame),disconnectedFrame);
 assert.equal(await host.evaluate(()=>window.dinoMultiplayer.active),true);
 await host.evaluate(()=>{const pc=window.dinoMultiplayer.peer;delete pc.connectionState;pc.onconnectionstatechange();});
 await host.waitForFunction(frame=>window.dinoMultiplayer.loop.frame>frame+10,disconnectedFrame,{timeout:5000});
 assert.equal(await host.evaluate(()=>window.dinoMultiplayer.epoch),reconnectEpoch);
 await host.waitForFunction(frame=>window.dinoMultiplayer.lastVerifiedFrame>frame,reconnectVerified,{timeout:5000});
 // Background one device: both must stop advancing, then continue the same session.
 await guest.evaluate(()=>{window.testHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.testHidden});document.dispatchEvent(new Event('visibilitychange'));});
 await pages[0].waitForTimeout(200);const stopped=await host.evaluate(()=>window.dinoMultiplayer.loop.frame);await pages[0].waitForTimeout(300);assert.equal(await host.evaluate(()=>window.dinoMultiplayer.loop.frame),stopped);
 await guest.evaluate(()=>{window.testHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
 await host.waitForFunction(f=>window.dinoMultiplayer.loop.frame>f+10,stopped,{timeout:5000});
 assert.equal(await host.evaluate(()=>window.EJS_emulator.elements.menu.inert),true);
 const epoch=await host.evaluate(()=>window.dinoMultiplayer.epoch);await host.evaluate(()=>window.dinoMultiplayer.resync());
 for(const f of games)await f.waitForFunction(e=>window.dinoMultiplayer.active&&window.dinoMultiplayer.epoch>e,epoch,{timeout:10000});
 await pages[0].waitForTimeout(500);assert.equal(await guest.evaluate(()=>document.getElementById('btn-start-p1').getAttribute('aria-label')),'Start player two');
 // Ignore all incoming packets while the transport still appears connected.
 await host.evaluate(()=>{
   window.testIncomingHandler=window.dinoMultiplayer.channel.onmessage;
   window.dinoMultiplayer.channel.onmessage=()=>{};
   window.testRealNow=Date.now;Date.now=()=>window.testRealNow()+25000;
 });
 await host.waitForFunction(()=>!window.dinoMultiplayer.active && document.querySelector('#multiplayer-dialog').open,{},{timeout:5000});
 assert.match(await host.locator('.multiplayer-status').textContent(),/stopped responding or restarted/);
 await host.evaluate(()=>{Date.now=window.testRealNow;window.dinoMultiplayer.channel.onmessage=window.testIncomingHandler;});
 // An explicit host resync can reuse a live connection after a timeout.
 await host.evaluate(()=>window.dinoMultiplayer.resync());
 for(const f of games)await f.waitForFunction(()=>window.dinoMultiplayer.active,{},{timeout:10000});
 await host.locator('[aria-label="Close multiplayer panel"]').click();
 // A failed state read must not escape and abort the emulator's frame callback.
 await host.evaluate(()=>{
   window.testSaveStateInfo=EJS_emulator.gameManager.functions.saveStateInfo;
   EJS_emulator.gameManager.functions.saveStateInfo=()=> 'invalid';
 });
 await host.waitForFunction(()=>!window.dinoMultiplayer.active && document.querySelector('#multiplayer-dialog').open,{},{timeout:5000});
 assert.match(await host.locator('.multiplayer-status').textContent(),/Synchronization state could not be read/);
 await host.evaluate(()=>{EJS_emulator.gameManager.functions.saveStateInfo=window.testSaveStateInfo;});
 await host.evaluate(()=>window.dinoMultiplayer.resync());
 for(const f of games)await f.waitForFunction(()=>window.dinoMultiplayer.active,{},{timeout:10000});
 await host.locator('[aria-label="Close multiplayer panel"]').click();
 // Expiry is terminal; a late connected event must not claim play resumed.
 await host.evaluate(()=>{
   const pc=window.dinoMultiplayer.peer, schedule=window.setTimeout;
   window.setTimeout=(fn,ms,...args)=>{const id=schedule.call(window,fn,ms,...args);if(ms===15000)window.testDisconnectExpiry=fn;return id;};
   Object.defineProperty(pc,'connectionState',{configurable:true,value:'disconnected'});
   try {pc.onconnectionstatechange();} finally {window.setTimeout=schedule;}
   window.testDisconnectExpiry(); delete pc.connectionState; pc.onconnectionstatechange();
 });
 assert.equal(await host.evaluate(()=>window.dinoMultiplayer.active),false);
 assert.match(await host.locator('.multiplayer-status').textContent(),/did not recover/);
 await guest.evaluate(()=>window.dinoMultiplayer.channel.close());await host.waitForFunction(()=>!window.dinoMultiplayer.active,{},{timeout:5000});
 for(const f of games)await f.evaluate(()=>window.dinoMultiplayer.leave());
 for(const f of games){assert.equal(await f.evaluate(()=>window.dinoMultiplayer.busy),false);assert.equal(await f.evaluate(()=>window.EJS_emulator.elements.menu.inert),false);assert.equal(await f.evaluate(()=>window.EJS_emulator.paused),false);}
 console.log('PASS: actual host/guest pairing, matching frames and RAM checks, remote movement/Coin/Start, transient disconnect recovery with matching RAM, stale channel isolation, background pause/resume, resync, bounded disconnect expiry, silent-peer reporting, copy-free hashes and reduced native input calls, Leave restores solo.');
  assert.deepEqual(errors,[]);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
