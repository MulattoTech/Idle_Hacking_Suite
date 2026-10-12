const path = typeof require!=='undefined' ? require('node:path') : null;
let defaults,deepMerge;
if(typeof require!=='undefined'){
  ({IHS2_DEFAULTS:defaults}=require('../shared/defaults.js'));
  ({deepMerge}=require('../shared/math.js'));
}else{
  defaults=globalThis.IHS2.IHS2_DEFAULTS;deepMerge=globalThis.IHS2.deepMerge;
}
function migrateSettings(raw={}){
  const report=[];
  const source=raw&&typeof raw==='object'?structuredClone(raw):{};
  if(source.resources?.mode==='equalizer'){source.resources.mode='bottleneck_balancer';report.push('Mapped Resources mode Equalizer to Bottleneck Balancer.');}
  if(source.resources?.mode==='goal'){source.resources.mode='target_reserve';report.push('Mapped Resources mode Goal to Target Reserve.');}
  if(source.shopHomelab){source.economy={...(source.economy||{}),enabled:source.economy?.enabled??source.shopHomelab.enabled,preferAutomationController:source.economy?.preferAutomationController??source.shopHomelab.preferAutomationController};}
  const settings=deepMerge(defaults,source);
  settings.settingsSchemaVersion=200;
  if(!['safe','balanced','maximum','custom'].includes(settings.preset))settings.preset='custom';
  return {settings,report};
}
if(typeof module!=='undefined'&&module.exports)module.exports={migrateSettings};
if(typeof globalThis!=='undefined'){globalThis.IHS2=globalThis.IHS2||{};globalThis.IHS2.migrateSettings=migrateSettings;}
