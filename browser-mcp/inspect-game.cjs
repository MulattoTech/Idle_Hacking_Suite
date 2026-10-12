'use strict';
const { chromium } = require('playwright');
const endpoint=process.env.IHS_BRAVE_CDP_URL||'http://127.0.0.1:9358';
(async()=>{
 let browser;
 try {
  browser=await chromium.connectOverCDP(endpoint,{timeout:4500});
  const pages=browser.contexts().flatMap(c=>c.pages());
  const games=pages.filter(p=>/^https:\/\/(www\.)?idlehacking\.com\//i.test(p.url()));
  const out=[];
  for(const p of games){
   const state=await p.evaluate(()=>{
    const s=globalThis.__IHS_STATE__;
    if(!s)return {bridge:false,url:location.origin+location.pathname};
    return {
     bridge:true,url:location.origin+location.pathname,engine:s.runningEngine||null,stopped:!!s.stopRequested,
     inventoryCount:s.inventory?.length||0,equippedCount:Object.keys(s.equipped||{}).length,
     lastLog:s.logs?.at(-1)?.message||null,
     optimizer:s.optimizerResult?.map(x=>({slot:x.slot,status:x.status}))||[],
     breach:{phase:s.breachState?.status||'unknown',repeatRemaining:Number(s.breachState?.fixed_starts_remaining??-1),lastAction:s.breachLastAction||null},
     contracts:{board:s.contractsState?.board_key||null,active:!!s.contractsState?.active_contract_id,lastAction:s.contractLastAction||null},
     governor:{queue:globalThis.IHS2?.governor?.snapshot?.().queueSize??null,paused:globalThis.IHS2?.governor?.snapshot?.().paused??null},
     lastServerError:s.lastServerError?{code:s.lastServerError.code,message:s.lastServerError.message}:null
    };
   });
   out.push(state);
  }
  console.log(JSON.stringify({endpointConnected:true,gameTabCount:games.length,games:out},null,2));
 }catch(e){console.error('Dedicated Brave MCP is offline: '+String(e.message||e));process.exitCode=2;}
 finally{if(browser)await browser.close().catch(()=>{});}
})();
