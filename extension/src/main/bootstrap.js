'use strict';
(() => {
  const ns=globalThis.IHS2=globalThis.IHS2||{};
  if(ns.__bootstrapped)return;ns.__bootstrapped=true;
  ns.priorities={user:100,breachReady:95,event:90,contract:85,breachRun:80,breachHousekeeping:70,optimizer:65,enhancement:55,economy:45,resources:35,marketMutation:25,background:10};
  ns.governor=ns.createActionGovernor({
    mutationGapMs:700,
    queryGapMs:180,
    send:(wire)=>{
      const ws=globalThis.__IHS_STATE__?.gameWs;
      if(!ws||ws.readyState!==WebSocket.OPEN)return false;
      ws.send(JSON.stringify(wire));return true;
    }
  });
})();
