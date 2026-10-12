'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
let policy={};
try{policy=require('../extension/src/main/maintenance-policy.js');}catch{}
test('contracts run in background when master automation is disabled',()=>{
 assert.equal(typeof policy.planMaintenance,'function');
 assert.deepEqual(policy.planMaintenance({masterEnabled:false,contracts:{enabled:true},events:{enabled:false}}),{contracts:true,events:false});
});
test('events run in background when master is off',()=>{
 assert.deepEqual(policy.planMaintenance({masterEnabled:false,contracts:{enabled:false},events:{enabled:true}}),{contracts:false,events:true});
});
test('master scheduler retains ownership when enabled',()=>{
 assert.deepEqual(policy.planMaintenance({masterEnabled:true,contracts:{enabled:true},events:{enabled:true}}),{contracts:false,events:false});
});
test('explicitly disabled subsystems stay disabled',()=>{
 assert.deepEqual(policy.planMaintenance({masterEnabled:false,contracts:{enabled:false},events:{enabled:false}}),{contracts:false,events:false});
});
test('loop integrates background maintenance and allows independent breach loop',()=>{
 const js=fs.readFileSync(path.join(root,'extension/page-bridge.js'),'utf8');
 assert.match(js,/planMaintenance\?\.\(STATE\.settings\)/);
 assert.match(js,/runBackgroundMaintenance/);
 assert.match(js,/runBreachLoopOnly/);
});
test('UI shows enhancement enabled and dry run toggles',()=>{
 const html=fs.readFileSync(path.join(root,'extension/dashboard.html'),'utf8');
 const js=fs.readFileSync(path.join(root,'extension/src/ui/dashboard/dashboard.js'),'utf8');
 for(const id of ['enhanceEnabled','enhanceDryRun','enhanceSafetyStatus']){
  assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(js,new RegExp(id));
 }
});
