(function(root,factory){const out=factory();if(typeof module!=='undefined'&&module.exports)module.exports=out;root.IHS2=root.IHS2||{};root.IHS2.ChangelogStore=out;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function mergeState(prior={},incoming=[],now=Date.now()){
    const old=new Map((prior.entries||[]).map(x=>[x.id,x]));
    const merged=[];
    for(const row of incoming||[]){const prev=old.get(row.id);merged.push({...row,firstSeenAt:prev?.firstSeenAt??row.firstSeenAt??now,lastSeenAt:now,read:prev?.read===true,readAt:prev?.readAt||0});old.delete(row.id);}
    for(const row of old.values())merged.push({...row});
    merged.sort((a,b)=>(a.sourceOrder??9999)-(b.sourceOrder??9999)||Number(b.lastSeenAt||0)-Number(a.lastSeenAt||0));
    return{entries:merged,updatedAt:now,lastError:null};
  }
  function markRead(state={},ids=[],now=Date.now()){const set=new Set(ids||[]);return{...state,entries:(state.entries||[]).map(x=>set.has(x.id)?{...x,read:true,readAt:now}:x),updatedAt:state.updatedAt||now};}
  function rank(row){return (row.read?0:100)+(row.highImpact?40:0)+(row.automationImpact?20:0)-Number(row.sourceOrder||0)/1000;}
  function buildView(state={},opts={}){const limit=Math.max(1,Number(opts.limit)||12),rows=[...(state.entries||[])];const unseen=rows.filter(x=>!x.read).sort((a,b)=>rank(b)-rank(a)).slice(0,limit);const impact=rows.filter(x=>x.highImpact||x.automationImpact).sort((a,b)=>rank(b)-rank(a)).slice(0,limit);return{updatedAt:state.updatedAt||0,lastError:state.lastError||null,unseen,impact,total:rows.length,unreadCount:rows.filter(x=>!x.read).length};}
  return{mergeState,markRead,buildView};
});
