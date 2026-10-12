'use strict';
(function(root,factory){
 const out=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=out;
 root.IHS2=root.IHS2||{};
 Object.assign(root.IHS2,out);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const RETRYABLE=new Set(['pace','rate-limit','governor']);
 async function waitForAuthorizedSend(attempt,options={}){
   const now=options.now||(()=>Date.now());
   const sleep=options.sleep||((ms)=>new Promise(resolve=>setTimeout(resolve,ms)));
   const stopRequested=options.stopRequested||(()=>false);
   const deadline=now()+Math.max(100,Number(options.maxWaitMs)||90000);
   let notified=false;
   while(true){
     if(stopRequested())throw new Error('Stopped before the action was sent');
     if(now()>=deadline)throw new Error('Timed out waiting for permitted action window; no mutation was sent');
     const outcome=await attempt();
     if(outcome?.ok)return outcome;
     if(!RETRYABLE.has(outcome?.reason))throw new Error(
       String(outcome?.error||('Action unavailable: '+String(outcome?.reason||'unrecognized server state')))
     );
     const remaining=deadline-now();
     if(remaining<=0)throw new Error('Timed out waiting for permitted action window; no mutation was sent');
     const raw=Number(outcome.retryMs);
     const requested=Number.isFinite(raw)&&raw>0?raw:300;
     const delay=Math.max(1,Math.min(remaining,requested,5000));
     if(!notified&&typeof options.onWaiting==='function'){
       options.onWaiting({reason:outcome.reason,retryMs:requested});
       notified=true;
     }
     await sleep(delay);
   }
 }
 return{waitForAuthorizedSend};
});
