'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
test('public repo ignores game/session capture folders',()=>{
 const ignore=fs.readFileSync(path.join(root,'.gitignore'),'utf8');
 for(const required of ['/profile/','/runtime/','/captures/','/ChatGPT Uploads/','*.har','*.ndjson']){
  assert.ok(ignore.includes(required),'Missing ignore rule '+required);
 }
 assert.match(ignore,/node_modules\//);
});
test('Git tracked files contain no local browser captures or profiles',()=>{
 let tracked='';
 try{tracked=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'});}catch{return;}
 const bad=tracked.split('\0').filter(Boolean).filter(s=>/^(?:profile|runtime|captures|ChatGPT Uploads|_repair_backup|node_modules)\//i.test(s)||/\.(?:har|ndjson|zip|crx)$/i.test(s));
 assert.deepEqual(bad,[]);
});
