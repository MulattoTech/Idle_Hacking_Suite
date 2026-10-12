(function(root,factory){
  const out=factory();
  if(typeof module!=='undefined'&&module.exports)module.exports=out;
  root.IHS2=root.IHS2||{};Object.assign(root.IHS2,out);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const defaults={
    settingsSchemaVersion:200,
    preset:'balanced',
    masterEnabled:false,
    masterIntervalMs:15000,
    governor:{enabled:true,mutationGapMs:700,queryGapMs:180,maxBackoffMs:60000,backgroundYieldPriority:50},
    optimizer:{enabled:true,equipWinners:true,profile:'adaptive',minImprovementPct:0,lockWinners:true,enhanceAfterOptimize:false,cleanupEnabled:false,adaptive:true,hitRateTarget:95},
    enhance:{enabled:false,dryRun:true,strategy:'balanced',profile:'leveling',budgetProfile:'balanced',compilePolicy:'when-optimal',targetTier:'auto',refactorBelowPct:75,allowRiskyVersionUpgrade:false,allowPrune:false,maxCreditsPerAction:0,maxCreditsPerRun:0,maxRetries:4,baseDelayMs:450,maxDelayMs:12000,settlementTimeoutMs:10000,preferredEffects:['xp_global','xp_gathering','xp_hack'],customEffectIds:'',focusMode:'weighted',resourceReserves:{credits:0.10,snippets:0.15,cycles:0.15,hashes:0.20,packets:0.20,stabilizers:0.15},maxResourcePctPerItem:0.15,maxResourcePctPerPass:0.30,maxResourcePctPerHour:0.50,maxNonImprovingRerolls:4,minUtilityGain:0.01,slots:{Payload:true,Firewall:true,Analyzer:true,Shell:true,Driver:true,Router:true,Daemon:true,Kernel:true}},
    breach:{enabled:true,autopilot:true,preset:'balanced_afk',className:'auto',movement:'Full Clear',autoJoinPublic:true,minLobbyLevel:1,preferNetwork:'highest',alwaysReady:true,readyForMultiple:true,talentMode:'server_auto',autoTalent:true,autoRelics:true,autoUpgrade:true,shardReserve:1000,repeatStarts:10,autoRefillRepeats:true,continueAfterWipe:true,autoPrestige:true,prestigeAllocation:'adaptive',automationPaused:false,extractionTarget:'auto'},
    contracts:{enabled:true,autoClaim:true,autoAccept:true,autoSwitch:true,switchGainPct:35,preferRoleAligned:true,recoveryPollMs:45000},
    events:{enabled:true,role:'hacker',autoSwitch:true,autoFallbackRole:true},
    resources:{enabled:false,mode:'bottleneck_balancer',aggressiveness:'balanced',reserveRatios:{}},
    economy:{enabled:false,aggressiveness:'balanced',creditReservePct:0.10,preferAutomationController:true},
    shopHomelab:{enabled:false,aggressiveness:'balanced',creditReservePct:0.10,preferAutomationController:true},
    marketplace:{enabled:false,confirmLiveTrading:false,autoArbitrage:false,minProfitPct:20,arbitrageSafetyPct:10,maxCreditsPerTrade:0,maxTradesPerRun:3,inventoryReserveSlots:8,autoListSurplus:false,maxListActionsPerPass:25,pricingMode:'fast',undercutPct:2,scanAllEquipment:true,continuousScan:true,scanIntervalMinutes:10,pageDelayMs:550,autoReprice:false,repriceThresholdPct:10,minComparableSamples:3,useCompletedSales:true,cleanupEnabled:false,cleanupDryRun:true,cleanupMode:'expired',cleanupIntervalMinutes:60,cleanupSearch:'',cleanupSlot:'Any',cleanupRarity:'Any',cleanupAutoExpired:true,cleanupIncludeSignatures:false,cleanupIncludeExtensionSlots:false},
    telemetry:{enabled:true,rawCombatRetentionDays:7,rollupRetentionDays:90},
    changelog:{enabled:true,highImpactOnly:false}
  };
  const presets={
    safe:{enhance:{budgetProfile:'preserve'},economy:{aggressiveness:'conservative',creditReservePct:0.30},shopHomelab:{aggressiveness:'conservative',creditReservePct:0.30},breach:{preset:'safe_afk',repeatStarts:5,prestigeAllocation:'hold'},marketplace:{autoArbitrage:false}},
    balanced:{enhance:{budgetProfile:'balanced'},economy:{aggressiveness:'balanced',creditReservePct:0.10},shopHomelab:{aggressiveness:'balanced',creditReservePct:0.10},breach:{preset:'balanced_afk',repeatStarts:10,prestigeAllocation:'adaptive'}},
    maximum:{enhance:{budgetProfile:'aggressive'},economy:{aggressiveness:'aggressive',creditReservePct:0.03},shopHomelab:{aggressiveness:'aggressive',creditReservePct:0.03},breach:{preset:'maximum_progression',repeatStarts:10,prestigeAllocation:'adaptive'},marketplace:{minProfitPct:12}}
  };
  return {IHS2_DEFAULTS:defaults,IHS2_PRESETS:presets};
});
