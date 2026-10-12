(function(root,factory){const out=factory();if(typeof module!=='undefined'&&module.exports)module.exports=out;root.IHS2=root.IHS2||{};root.IHS2.CombatAdvisor=out;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,n(v)));
  function compactHitStats(c){
    if(!c||!Number.isFinite(Number(c.n))||Number(c.n)<=0)return{attempts:0,hitRounds:0,hitRate:null};
    const rounds=Math.max(0,Math.floor(Number(c.n)));let attempts=0,hitRounds=0;
    for(let i=0;i<rounds;i++){
      const damage=n(c.pa?.[i]),hits=n(c.ph?.[i]),miss=Boolean(c.pm?.[i]);
      if(damage>0||hits>0||miss){attempts++;if(hits>0)hitRounds++;}
    }
    return{attempts,hitRounds,hitRate:attempts?hitRounds/attempts:null};
  }
  function eventFromHackingResult(p={},ts=Date.now()){
    const starting=Math.max(0,n(p.starting_hp,n(p.max_hp))),current=Math.max(0,n(p.current_hp)),max=Math.max(1,n(p.max_hp,starting||1));
    const hits=compactHitStats(p.combat_log_compact);
    return{
      ts:Number(ts)||Date.now(),victory:Boolean(p.victory),rounds:Math.max(0,n(p.rounds)),streak:Math.max(0,n(p.current_win_streak)),
      xp:Math.max(0,n(p.exp_gained,n(p.gross_exp_earned))),credits:Math.max(0,n(p.credits_gained,n(p.gross_credits_earned))),
      damageDealt:Math.max(0,n(p.damage_dealt)),damageTaken:Math.max(0,n(p.damage_taken)),
      survivalRatio:clamp(current/max),damageTakenRatio:starting>0?clamp(n(p.damage_taken)/starting):null,
      playerAttackAttempts:hits.attempts,playerHitRounds:hits.hitRounds,hitRate:hits.hitRate,
      hackLevel:Math.max(0,n(p.hack_level)),enemyLevel:Math.max(0,n(p.enemy_level)),zoneId:p.zone_id||null
    };
  }
  function avg(list,key){const vals=list.map(x=>x?.[key]).filter(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))).map(Number);return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;}
  function rollup(events=[],windowMs=60*60e3,now=Date.now()){
    const cutoff=Number(now)-Math.max(0,Number(windowMs)||0),xs=events.filter(e=>Number(e?.ts||0)>=cutoff);
    const wins=xs.filter(e=>e.victory).length,attempts=xs.reduce((a,e)=>a+Math.max(0,n(e.playerAttackAttempts)),0),hitRounds=xs.reduce((a,e)=>a+Math.max(0,n(e.playerHitRounds)),0);
    return{fights:xs.length,wins,losses:xs.length-wins,winRate:xs.length?wins/xs.length:null,hitRate:attempts?hitRounds/attempts:null,avgRounds:avg(xs,'rounds'),avgSurvival:avg(xs,'survivalRatio'),avgDamageTakenRatio:avg(xs,'damageTakenRatio'),avgXp:avg(xs,'xp'),avgCredits:avg(xs,'credits'),maxStreak:xs.reduce((m,e)=>Math.max(m,n(e.streak)),0)};
  }
  function adaptiveWeights(metrics={},preset='balanced'){
    const w={accuracy:0,attack:0,crit:0,defense:0,maxhp:0,evasion:0,armor:0,reasons:[]};
    if(Number(metrics.fights||0)<5){w.reasons.push('insufficient combat sample; preserve baseline weights');return w;}
    const hit=metrics.hitRate;
    if(hit!==null&&hit!==undefined&&Number(hit)<.95){const gap=.95-Number(hit);w.accuracy=Math.min(8,2+gap*40);w.reasons.push(`measured hit rate ${(Number(hit)*100).toFixed(1)}% is below 95% target`);}
    const win=metrics.winRate, surv=metrics.avgSurvival;
    if((win!==null&&Number(win)<.8)||(surv!==null&&Number(surv)<.4)){
      const severity=Math.max(win===null?0:.8-Number(win),surv===null?0:.4-Number(surv));w.defense=2+severity*8;w.maxhp=2+severity*7;w.evasion=1.5+severity*6;w.armor=1+severity*5;w.reasons.push('loss rate or remaining HP indicates survivability is limiting streak length');
    }
    if((win===null||Number(win)>=.9)&&(surv===null||Number(surv)>=.6)&&Number(metrics.avgRounds||0)>28){const slow=Math.min(1,(Number(metrics.avgRounds)-28)/25);w.attack=2+slow*5;w.crit=1.5+slow*4;w.reasons.push(`combat is stable but slow at ${Number(metrics.avgRounds).toFixed(1)} rounds/fight`);}
    if(String(preset)==='progression'||String(preset)==='leveling'){w.attack*=.8;w.crit*=.8;}
    return w;
  }

  function effectiveness(metrics={}){
    const win=Math.max(0,Math.min(1,Number(metrics.winRate??0))),hit=Math.max(0,Math.min(1,Number(metrics.hitRate??0))),surv=Math.max(0,Math.min(1,Number(metrics.avgSurvival??0))),rounds=Math.max(0,Number(metrics.avgRounds||0)),speed=Math.max(0,Math.min(1,1-Math.max(0,rounds-5)/35));
    return win*.35+hit*.35+surv*.2+speed*.1;
  }
  function assessChange(before={},after={},opts={}){
    const minFights=Math.max(1,Number(opts.minFights||5));if(Number(before.fights||0)<minFights||Number(after.fights||0)<minFights)return{degraded:false,recommendation:'insufficient-evidence',confidencePenalty:0,beforeScore:effectiveness(before),afterScore:effectiveness(after),delta:0};
    const b=effectiveness(before),a=effectiveness(after),delta=a-b,threshold=Math.max(.02,Number(opts.degradationThreshold||.05)),degraded=delta<=-threshold;
    return{degraded,recommendation:degraded?'rollback-or-reoptimize':delta>=threshold?'keep-and-learn':'hold-and-observe',confidencePenalty:degraded?Math.min(.35,Math.abs(delta)):.0,beforeScore:b,afterScore:a,delta};
  }
  function decisionRecord(slot,beforeId,afterId,metrics,weights,ts=Date.now()){
    return{ts,slot,beforeId,afterId,metrics:{...metrics},weights:{...weights,reasons:undefined},reason:(weights?.reasons||[]).join('; ')||'baseline optimizer score'};
  }
  return{compactHitStats,eventFromHackingResult,rollup,adaptiveWeights,effectiveness,assessChange,decisionRecord};
});
