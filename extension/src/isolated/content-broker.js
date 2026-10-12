'use strict';
(() => {
  if(globalThis.__IHS2_BROKER__)return;globalThis.__IHS2_BROKER__=true;
  const SOURCE='IDLE_HACKING_SUITE';
  function forward(type,payload){try{chrome.runtime.sendMessage({type,payload}).catch(()=>{});}catch{}}
  window.addEventListener('message',event=>{
    if(event.source!==window)return;const m=event.data;
    if(!m||m.source!==SOURCE||m.channel!=='PAGE_TO_EXTENSION')return;
    if(m.type==='STATUS')forward('IHS2_STATUS',m.payload?.status||{});
    if(m.type==='IHS2_TELEMETRY')forward('IHS2_TELEMETRY',m.payload||{});
    if(m.type==='IHS2_DECISION')forward('IHS2_DECISION',m.payload||{});
  });
})();
