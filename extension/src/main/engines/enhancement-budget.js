(function(root,factory){const out=factory();if(typeof module!=='undefined'&&module.exports)module.exports=out;root.IHS2=root.IHS2||{};root.IHS2.EnhancementBudget=out;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const PROFILES={
    preserve:{reserve:.50,item:.10,pass:.15,hour:.25,rerolls:2},
    cautious:{reserve:.35,item:.12,pass:.22,hour:.35,rerolls:3},
    balanced:{reserve:.20,item:.15,pass:.30,hour:.50,rerolls:4},
    aggressive:{reserve:.05,item:.35,pass:.60,hour:.80,rerolls:7},
    burn_it:{reserve:.01,item:.95,pass:.98,hour:.99,rerolls:20}
  };
  const finite=v=>Number.isFinite(Number(v))?Number(v):0;
  function createLedger(resources={},now=Date.now()){return{createdAt:now,startingResources:{...resources},itemSpent:{},passSpent:{},hourly:[],nonImprovingRerolls:{}};}
  function add(obj,key,n){obj[key]=finite(obj[key])+Math.max(0,finite(n));}
  function recordSpend(ledger,itemId,costs=[],now=Date.now(),meta={}){
    ledger.itemSpent[itemId]=ledger.itemSpent[itemId]||{};const spend={};
    for(const c of costs){const r=String(c.resource||''),a=Math.max(0,finite(c.amount));if(!r||!a)continue;add(ledger.itemSpent[itemId],r,a);add(ledger.passSpent,r,a);add(spend,r,a);}
    if(Object.keys(spend).length)ledger.hourly.push({ts:now,spend});
    ledger.hourly=ledger.hourly.filter(x=>now-finite(x.ts)<=3600000);
    if(meta.isReroll&&meta.improved===false)ledger.nonImprovingRerolls[itemId]=finite(ledger.nonImprovingRerolls[itemId])+1;
    if(meta.improved===true)ledger.nonImprovingRerolls[itemId]=0;
    return ledger;
  }
  function hourlySpent(ledger,resource,now){return(ledger.hourly||[]).filter(x=>now-finite(x.ts)<=3600000).reduce((a,x)=>a+finite(x.spend?.[resource]),0);}
  function resolved(settings={}){const p=PROFILES[String(settings.budgetProfile||'balanced')]||PROFILES.balanced;return{
    profile:String(settings.budgetProfile||'balanced'),reserve:p.reserve,item:settings.maxResourcePctPerItem??p.item,pass:settings.maxResourcePctPerPass??p.pass,hour:settings.maxResourcePctPerHour??p.hour,rerolls:settings.maxNonImprovingRerolls??p.rerolls,
    overrides:settings.resourceReserves||{}
  };}
  function canSpend(costs=[],resources={},settings={},ledger=createLedger(resources),ctx={}){
    const cfg=resolved(settings),itemId=String(ctx.itemId||'unknown'),now=finite(ctx.now)||Date.now();
    if(ctx.isReroll&&finite(ledger.nonImprovingRerolls?.[itemId])>=Math.max(0,finite(cfg.rerolls)))return{ok:false,reason:`reroll limit reached (${cfg.rerolls})`,profile:cfg.profile};
    let tightest=1;
    for(const c of costs){const r=String(c.resource||''),amount=Math.max(0,finite(c.amount));if(!r||!amount)continue;const have=Math.max(0,finite(resources[r])),start=Math.max(have,finite(ledger.startingResources?.[r]));if(amount>have)return{ok:false,reason:`needs ${Math.ceil(amount)} ${r}; only ${Math.floor(have)} available`,profile:cfg.profile};
      const reserveRatio=Number.isFinite(Number(cfg.overrides[r]))?Number(cfg.overrides[r]):cfg.reserve;const reserve=Math.max(0,start*reserveRatio),after=have-amount;tightest=Math.min(tightest,start?after/start:0);
      if(after<reserve)return{ok:false,reason:`${r} reserve would fall below ${(reserveRatio*100).toFixed(0)}%`,reserveAfter:after,profile:cfg.profile};
      const itemUsed=finite(ledger.itemSpent?.[itemId]?.[r])+amount;if(start&&itemUsed>start*cfg.item)return{ok:false,reason:`${r} per-item cap ${(cfg.item*100).toFixed(0)}%`,profile:cfg.profile};
      const passUsed=finite(ledger.passSpent?.[r])+amount;if(start&&passUsed>start*cfg.pass)return{ok:false,reason:`${r} pass spend cap ${(cfg.pass*100).toFixed(0)}%`,profile:cfg.profile};
      const hourUsed=hourlySpent(ledger,r,now)+amount;if(start&&hourUsed>start*cfg.hour)return{ok:false,reason:`${r} hourly spend cap ${(cfg.hour*100).toFixed(0)}%`,profile:cfg.profile};
    }
    return{ok:true,reason:'within crafting budget',reserveAfter:tightest,utilityThreshold:Number(settings.minUtilityGain??.01),profile:cfg.profile};
  }
  return{PROFILES,createLedger,recordSpend,canSpend,resolved};
});
