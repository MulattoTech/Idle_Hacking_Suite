'use strict';
(function(root,factory){
 const out=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=out;
 root.IHS2=root.IHS2||{};
 Object.assign(root.IHS2,out);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 function createRecheckScheduler(options={}){
  const now=options.now||(()=>Date.now());
  const schedule=options.setTimeout||setTimeout;
  const cancelTimer=options.clearTimeout||clearTimeout;
  const pending=new Map();
  function request(key,callback,delayMs){
   const delay=Math.max(75,Math.min(90000,Math.ceil(Number(delayMs)||300)));
   const due=now()+delay,old=pending.get(key);
   if(old&&old.due<=due)return false;
   if(old)cancelTimer(old.timer);
   const timer=schedule(()=>{
     pending.delete(key);
     Promise.resolve().then(callback).catch(()=>{});
   },delay);
   pending.set(key,{timer,due});return true;
  }
  function cancel(key){
   const old=pending.get(key);if(old){cancelTimer(old.timer);pending.delete(key);}
  }
  return{request,cancel};
 }
 return{createRecheckScheduler};
});
