'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
let router={};
try { router=require('../extension/src/ui/shared/game-tab.js'); } catch {}
function fakeTabs(candidates, statusById={}, actionById={}) {
  const calls=[];
  const api={
    async query(q) { if(q.active) return [{id:1,windowId:11,url:'chrome-extension://suite/dashboard.html'}]; return candidates; },
    async sendMessage(id, message) {
      calls.push([id,message.type]);
      if(message.type==='GET_STATUS') {
        const v=statusById[id];
        if(v instanceof Error) throw v;
        return v===undefined?{ok:true,status:{bridgeReady:true}}:v;
      }
      const v=actionById[id];
      if(v instanceof Error) throw v;
      return v===undefined?{ok:true,status:{bridgeReady:true}}:v;
    }
  };
  return {api,calls};
}
const game=(id,windowId=11,url='https://www.idlehacking.com/play#inventory')=>({id,windowId,url,lastAccessed:id*10});
test('routes Optimize from active dashboard tab to the real game tab',async()=>{
  assert.equal(typeof router.sendGameCommand,'function');
  const x=fakeTabs([game(5),game(6,22)]);
  const out=await router.sendGameCommand({type:'RUN_OPTIMIZER'},x.api);
  assert.equal(out.tab.id,5);
  assert.deepEqual(x.calls,[[5,'GET_STATUS'],[5,'RUN_OPTIMIZER']]);
});
test('chooses a responding game tab when the nearest one has no listener',async()=>{
  const x=fakeTabs([game(5),game(6,22)],{5:new Error('Receiving end does not exist')});
  const out=await router.sendGameCommand({type:'GET_AUDIT'},x.api);
  assert.equal(out.tab.id,6);
  assert.deepEqual(x.calls,[[5,'GET_STATUS'],[6,'GET_STATUS'],[6,'GET_AUDIT']]);
});
test('surfaces real optimizer errors instead of a generic Needs Input',async()=>{
  const x=fakeTabs([game(5)],{}, {5:{ok:false,error:'Busy: automation'}});
  await assert.rejects(router.sendGameCommand({type:'RUN_OPTIMIZER'},x.api),/Busy: automation/);
});
test('tells the user explicitly when no Idle Hacking game tab is open',async()=>{
  const x=fakeTabs([]);
  await assert.rejects(router.sendGameCommand({type:'GET_AUDIT'},x.api),/Open.*Idle Hacking/i);
});
test('never sends a mutation to a page where the bridge is offline',async()=>{
  const x=fakeTabs([game(5)],{5:{ok:true,status:{bridgeReady:false}}});
  await assert.rejects(router.sendGameCommand({type:'RUN_OPTIMIZER'},x.api),/bridge|reload/i);
  assert.deepEqual(x.calls,[[5,'GET_STATUS']]);
});
test('uses a game tab in another window when none is in the dashboard window',async()=>{
  const x=fakeTabs([game(6,22)]);
  const out=await router.sendGameCommand({type:'RUN_OPTIMIZER'},x.api);
  assert.equal(out.tab.id,6);
});
