'use strict';
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.IHS2=root.IHS2||{};root.IHS2.Snapshot=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const SCHEMA='idle-hacking-suite-save-v1',MAX_SIZE_BYTES=24*1024*1024;
 const SETTINGS_KEY='idleHackingSuiteSettings';
 const REDACTED='[redacted]';
 function validate(data){
   if(!data||typeof data!=='object'||data.schema!==SCHEMA)throw new Error('Not an Idle Hacking Suite save-state file');
   if(!data.settings||typeof data.settings!=='object'||Array.isArray(data.settings))throw new Error('Save state has no valid settings');
   if(!data.telemetry||typeof data.telemetry!=='object'||Array.isArray(data.telemetry))throw new Error('Save state has no valid telemetry');
   const serialized=JSON.stringify(data);
   if(serialized.length>MAX_SIZE_BYTES)throw new Error('Save state exceeds 24MB safety limit');
   if(/"(?:password|authorization|cookie|refresh_token|access_token|session_id)"\s*:\s*"(?!\[redacted\])/i.test(serialized))
     throw new Error('Save-state file contains potential credentials; remove them before importing');
   return data;
 }
 function create(settings,telemetry,at=new Date().toISOString()){
   const clean=globalThis.IHS2?.sanitize||((x)=>x);
   const safeTelemetry=Object.fromEntries(Object.entries(telemetry||{}).map(([name,rows])=>[name,Array.isArray(rows)?rows.map(row=>clean(row)):[]]));
   return validate({schema:SCHEMA,generatedAt:at,description:'Settings and sanitized local performance / decision history; no game auth sessions',settings:clean(settings),telemetry:safeTelemetry});
 }
 function summarize(data){
   const valid=validate(data),count=Object.values(valid.telemetry).reduce((n,rows)=>n+(Array.isArray(rows)?rows.length:0),0);
   return{generatedAt:valid.generatedAt||null,telemetryRows:count,settingGroups:Object.keys(valid.settings).length};
 }
 return{SCHEMA,MAX_SIZE_BYTES,SETTINGS_KEY,validate,create,summarize,REDACTED};
});
