(function(root,factory){let sanitizeFn;if(typeof module!=='undefined'&&module.exports){sanitizeFn=require('../shared/sanitize.js').sanitize;}else sanitizeFn=root.IHS2?.sanitize;const out=factory(sanitizeFn);if(typeof module!=='undefined'&&module.exports)module.exports=out;root.IHS2=root.IHS2||{};root.IHS2.Export=out;})(typeof globalThis!=='undefined'?globalThis:this,function(sanitize){
  function assembleExport(parts={},now=Date.now()){
    const clean=typeof sanitize==='function'?sanitize(parts):parts;
    return{schema:'idle-hacking-suite-export-v5',generatedAt:new Date(now).toISOString(),extension:clean.manifest||{},pageAudit:clean.pageAudit||null,pageAuditError:clean.pageAuditError||null,telemetry:clean.telemetry||null,settings:clean.settings||{},migration:clean.migration||null,changelog:clean.changelog||null};
  }
  return{assembleExport};
});
