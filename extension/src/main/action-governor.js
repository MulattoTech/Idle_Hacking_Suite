(function(root,factory){const out=factory();if(typeof module!=='undefined'&&module.exports)module.exports=out;root.IHS2=root.IHS2||{};Object.assign(root.IHS2,out);})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function createActionGovernor(options={}){
    const now=options.now||(()=>Date.now());
    const send=options.send||(()=>false);
    const mutationGapMs=Number(options.mutationGapMs||700);
    const queryGapMs=Number(options.queryGapMs||180);
    const maxBackoffMs=Number(options.maxBackoffMs||60000);
    const queue=[];const dedupe=new Set();const cooldowns={};const actions=[];
    let globalCooldownUntil=0,lastMutationAt=-Infinity,lastQueryAt=-Infinity,rateLimitLevel=0,paused=false,lastRateLimit=null,seq=0;
    function record(a,result,reason=''){actions.push({ts:now(),type:a.type,subsystem:a.subsystem||'unknown',priority:Number(a.priority||0),result,reason});if(actions.length>100)actions.splice(0,actions.length-100);}
    function normalize(a){const inferredMutation=a.isMutation!==undefined?Boolean(a.isMutation):!(/^(GET_|MARKET_.*_QUERY$|EVENT_GET_|BREACH_PUBLIC_LOBBIES_SUBSCRIBE$|BREACH_PUBLIC_LOBBIES_UNSUBSCRIBE$)/.test(String(a.type||'')));return {...a,priority:Number(a.priority||0),subsystem:a.subsystem||'unknown',dedupeKey:a.dedupeKey||`${a.subsystem||'unknown'}:${a.type}:${JSON.stringify(a.payload||{})}`,isMutation:inferredMutation,seq:++seq};}
    function submit(action){const a=normalize(action);if(dedupe.has(a.dedupeKey))return false;dedupe.add(a.dedupeKey);queue.push(a);queue.sort((x,y)=>y.priority-x.priority||x.seq-y.seq);return true;}
    function nextDelayMs(action){const a=action?.seq?action:normalize(action),t=now();if(paused)return Infinity;const gap=a.isMutation?mutationGapMs:queryGapMs,last=a.isMutation?lastMutationAt:lastQueryAt;return Math.max(0,globalCooldownUntil-t,Number(cooldowns[a.subsystem]||0)-t,Math.max(gap,Number(a.minIntervalMs||0))-(t-last));}
    function ready(a){return nextDelayMs(a)===0;}
    function execute(a){if(a.precondition&&!a.precondition()){record(a,'blocked','precondition');return false;}if(!ready(a)){record(a,'deferred','cooldown');return false;}let ok=false;try{ok=Boolean((a.execute||(()=>send({type:a.type,payload:a.payload||{}})))());}catch(e){record(a,'error',String(e.message||e));return false;}if(ok){if(a.isMutation)lastMutationAt=now();else lastQueryAt=now();rateLimitLevel=Math.max(0,rateLimitLevel-1);record(a,'sent');}else record(a,'rejected','send returned false');return ok;}
    function trySend(action){const a=normalize(action);return execute(a);}
    async function drain(limit=Infinity){let n=0;while(queue.length&&n<limit){const idx=queue.findIndex(ready);if(idx<0)break;const[a]=queue.splice(idx,1);dedupe.delete(a.dedupeKey);execute(a);n++;await Promise.resolve();}return n;}
    function observeRateLimit(info={}){const t=now();rateLimitLevel=Math.min(6,rateLimitLevel+1);const fallback=Math.min(maxBackoffMs,2000*Math.pow(2,rateLimitLevel-1));const explicit=Math.max(0,Number(info.retryAfterMs||0));const wait=Math.max(fallback,explicit);globalCooldownUntil=Math.max(globalCooldownUntil,t+wait);if(info.subsystem)cooldowns[info.subsystem]=Math.max(Number(cooldowns[info.subsystem]||0),t+wait);lastRateLimit={ts:t,subsystem:info.subsystem||'unknown',retryAfterMs:wait};return wait;}
    function snapshot(){return{queueSize:queue.length,queue:queue.map(a=>({type:a.type,subsystem:a.subsystem,priority:a.priority,dedupeKey:a.dedupeKey})),globalCooldownUntil,cooldowns:{...cooldowns},paused,rateLimitLevel,lastRateLimit,actions:[...actions]};}
    function pause(){paused=true;}function resume(){paused=false;}
    return{submit,trySend,nextDelayMs,drain,observeRateLimit,snapshot,pause,resume};
  }
  return{createActionGovernor};
});
