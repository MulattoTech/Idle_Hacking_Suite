'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const extension=path.resolve(__dirname,'../extension');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'ihs2-smoke-'));
let context;
(async()=>{
 try{
   context=await chromium.launchPersistentContext(profile,{
     headless:true,channel:'chromium',
     args:['--disable-extensions-except='+extension,'--load-extension='+extension,'--no-first-run']
   });
   const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker',{timeout:15000});
   const id=new URL(worker.url()).host;
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('chrome-extension://'+id+'/dashboard.html',{waitUntil:'domcontentloaded'});
   await page.click('button[data-view="settings"]');
   await page.waitForSelector('#view-settings.active');
   await page.waitForSelector('#granularSettings [data-setting]',{timeout:15000});
   const n=await page.locator('#granularSettings [data-setting]').count();console.log('advanced controls',n,'errors',errors);assert.ok(n>45,'Advanced controls missing: '+n);
   assert.ok(await page.locator('[data-setting="enhance.dryRun"]').isChecked(),'Dry Run should be on by default');
   assert.ok(await page.locator('#downloadSnapshot').isVisible(),'Save state export unavailable');
   assert.ok(await page.locator('#driveConnect').isVisible(),'Google Drive connect unavailable');
   await page.locator('.fine-group').filter({has:page.locator('[data-setting="contracts.switchGainPct"]')}).locator('summary').click();
   await page.locator('[data-setting="contracts.switchGainPct"]').fill('80');
   await page.locator('#saveButton').click();
   await page.waitForTimeout(500);
   const result=await page.evaluate(()=>chrome.runtime.sendMessage({type:'GET_V2_SETTINGS'}));
   assert.equal(result.settings.contracts.switchGainPct,80,'Granular setting not saved');
   await page.locator('#saveCheckpoint').click();
   await page.waitForTimeout(500);
   const checkpoint=await page.evaluate(()=>chrome.runtime.sendMessage({type:'GET_LOCAL_CHECKPOINT_STATUS'}));
   assert.ok(checkpoint.summary?.settingGroups>0,'Local checkpoint not created');
   assert.deepEqual(errors,[],'Dashboard page errors');
   console.log('PASS: Chrome MV3 popup installed in isolated test profile; advanced controls, Dry Run, saved threshold, checkpoint, and Drive buttons verified. ID '+id);
   await page.close();
 }finally{
   if(context)await context.close();
   fs.rmSync(profile,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
