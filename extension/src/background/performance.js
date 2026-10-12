'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.IHS2=root.IHS2||{};root.IHS2.Performance=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const clamp=(x,min=0,max=100)=>Math.max(min,Math.min(max,Number(x)||0));
  const round=x=>Math.round(x*100)/100;
  function summarize(events=[],maxFights=120){
    const selected=(events||[]).filter(e=>e&&Number.isFinite(Number(e.ts)))
      .sort((a,b)=>Number(a.ts)-Number(b.ts)).slice(-Math.max(1,maxFights));
    const fights=selected.length,wins=selected.filter(e=>e.won===true||e.victory===true).length;
    const rounds=selected.map(e=>Number(e.rounds)).filter(n=>Number.isFinite(n)&&n>0);
    const survivals=selected.map(e=>Number(e.survivalRatio)).filter(n=>Number.isFinite(n)&&n>=0&&n<=1);
    const withHitData=selected.filter(e=>Number(e.playerAttackAttempts)>0&&Number.isFinite(Number(e.playerHitRounds)));
    const attempts=withHitData.reduce((n,e)=>n+Number(e.playerAttackAttempts),0);
    const hits=withHitData.reduce((n,e)=>n+Math.min(Number(e.playerAttackAttempts),Math.max(0,Number(e.playerHitRounds))),0);
    const winRate=fights?wins/fights*100:0;
    const hitRate=attempts?hits/attempts*100:null;
    const avgRounds=rounds.length?rounds.reduce((a,b)=>a+b,0)/rounds.length:null;
    const survival=survivals.length?survivals.reduce((a,b)=>a+b,0)/survivals.length*100:null;
    const roundScore=avgRounds===null?null:clamp(100*(60-avgRounds)/45);
    // Only genuine attack counters are used for accuracy; missing fights are not misses.
    // Weights are explicit policy coefficients, not inferred first-party combat mechanics.
    const signals=[{weight:.55,value:winRate},{weight:.30,value:roundScore},{weight:.15,value:hitRate}].filter(x=>x.value!==null);
    const weightTotal=signals.reduce((s,x)=>s+x.weight,0);
    const hackingEfficiency=fights?round(signals.reduce((s,x)=>s+x.weight*x.value,0)/weightTotal):null;
    const streakStability=fights?round((winRate*.65+(survival===null?winRate:survival)*.35)):null;
    const automationSuccess=fights?round(Math.sqrt(hackingEfficiency*streakStability)):null;
    const measuredMetrics=(rounds.length?1:0)+(survivals.length?1:0)+(attempts>=20?1:0);
    const confidence=fights>=100&&attempts>=100?'high':fights>=30&&measuredMetrics>=2?'medium':'low';
    return {fights,wins,losses:fights-wins,winRate:round(winRate),
      hitRate:hitRate===null?null:round(hitRate),attackAttempts:attempts,hitSampleFights:withHitData.length,
      avgRounds:avgRounds===null?null:round(avgRounds),avgSurvival:survival===null?null:round(survival),
      hackingEfficiency,streakStability,automationSuccess,confidence,
      sampleLabel:'last '+fights+' recorded fights',lastFightAt:selected.at(-1)?.ts||null};
  }
  function trends(events=[],maxFights=120){
    const sorted=[...(events||[])].filter(e=>e&&Number.isFinite(Number(e.ts))).sort((a,b)=>Number(a.ts)-Number(b.ts));
    const current=summarize(sorted.slice(-maxFights),maxFights);
    const previous=summarize(sorted.slice(-maxFights*2,-maxFights),maxFights);
    const delta=current.fights>=30&&previous.fights>=30?{
      score:round(current.automationSuccess-previous.automationSuccess),
      hackingEfficiency:round(current.hackingEfficiency-previous.hackingEfficiency),
      streakStability:round(current.streakStability-previous.streakStability)
    }:null;
    return {current,previous,delta,comparison:'previous '+maxFights+' recorded fights',requiredForComparison:maxFights*2};
  }
  return {summarize,trends};
});
