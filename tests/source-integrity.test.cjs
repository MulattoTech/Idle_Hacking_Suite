'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
test('MV3 manifest, code and UI references resolve',()=>{
 const output=execFileSync(process.execPath,[path.join(__dirname,'../tools/check-extension.cjs')],{encoding:'utf8'});
 assert.match(output,/Extension check passed/);
});
