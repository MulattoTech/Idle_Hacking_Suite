'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
require('../extension/src/shared/sanitize.js');
const Performance=require('../extension/src/background/performance.js');
const Snapshot=require('../extension/src/background/snapshot-store.js');
const Contracts=require('../extension/src/main/contract-execution.js');
const Advisor=require('../extension/src/main/engines/combat-advisor.js');
const Panel=require('../extension/src/ui/dashboard/settings-panel.js');
const Drive=require('../extension/src/background/drive-sync.js');

test('latest fight sample works across weeks and never requires a 24-hour window',()=>{
 const now=Date.now(),events=Array.from({length:80},(_,i)=>({
   ts:now-(80-i)*48*3600000,victory:true,rounds:24,survivalRatio:.75,
   playerAttackAttempts:2,playerHitRounds:2
 }));
 const p=Performance.summarize(events);
 assert.equal(p.fights,80);
 assert.equal(p.winRate,100);
 assert.equal(p.hitRate,100);
 assert.ok(p.automationSuccess>75);
 assert.match(p.sampleLabel,/80 recorded fights/);
});

test('combat accuracy excludes unsampled records rather than counting as misses',()=>{
 const events=[
   {ts:1,victory:true,rounds:25,survivalRatio:.8,playerAttackAttempts:0,playerHitRounds:0},
   {ts:2,victory:false,rounds:40,survivalRatio:0,playerAttackAttempts:5,playerHitRounds:4}
 ];
 const s=Performance.summarize(events);
 assert.equal(s.hitRate,80);
 assert.equal(s.attackAttempts,5);
 assert.equal(s.hitSampleFights,1);
 assert.equal(s.confidence,'low');
 assert.ok(s.automationSuccess<=s.hackingEfficiency||s.automationSuccess<=s.streakStability);
});

test('trends compare consecutive fixed-size samples, not dates',()=>{
 const events=Array.from({length:240},(_,i)=>({ts:i+1,victory:i>=120,rounds:i>=120?15:35,survivalRatio:i>=120?.95:.15}));
 const t=Performance.trends(events,120);
 assert.equal(t.current.fights,120);
 assert.equal(t.previous.fights,120);
 assert.ok(t.delta.score>30);
});

test('save-state retains all 1200 telemetry rows without sanitized array truncation',()=>{
 const data=Snapshot.create({enhance:{enabled:false,dryRun:true}},{
   combat_events:Array.from({length:1200},(_,i)=>({ts:i+1,victory:true,authorization:'secret'}))
 });
 assert.equal(data.telemetry.combat_events.length,1200);
 assert.equal(data.telemetry.combat_events[600].authorization,'[redacted]');
 assert.equal(Snapshot.summarize(data).telemetryRows,1200);
});

test('save-state rejects wrong schema and leaked credentials',()=>{
 assert.throws(()=>Snapshot.validate({schema:'else',settings:{},telemetry:{}}),/Not an/);
 const a={schema:Snapshot.SCHEMA,settings:{},telemetry:{},session_id:'live-game-session'};
 assert.throws(()=>Snapshot.validate(a),/potential credentials/);
});

test('contract mutating actions require actual server state confirmation',()=>{
 const pending=Contracts.pendingFor({type:'CONTRACT_CLAIM',payload:{contract_id:'abc'}},100,'board');
 const old={board_key:'board',active_contract_id:'abc',contracts:[{id:'abc',completed:true,claimed:false}]};
 assert.equal(Contracts.verify(old,pending).verified,false);
 assert.equal(Contracts.verify({...old,contracts:[{id:'abc',claimed:true}]},pending).verified,true);
 const select=Contracts.pendingFor({type:'CONTRACT_SET_ACTIVE',payload:{contract_id:'other'}},100,'board');
 assert.equal(Contracts.verify(old,select).verified,false);
 assert.equal(Contracts.verify({...old,active_contract_id:'other'},select).verified,true);
 assert.equal(Contracts.verify({...old,board_key:'new'},select).verified,false);
});

test('claim payload merges lists without erasing active contract metadata',()=>{
 const prev={board_key:'board',active_contract_id:'abc',contracts:[]};
 const next=Contracts.mergeClaimPayload(prev,{contracts:[{id:'abc',claimed:true}]});
 assert.equal(next.board_key,'board');
 assert.equal(next.active_contract_id,'abc');
 assert.equal(next.contracts[0].claimed,true);
});

test('combat adaptive accuracy weighting requires enough counted attack attempts',()=>{
 const few=Advisor.adaptiveWeights({fights:100,attackAttempts:12,hitRate:.7,winRate:1,avgRounds:21,avgSurvival:.9},'balanced',95);
 const adequate=Advisor.adaptiveWeights({fights:100,attackAttempts:100,hitRate:.7,winRate:1,avgRounds:21,avgSurvival:.9},'balanced',95);
 assert.equal(few.accuracy,0);
 assert.ok(adequate.accuracy>2);
});

test('granular controls expose safety, contract scheduling, and cloud controls',()=>{
 const fields=Panel.groups.flatMap(g=>g.fields).map(x=>x.path);
 for(const path of ['enhance.dryRun','enhance.maxCreditsPerRun','contracts.recoveryPollMs','governor.mutationGapMs','optimizer.objective','cloud.autoSync','cloud.folderId']){
   assert.ok(fields.includes(path),path+' missing');
 }
 const settings={enhance:{},cloud:{}};
 Panel.set(settings,'enhance.dryRun',true);
 Panel.set(settings,'cloud.folderId','backup-folder');
 assert.equal(Panel.get(settings,'enhance.dryRun'),true);
 assert.equal(Panel.get(settings,'cloud.folderId'),'backup-folder');
});

test('drive integration does not attempt Google API requests without configured OAuth client',async()=>{
 const calls=[];
 const api=Drive.createClient({chromeApi:{runtime:{getManifest:()=>({})},identity:{getAuthToken:async()=>{throw Error('unexpected auth');}}},fetchImpl:async url=>{calls.push(url);throw Error('unexpected network');}});
 await assert.rejects(api.folder({folderName:'Suite'},true),/OAuth not configured/);
 assert.equal(calls.length,0);
});
