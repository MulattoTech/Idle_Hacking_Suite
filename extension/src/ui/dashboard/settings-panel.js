'use strict';
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.IHS2SettingsPanel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const field=(path,label,kind='check',options=[],min,max,step)=>({path,label,kind,options,min,max,step});
  const OPTIONS={
    preset:['safe','balanced','maximum','custom'],
    objective:['balanced','xp_per_hour','sustainable_streak','credits_per_hour','accuracy_first'],
    profiles:['adaptive','balanced','itemlevel','leveling','gathering','hacking','loot'],
    craftProfile:['leveling','balanced','gathering','hacking','crafting','combat','loot'],
    budget:['preserve','cautious','balanced','aggressive','burn_it'],
    breach:['safe_afk','balanced_afk','maximum_progression','custom']
  };
  const groups=[
    {title:'Master & Governor',fields:[
      field('masterEnabled','Master automation'),field('masterIntervalMs','Master interval (milliseconds)','number',[],3000,300000,1000),
      field('governor.enabled','Governor enabled'),field('governor.mutationGapMs','Mutation spacing (ms)','number',[],300,10000,50),
      field('governor.queryGapMs','Query spacing (ms)','number',[],100,10000,50),field('governor.maxBackoffMs','Maximum backoff (ms)','number',[],1000,300000,1000),
      field('governor.backgroundYieldPriority','Background yield priority','number',[],0,100,1)]},
    {title:'Equipment Optimizer',fields:[
      field('optimizer.enabled','Optimizer enabled'),field('optimizer.equipWinners','Equip winners after review'),
      field('optimizer.profile','Profile','select',OPTIONS.profiles),field('optimizer.objective','Primary objective','select',OPTIONS.objective),
      field('optimizer.adaptive','Use observed combat data'),field('optimizer.hitRateTarget','Target hit rate (%)','number',[],50,100,.5),
      field('optimizer.minImprovementPct','Minimum projected gain (%)','number',[],0,100,.25),
      field('optimizer.lockWinners','Protect selected items'),field('optimizer.enhanceAfterOptimize','Enhance after optimization'),
      field('optimizer.cleanupEnabled','Inventory cleanup (destructive)')]},
    {title:'Enhancement & Crafting',fields:[
      field('enhance.enabled','Automatic enhancement'),field('enhance.dryRun','Dry Run — no changes or spending'),
      field('enhance.profile','Build profile','select',OPTIONS.craftProfile),
      field('enhance.strategy','Strategy','select',['balanced','maximize-stats','minimize-cost']),
      field('enhance.budgetProfile','Budget preset','select',OPTIONS.budget),
      field('enhance.focusMode','Effect focus','select',['weighted','strict']),
      field('enhance.customEffectIds','Custom effect IDs (comma separated)','text'),
      field('enhance.compilePolicy','Compile policy','select',['when-optimal','terminal','never']),
      field('enhance.targetTier','Target affix tier','select',['auto','T1','T2','T3','T4','T5']),
      field('enhance.refactorBelowPct','Reroll quality floor (%)','number',[],0,100,1),
      field('enhance.allowRiskyVersionUpgrade','Allow risky tier upgrades'),
      field('enhance.allowPrune','Allow destructive affix pruning'),
      field('enhance.maxCreditsPerAction','Credit cap per action (0 blocks credit craft)','number',[],0,1e15,1000),
      field('enhance.maxCreditsPerRun','Credit cap per pass (0 blocks credit craft)','number',[],0,1e15,1000),
      field('enhance.maxResourcePctPerItem','Per-item resource limit (%)','percent',[],0,100,1),
      field('enhance.maxResourcePctPerPass','Per-pass resource limit (%)','percent',[],0,100,1),
      field('enhance.maxResourcePctPerHour','Per-hour resource limit (%)','percent',[],0,100,1),
      field('enhance.maxNonImprovingRerolls','Maximum unsuccessful rerolls','number',[],0,50,1),
      field('enhance.minUtilityGain','Minimum utility gain','number',[],0,1,.001),
      field('enhance.maxRetries','Network retry limit','number',[],0,20,1),
      field('enhance.baseDelayMs','Action delay (ms)','number',[],300,30000,50),
      field('enhance.settlementTimeoutMs','ACK timeout (ms)','number',[],1500,120000,500),
      ...['credits','snippets','cycles','hashes','packets','stabilizers'].map(k=>field('enhance.resourceReserves.'+k,k+' reserve (%)','percent',[],0,100,1)),
      ...['Payload','Firewall','Analyzer','Shell','Driver','Router','Daemon','Kernel'].map(k=>field('enhance.slots.'+k,'Enhance '+k))]},
    {title:'Contracts & Events',fields:[
      field('contracts.enabled','Contracts enabled'),field('contracts.autoClaim','Claim completed contracts'),
      field('contracts.autoAccept','Select available contracts'),field('contracts.autoSwitch','Auto-switch contracts'),
      field('contracts.switchGainPct','Switch gain threshold (%)','number',[],0,500,1),
      field('contracts.preferRoleAligned','Prefer active gameplay role'),field('contracts.recoveryPollMs','Background contract refresh (ms)','number',[],5000,300000,1000),
      field('events.enabled','Events enabled'),field('events.role','Event role','select',['hacker','gatherer']),
      field('events.autoSwitch','Auto-switch event activity'),field('events.autoFallbackRole','Allow fallback event role')]},
    {title:'Network Breach',fields:[
      field('breach.enabled','Breach enabled'),field('breach.autopilot','Run Breach autopilot'),
      field('breach.preset','Breach preset','select',OPTIONS.breach),
      field('breach.className','Class','select',['auto','daemonbinder','gatewarden','tracewalker','nullblade']),
      field('breach.movement','Movement','select',['Full Clear','Fast Clear']),
      field('breach.autoJoinPublic','Join public lobbies'),field('breach.minLobbyLevel','Minimum lobby level','number',[],1,500,1),
      field('breach.alwaysReady','Always ready'),field('breach.readyForMultiple','Ready for repeat runs'),
      field('breach.autoTalent','Allocate talents'),field('breach.talentMode','Talent mode','select',['server_auto','extension','manual']),
      field('breach.autoRelics','Optimize relics'),field('breach.autoUpgrade','Upgrade relics'),
      field('breach.shardReserve','Cipher shard reserve','number',[],0,1e12,100),
      field('breach.repeatStarts','Repeat starts','number',[],0,10,1),
      field('breach.autoRefillRepeats','Refill starts when needed'),
      field('breach.continueAfterWipe','Resume after wipe'),field('breach.autoPrestige','Auto prestige'),
      field('breach.prestigeAllocation','Prestige stat','select',['adaptive','themed','integrity','hold']),
      field('breach.automationPaused','Pause Breach actions'),field('breach.extractionTarget','Extraction target','select',['auto','max','fast'])]},
    {title:'Economy, Resource Strategy & Marketplace',fields:[
      field('resources.enabled','Resource strategy enabled'),
      field('resources.mode','Resource strategy','select',['bottleneck_balancer','target_reserve','progression_priority']),
      field('economy.enabled','Hardware economy automation'),field('economy.aggressiveness','Economy aggressiveness','select',['conservative','balanced','aggressive','uncapped']),
      field('economy.creditReservePct','Economy credit reserve (%)','percent',[],0,100,1),
      field('shopHomelab.enabled','Homelab automation'),field('shopHomelab.creditReservePct','Homelab credit reserve (%)','percent',[],0,100,1),
      field('marketplace.enabled','Marketplace enabled'),field('marketplace.continuousScan','Continuous market history scanning'),
      field('marketplace.scanIntervalMinutes','Scan interval (minutes)','number',[],1,180,1),
      field('marketplace.autoArbitrage','Auto arbitrage (live trading)'),
      field('marketplace.confirmLiveTrading','Allow real purchases and listings'),
      field('marketplace.minProfitPct','Minimum trade profit (%)','number',[],0,1000,1),
      field('marketplace.maxCreditsPerTrade','Max credits per trade','number',[],0,1e15,1000),
      field('marketplace.inventoryReserveSlots','Empty inventory slots to protect','number',[],0,200,1),
      field('marketplace.autoListSurplus','Automatically list surplus'),
      field('marketplace.cleanupEnabled','Automated listing cleanup'),
      field('marketplace.cleanupDryRun','Listing cleanup Dry Run'),
      field('marketplace.autoReprice','Automatically reprice market listings')]},
    {title:'Backups & Google Drive (requires OAuth setup)',fields:[
      field('cloud.autoSync','Automatic Drive sync every 15 minutes'),
      field('cloud.folderName','Google Drive backup folder name','text'),
      field('cloud.folderId','Existing Google Drive folder ID (optional)','text')]},
    {title:'History & Diagnostics',fields:[
      field('telemetry.enabled','Record local telemetry'),
      field('telemetry.rawCombatRetentionDays','Combat event retention (days)','number',[],1,365,1),
      field('telemetry.rollupRetentionDays','Rollup retention (days)','number',[],1,3650,1),
      field('changelog.enabled','Capture changelog updates'),
      field('changelog.highImpactOnly','Show only important changes')]}
  ];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const get=(obj,path)=>path.split('.').reduce((v,k)=>v?.[k],obj);
  function set(obj,path,value){const parts=path.split('.');let at=obj;for(const k of parts.slice(0,-1))at=at[k]&&typeof at[k]==='object'?at[k]:(at[k]={});at[parts.at(-1)]=value;}
  function formatField(f,value,index){
    const id='fineControl_'+index;
    const attrs='data-setting="'+esc(f.path)+'" data-kind="'+f.kind+'" id="'+id+'"';
    let control='';
    if(f.kind==='check')control='<input type="checkbox" '+attrs+(value?' checked':'')+'>';
    else if(f.kind==='select')control='<select class="select" '+attrs+'>'+f.options.map(v=>'<option value="'+esc(v)+'"'+(String(value??'')===v?' selected':'')+'>'+esc(v.replace(/_/g,' '))+'</option>').join('')+'</select>';
    else control='<input type="'+(f.kind==='text'?'text':'number')+'" '+attrs+
      (f.kind!=='text'?' min="'+f.min+'" max="'+f.max+'" step="'+f.step+'"':'')+
      ' value="'+esc(f.kind==='percent'?Number(value??0)*100:(value??''))+'">';
    return '<div class="fine-control"><label for="'+id+'">'+esc(f.label)+'</label>'+control+'</div>';
  }
  function render(settings,mount){
    if(!mount)return;
    let index=0;
    mount.innerHTML=groups.map((g,i)=>'<details class="fine-group"'+(i<2?' open':'')+'><summary>'+esc(g.title)+' <small>'+g.fields.length+' settings</small></summary><div class="fine-grid">'+
      g.fields.map(f=>formatField(f,get(settings,f.path),index++)).join('')+'</div></details>').join('');
  }
  function collect(settings,mount){
    if(!mount)return settings;
    for(const el of mount.querySelectorAll('[data-setting]')){
      const path=el.dataset.setting,kind=el.dataset.kind;
      const field=groups.flatMap(g=>g.fields).find(f=>f.path===path);
      if(!field)continue;
      let value=kind==='check'?el.checked:kind==='number'||kind==='percent'?Number(el.value):el.value;
      if(kind==='number'||kind==='percent'){
        if(!Number.isFinite(value))continue;
        value=Math.max(field.min,Math.min(field.max,value));
        if(kind==='percent')value/=100;
      }
      set(settings,path,value);
    }
    return settings;
  }
  return{groups,get,set,render,collect};
});
