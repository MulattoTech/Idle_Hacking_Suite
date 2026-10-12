'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.IHS2UI=root.IHS2UI||{};
  Object.assign(root.IHS2UI,api);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const URL_PATTERNS=[
    'https://www.idlehacking.com/*',
    'https://idlehacking.com/*',
    'https://ih.gigaforge.com/*'
  ];
  const HOSTS=new Set(['www.idlehacking.com','idlehacking.com','ih.gigaforge.com']);
  function isGameUrl(input) {
    try { const u=new URL(String(input||'')); return u.protocol==='https:'&&HOSTS.has(u.hostname); }
    catch {return false;}
  }
  async function findGameTabs(api=globalThis.chrome?.tabs) {
    if(!api?.query)throw new Error('Chrome/Brave tabs API unavailable in this context.');
    const active=await api.query({active:true,currentWindow:true});
    const currentWindowId=active?.[0]?.windowId;
    const candidates=(await api.query({url:URL_PATTERNS})||[])
      .filter(t=>Number.isInteger(t.id)&&(isGameUrl(t.url)||!t.url));
    candidates.sort((a,b)=>{
      const preference=t=>Number(t.windowId===currentWindowId)*100
        +Number(isGameUrl(t.url)&&new URL(t.url).pathname.startsWith('/play'))*20
        +Number(Boolean(t.active))*4;
      return preference(b)-preference(a)||(Number(b.lastAccessed||0)-Number(a.lastAccessed||0));
    });
    return candidates;
  }
  async function sendGameCommand(message,api=globalThis.chrome?.tabs) {
    if(!message?.type)throw new Error('Missing game command type.');
    const candidates=await findGameTabs(api);
    if(!candidates.length)throw new Error('Open Idle Hacking (https://www.idlehacking.com/play) in a Brave tab first.');
    let lastFailure='';
    for(const tab of candidates) {
      let probe;
      try { probe=await api.sendMessage(tab.id,{type:'GET_STATUS'}); }
      catch(e) {lastFailure='Found an Idle Hacking tab, but its extension content script is unavailable. Reload the game page and extension.';continue;}
      if(!probe?.ok||!probe.status?.bridgeReady) {
        lastFailure='Idle Hacking tab found, but its Suite page bridge is offline. Reload the game page.';
        continue;
      }
      if(message.type==='GET_STATUS')return {tab,response:probe};
      let response;
      try { response=await api.sendMessage(tab.id,message); }
      catch(e) {
        throw new Error('Game tab connected, but command delivery failed: '+String(e?.message||e));
      }
      if(!response||response.ok===false)throw new Error(String(response?.error||'The game page did not acknowledge the command.'));
      return {tab,response};
    }
    throw new Error(lastFailure||'No connected Idle Hacking game tab was found.');
  }
  return {URL_PATTERNS,isGameUrl,findGameTabs,sendGameCommand};
});
