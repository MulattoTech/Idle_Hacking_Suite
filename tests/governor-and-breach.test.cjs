'use strict';
const {test}=require('node:test');const a=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'../extension');
const governor=require(root+'/src/main/action-governor.js');
const breach=require(root+'/src/main/engines/breach.js');
let send;
try {send=require(root+'/src/main/action-retry.js');}catch{send={};}
function state(status='active'){
 return {session_id:'fake-session',session_version:104,status,network_id:'black_ice_citadel',fixed_starts_remaining:0,
 progression:{classes:{daemonbinder:{level:55,tree_points:0}}},
 participants:[{player_id:7,class_id:'daemonbinder',ready:true,ready_for_multiple:true}],self_player_id:7};
}
const cfg={enabled:true,autopilot:true,autoRefillRepeats:true,repeatStarts:10,alwaysReady:true,talentMode:'manual'};
test('active runs do NOT send repeat refill mutations',()=>{a.ok(!breach.planBreach(state('active'),[],cfg,{playerId:7}).some(x=>x.type==='BREACH_REFILL_REPEATS'));});
test('access phase does NOT attempt refill',()=>{a.ok(!breach.planBreach(state('access'),[],cfg,{playerId:7}).some(x=>x.type==='BREACH_REFILL_REPEATS'));});
test('lobby zero repeat counter allows one refresh intent',()=>{a.ok(breach.planBreach(state('lobby'),[],cfg,{playerId:7}).some(x=>x.type==='BREACH_REFILL_REPEATS'));});
test('lobby state unchanged after pending refill suppresses retries',()=>{a.ok(!breach.planBreach(state('lobby'),[],cfg,{playerId:7,allowRefillRepeats:false}).some(x=>x.type==='BREACH_REFILL_REPEATS'));});
test('governor announces cooldown remaining before send attempt',()=>{
 let time=0, sent=[];const g=governor.createActionGovernor({now:()=>time,mutationGapMs:700,send:x=>{sent.push(x);return true;}});
 a.equal(typeof g.nextDelayMs,'function');
 a.equal(g.trySend({type:'EQUIPMENT_EQUIP'}),true);
 a.equal(g.nextDelayMs({type:'ITEM_SET_DECOMPILE_LOCK'}),700);
 time=699;a.equal(g.nextDelayMs({type:'ITEM_SET_DECOMPILE_LOCK'}),1);
 time=700;a.equal(g.nextDelayMs({type:'ITEM_SET_DECOMPILE_LOCK'}),0);
 a.equal(g.trySend({type:'ITEM_SET_DECOMPILE_LOCK'}),true);a.equal(sent.length,2);
});
test('governor respects server retry-after and does not bypass it',()=>{
 let time=2000, sends=0;const g=governor.createActionGovernor({now:()=>time,send:()=>{sends++;return true}});
 g.observeRateLimit({retryAfterMs:8000});
 a.equal(g.nextDelayMs({type:'EQUIPMENT_EQUIP',subsystem:'optimizer'}),8000);
 time+=7999;a.equal(g.nextDelayMs({type:'EQUIPMENT_EQUIP',subsystem:'optimizer'}),1);
 a.equal(sends,0);time+=1;a.equal(g.nextDelayMs({type:'EQUIPMENT_EQUIP',subsystem:'optimizer'}),0);
});
test('retriable send waits for authorized window and then sends once',async()=>{
 a.equal(typeof send.waitForAuthorizedSend,'function');
 let now=0,calls=0;let waits=[];
 const out=await send.waitForAuthorizedSend(()=>{
   calls++;
   return now<900?{ok:false,reason:'governor',retryMs:900-now}:{ok:true};
 },{now:()=>now,sleep:async ms=>{waits.push(ms);now+=ms;},maxWaitMs:3000});
 a.equal(out.ok,true);a.equal(calls,2);a.deepEqual(waits,[900]);
});
test('retriable send never retries terminal socket failures',async()=>{
 a.equal(typeof send.waitForAuthorizedSend,'function');
 let calls=0;
 await a.rejects(send.waitForAuthorizedSend(()=>{calls++;return{ok:false,reason:'socket'};},{maxWaitMs:100}),/socket|WebSocket/i);
 a.equal(calls,1);
});
test('retriable send respects stop requests while cooling down',async()=>{
 a.equal(typeof send.waitForAuthorizedSend,'function');
 let time=0,stop=false;
 await a.rejects(send.waitForAuthorizedSend(()=>({ok:false,reason:'governor',retryMs:800}),{now:()=>time,sleep:async(ms)=>{time+=ms;stop=true;},stopRequested:()=>stop,maxWaitMs:4000}),/Stop|cancel/i);
});

let errors={};try{errors=require(root+'/src/main/error-classifier.js');}catch{}
test('rate-limit detection ignores incidental text inside normal game messages',()=>{
 a.equal(typeof errors.isServerRateLimit,'function');
 a.equal(errors.isServerRateLimit({type:'HACKING_RESULT',payload:{notice:'not rate-limited today'}}),false);
 a.equal(errors.isServerRateLimit({type:'ERROR',payload:{code:'BREACH_STALE_VERSION',message:'Refresh state'}}),false);
});
test('rate-limit detection recognizes explicit server rejection',()=>{
 a.equal(errors.isServerRateLimit({type:'ERROR',payload:{code:'RATE_LIMITED',message:'Try later'}}),true);
 a.equal(errors.isServerRateLimit({type:'ERROR',payload:{message:'Too many requests'}}),true);
});
test('Breach stale-version errors do not invalidate unrelated equipment operations',()=>{
 a.equal(typeof errors.errorMatchesAction,'function');
 a.equal(errors.errorMatchesAction('BREACH_STALE_VERSION','EQUIPMENT_EQUIP'),false);
 a.equal(errors.errorMatchesAction('INSUFFICIENT_RESOURCES','EQUIPMENT_MASTERWORK'),true);
});

let sched={};try{sched=require(root+'/src/main/recheck-scheduler.js')}catch{}
test('contract cooldown schedules one re-evaluation, not stale action replay',async()=>{
 a.equal(typeof sched.createRecheckScheduler,'function');
 let now=0,seq=0;const entries=new Map();const invoked=[];
 const x=sched.createRecheckScheduler({now:()=>now,setTimeout:(fn,ms)=>{const id=++seq;entries.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>entries.delete(id)});
 x.request('contracts',()=>invoked.push('fresh-contracts'),700);
 x.request('contracts',()=>invoked.push('duplicate'),700);
 a.equal(entries.size,1);
 now=700;for(const e of [...entries.values()])e.fn();await Promise.resolve();a.deepEqual(invoked,['fresh-contracts']);
});
test('re-evaluation can be cancelled when automation stops',async()=>{
 let count=0;const entries=new Map();let id=0;
 const x=sched.createRecheckScheduler({setTimeout:(fn)=>{entries.set(++id,fn);return id;},clearTimeout:(key)=>entries.delete(key)});
 x.request('events',()=>count++,1000);x.cancel('events');
 a.equal(entries.size,0);a.equal(count,0);
});
