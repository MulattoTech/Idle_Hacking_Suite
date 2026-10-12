'use strict';
(function(root,factory){
 const out=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=out;
 root.IHS2=root.IHS2||{};
 Object.assign(root.IHS2,out);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 function isServerRateLimit(message){
  if(!message||typeof message!=='object')return false;
  const type=String(message.type||'').toUpperCase();
  if(!['ERROR','RATE_LIMIT','RATE_LIMITED','TOO_MANY_REQUESTS','SERVER_ERROR'].includes(type))return false;
  if(type==='RATE_LIMIT'||type==='RATE_LIMITED'||type==='TOO_MANY_REQUESTS')return true;
  const p=message.payload||{};
  const code=String(p.code||message.code||'').toUpperCase();
  const status=Number(p.status??message.status);
  return status===429||/RATE[_ -]?LIMIT|TOO[_ -]?MANY[_ -]?REQUESTS/.test(code)
    ||/rate.?limit|too many requests/i.test(String(p.message||''));
 }
 function errorMatchesAction(code,actionType){
  const a=String(actionType||'').toUpperCase(),c=String(code||'').toUpperCase();
  if(!a)return false;
  for(const prefix of ['BREACH_','MARKET_','EVENT_','CONTRACT_','EQUIPMENT_','HARDWARE_','HOMELAB_']){
   if(c.startsWith(prefix)&&!a.startsWith(prefix))return false;
  }
  return true;
 }
 return {isServerRateLimit,errorMatchesAction};
});
