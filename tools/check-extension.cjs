'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const dir=path.join(root,'extension');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
assert.equal(manifest.manifest_version,3);
assert.equal(manifest.name,'Idle Hacking Suite');
const present=relative=>{const full=path.join(dir,relative);assert.ok(fs.existsSync(full),'Missing runtime file: '+relative);return full;};
let refs=0;
for(const entry of manifest.content_scripts||[])for(const file of entry.js||[]){present(file);refs++;}
present(manifest.background.service_worker);refs++;
present(manifest.action.default_popup);refs++;
present(manifest.options_page);refs++;
for(const size of ['16','32','48','128']){present(manifest.icons[size]);refs++;}
for(const html of [manifest.action.default_popup,manifest.options_page]){
 const content=fs.readFileSync(present(html),'utf8');
 const scripts=[...content.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1]);
 for(const script of scripts){present(script);refs++;}
 assert.ok(scripts.includes('src/ui/shared/game-tab.js'),'Tab routing helper missing from '+html);
 const ids=[...content.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,'Duplicate element id in '+html);
}
function recursive(base){return fs.readdirSync(base,{withFileTypes:true}).flatMap(e=>e.isDirectory()?recursive(path.join(base,e.name)):[path.join(base,e.name)]);}
const js=recursive(dir).filter(p=>p.endsWith('.js')&&!p.includes(path.sep+'compat'+path.sep));
for(const f of js)new vm.Script(fs.readFileSync(f,'utf8'),{filename:f});
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
assert.equal(manifest.version,pkg.version,'Manifest/package versions must agree');
console.log('Extension check passed: '+js.length+' JS files, '+refs+' references, MV3 '+manifest.version);
