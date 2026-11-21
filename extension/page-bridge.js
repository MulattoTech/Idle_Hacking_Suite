'use strict';

(() => {
  if (globalThis.__IHS_PAGE_BRIDGE__) return;
  globalThis.__IHS_PAGE_BRIDGE__ = true;

  const SOURCE = 'IDLE_HACKING_SUITE';
  const SLOT_NAMES = ['Payload','Firewall','Analyzer','Shell','Driver','Router','Daemon','Kernel'];
  const SIGNATURE_NAMES = [
    'Refreshing Corruption','Cascade Failure','Spiteful Thorns','Recursive Overload',
    'Spiked Feedback','Combat Reboot','Reserve Battery','Piercing Shred',
    'Protocol Hijack','Counter-Forensics','Interrupt Handler','Stable Construction',
    'Optimization Pass','Market Arbitrage','Risk Assessment'
  ];
  const RARITY_WEIGHT = {Basic:0,Common:1,Uncommon:2,Rare:3,Epic:4};
  const STAT_WEIGHTS = {
    damage:2.2, attack:2.2, accuracy:2.0, 'attack speed':1.9,
    'critical chance':1.8, 'critical damage':1.8, 'armor pen':1.8,
    defense:1.5, 'maximum hp':1.45, 'max hp':1.45, evasion:1.55,
    regeneration:1.35, barrier:1.45, thorns:1.4, corruption:1.8,
    credits:0.7, chips:0.65, experience:0.6, xp:0.6
  };

  const DEFAULTS = {
    masterEnabled:false,
    masterIntervalMs:15000,
    optimizer:{enabled:true,equipWinners:true,profile:'balanced',minImprovementPct:0,lockWinners:true,enhanceAfterOptimize:false,cleanupEnabled:false},
    enhance:{
      enabled:false,dryRun:true,strategy:'balanced',profile:'leveling',compilePolicy:'when-optimal',
      targetTier:'auto',refactorBelowPct:75,allowRiskyVersionUpgrade:false,allowPrune:false,maxCreditsPerAction:0,maxCreditsPerRun:0,
      maxRetries:4,baseDelayMs:450,maxDelayMs:12000,settlementTimeoutMs:10000,
      preferredEffects:['xp_global','xp_gathering','xp_hack'],customEffectIds:'',focusMode:'weighted',
      slots:{Payload:true,Firewall:true,Analyzer:true,Shell:true,Driver:true,Router:true,Daemon:true,Kernel:true}
    },
    breach:{enabled:false,autoOptIn:false,className:'auto',movement:'Full Clear',autoDraft:true,autoUpgrade:true,autopilot:false,autoJoinPublic:true,minLobbyLevel:1,preferNetwork:'highest',readyForMultiple:true,autoPrestige:true,prestigeAllocation:'themed',autoTalent:true,autoRelics:true,shardReserve:1000},
    contracts:{enabled:true,autoClaim:true,autoAccept:true,autoSwitch:true,switchGainPct:35,preferRoleAligned:true},
    events:{enabled:true,role:'hacker',autoSwitch:true,autoFallbackRole:true},
    resources:{enabled:false,mode:'bottleneck_balancer'},
    shopHomelab:{enabled:false,maxCreditsPerPurchase:0,maxCreditsPerRun:0,preferAutomationController:true},
    marketplace:{enabled:false,confirmLiveTrading:false,autoArbitrage:false,minProfitPct:20,arbitrageSafetyPct:10,maxCreditsPerTrade:0,maxTradesPerRun:3,inventoryReserveSlots:8,autoListSurplus:false,maxListActionsPerPass:25,pricingMode:'fast',undercutPct:2,scanAllEquipment:true,continuousScan:true,scanIntervalMinutes:10,pageDelayMs:550,autoReprice:false,repriceThresholdPct:10,minComparableSamples:3,useCompletedSales:true,cleanupEnabled:false,cleanupDryRun:true,cleanupMode:'expired',cleanupIntervalMinutes:60,cleanupSearch:'',cleanupSlot:'Any',cleanupRarity:'Any',cleanupAutoExpired:true,cleanupIncludeSignatures:false,cleanupIncludeExtensionSlots:false}
  };

  const STATE = {
    settings: structuredClone(DEFAULTS),
    runningEngine:null,
    stopRequested:false,
    inventory:[],
    equipped:{},
    finalKeepSet:{},
    signatureIds:new Set(),
    sessionTouchedIds:new Set(),
    quarantineIds:new Set(),
    neverDeleteIds:new Set(),
    deleteCandidates:new Set(),
    purgeEnabled:true,
    wsSeq:0,
    wsOutboundTypes:new Set(),
    wsInboundTypes:new Set(),
    lastRateLimitAt:0,
    retryAfterMs:0,
    logs:[],
    enhanceStatus:'idle',
    lastRuns:{},
    loopHandle:null,
    gameWs:null,
    breachState:null,
    breachRegistries:null,
    breachPublicLobbies:[],
    breachPublicLobbyRevision:0,
    breachLastCommandAt:{},
    breachLastAction:'idle',
    breachLastLoadoutKey:'',
    breachLastTalentAction:null,
    contractsState:null,
    contractsStateAt:0,
    contractPreviousBoardKey:null,
    contractLastCommandAt:{},
    contractLastAction:'idle',
    contractPending:null,
    contractLastVerifiedAt:0,
    contractLastRejected:null,
    eventStatus:null,
    eventParticipation:null,
    eventStatusAt:0,
    eventLastCommandAt:{},
    eventLastAction:'idle',
    eventLastJoinResult:null,
    eventLastError:null,
    hardwareInfo:null,
    homelabInfo:null,
    economyRecommendation:null,
    resourceStrategyStatus:null,
    marketScan:{active:false,scanId:null,page:0,pages:0,total:0,listings:0,resumePage:1,lastStartedAt:0,lastCompletedAt:0,lastError:null,nextRetryAt:0,backoffMs:0},
    marketResponseWaiters:[],
    marketActivityWaiters:[],
    marketOwnedListings:[],
    marketRecentListings:new Map(),
    marketPurchasedListingIds:new Set(),
    marketLastCommandAt:{},
    marketLastSalesScanAt:0,
    marketCleanup:{running:false,lastRunAt:0,lastResult:'idle',lastCandidates:0,lastError:null},
    extensionRequests:new Map(),
    lastInventoryUpdateAt:0,
    lastServerError:null,
    lastActionResult:null,
    pendingGameAction:null,
    actionLastCommandAt:{},
    actionTrace:[],
    optimizerPlan:[],
    optimizerResult:[],
    enhancePlan:[],
    enhanceResult:[],
    combatEvents:[],
    combatMetrics:null,
    adaptiveWeights:null,
    enhanceBudgetLedger:null,
    optimizerEvidenceBaseline:null,
    optimizerOutcome:null,
    optimizerPenaltyIds:new Set()
  };

  globalThis.__IHS_STATE__ = STATE;
  const automationRechecks=globalThis.IHS2?.createRecheckScheduler?.();

  function merge(base, value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return structuredClone(base);
    const out = structuredClone(base);
    for (const [k,v] of Object.entries(value)) {
      if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
        out[k] = merge(out[k], v);
      } else out[k] = v;
    }
    return out;
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => String(s ?? '').replace(/\s+/g,' ').trim();
  const upper = s => norm(s).toUpperCase();
  const visible = el => !!el && !el.disabled && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';

  // The game defines several important values as top-level lexical bindings (`let`),
  // which are visible in MAIN world but are not guaranteed to be properties of globalThis.
  // Always prefer the lexical binding and only fall back to globalThis for older builds.
  function liveCurrentPlayer(){ try { return typeof currentPlayer!=='undefined' ? currentPlayer : (globalThis.currentPlayer||null); } catch { return globalThis.currentPlayer||null; } }
  function liveInventoryData(){ try { return typeof inventoryData!=='undefined' ? inventoryData : (globalThis.inventoryData||null); } catch { return globalThis.inventoryData||null; } }
  function liveEquipmentData(){ try { return typeof equipmentData!=='undefined' ? equipmentData : (globalThis.equipmentData||null); } catch { return globalThis.equipmentData||null; } }
  function liveHardwareInfo(){ try { return typeof hardwareInfo!=='undefined' ? hardwareInfo : (globalThis.hardwareInfo||STATE.hardwareInfo||null); } catch { return globalThis.hardwareInfo||STATE.hardwareInfo||null; } }
  function liveHomelabInfo(){ try { return typeof homelabInfo!=='undefined' ? homelabInfo : (globalThis.homelabInfo||STATE.homelabInfo||null); } catch { return globalThis.homelabInfo||STATE.homelabInfo||null; } }
  function liveGearSetUsageCount(itemId){ try { if(typeof getGearSetUsageCountForItem==='function') return Number(getGearSetUsageCountForItem(itemId))||0; } catch {} try { if(typeof globalThis.getGearSetUsageCountForItem==='function') return Number(globalThis.getGearSetUsageCountForItem(itemId))||0; } catch {} return 0; }
  function inventoryCapacity(){
    const d=liveInventoryData()||{}, p=liveCurrentPlayer()||{};
    const vals=[d.max_slots,d.maxSlots,d.capacity,d.max_items,p.inventory_max_slots,p.inventory_capacity,p.max_inventory];
    for(const v of vals){const n=Number(v);if(Number.isFinite(n)&&n>0)return Math.floor(n);}
    const body=norm(document.body?.innerText||''); const m=body.match(/INVENTORY\s*:?\s*\d+\s*\/\s*(\d+)/i);
    return m?Number(m[1]):0;
  }
  function inventoryFreeSlots(){const cap=inventoryCapacity();return cap>0?Math.max(0,cap-readInventory().length):Infinity;}

  function log(message, level='info') {
    const line = `[${new Date().toLocaleTimeString()}] ${message}`;
    STATE.logs.push({ts:Date.now(),level,message:line});
    if (STATE.logs.length > 300) STATE.logs.splice(0, STATE.logs.length - 300);
    try { console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log']('[IHS]', message); } catch {}
    emitStatus();
  }

  function status() {
    return {
      bridgeReady:true,
      runningEngine:STATE.runningEngine,
      inventoryCount:STATE.inventory.length,
      inventoryCapacity:inventoryCapacity(),
      inventoryFreeSlots:inventoryFreeSlots(),
      equippedCount:Object.keys(STATE.equipped).length,
      protectedCount:new Set([...Object.values(STATE.finalKeepSet),...STATE.signatureIds,...STATE.sessionTouchedIds,...STATE.quarantineIds]).size,
      signatureCount:STATE.signatureIds.size,
      enhanceStatus:STATE.enhanceStatus,
      wsOutboundTypes:[...STATE.wsOutboundTypes].slice(-30),
      wsInboundTypes:[...STATE.wsInboundTypes].slice(-30),
      purgeEnabled:STATE.purgeEnabled,
      marketScan:{active:STATE.marketScan.active,page:STATE.marketScan.page,pages:STATE.marketScan.pages,total:STATE.marketScan.total,listings:STATE.marketScan.listings,resumePage:STATE.marketScan.resumePage,lastCompletedAt:STATE.marketScan.lastCompletedAt,lastError:STATE.marketScan.lastError,nextRetryAt:STATE.marketScan.nextRetryAt},
      marketOwnedListings:STATE.marketOwnedListings.length,
      lastServerError:STATE.lastServerError ? {ts:STATE.lastServerError.ts,code:STATE.lastServerError.code,message:STATE.lastServerError.message,actionType:STATE.lastServerError.actionType||null} : null,
      governor:globalThis.IHS2?.governor?.snapshot?.()||null,
      optimizerLast:STATE.optimizerResult.at(-1)||null,
      enhanceLast:STATE.enhanceResult.at(-1)||null,
      breach:{enabled:Boolean(STATE.settings.breach?.enabled),autopilot:Boolean(STATE.settings.breach?.autopilot),lastAction:STATE.breachLastAction,sessionId:STATE.breachState?.session_id||'',status:STATE.breachState?.status||'idle',publicLobbyCount:STATE.breachPublicLobbies.length,classId:breachPreferredClassId?.()||''},
      contracts:{lastAction:STATE.contractLastAction,activeId:STATE.contractsState?.active_contract_id||'',board:STATE.contractsState?.board_key||'',loaded:Boolean(STATE.contractsState),pending:STATE.contractPending,lastVerifiedAt:STATE.contractLastVerifiedAt,lastRejected:STATE.contractLastRejected},
      event:{lastAction:STATE.eventLastAction,eventId:STATE.eventStatus?.event_id||'',phase:STATE.eventStatus?.phase||'idle',joinWindowOpen:Boolean(STATE.eventStatus?.join_window_open),optedIn:Boolean(STATE.eventParticipation?.opted_in),role:STATE.eventParticipation?.role||'',lastError:STATE.eventLastError},
      economy:{recommendation:STATE.economyRecommendation||null,hardwareLoaded:Boolean(liveHardwareInfo()),homelabLoaded:Boolean(liveHomelabInfo())},
      resourceStrategy:{mode:STATE.settings.resources?.mode||'bottleneck_balancer',status:STATE.resourceStrategyStatus||null,directStoreAutomation:false},
      lastLog:STATE.logs.at(-1)?.message || 'Ready'
    };
  }

  function emit(type, payload={}, requestId=null) {
    window.postMessage({source:SOURCE,channel:'PAGE_TO_EXTENSION',type,requestId,payload}, '*');
  }
  function emitStatus() { emit('STATUS', {status:status()}); }
  function result(requestId, ok=true, data={}) { emit('RESULT', {ok,...data}, requestId); }

  function parseMaybeJson(data) {
    if (typeof data !== 'string') return null;
    try { return JSON.parse(data); } catch { return null; }
  }
  function messageType(data) {
    const j = parseMaybeJson(data);
    if (j && typeof j === 'object') return String(j.type || j.event || j.action || j.op || j.messageType || 'JSON');
    const t = typeof data === 'string' ? data.slice(0,140) : Object.prototype.toString.call(data);
    const m = String(t).match(/[A-Z][A-Z0-9_]{3,}/);
    return m?.[0] || 'OTHER';
  }
  function inspectRateLimit(data) {
    const msg=parseMaybeJson(data);
    if(!globalThis.IHS2?.isServerRateLimit?.(msg))return;
    const p=msg?.payload||{};
    const exactMs=Number(p.retry_after_ms??p.retryAfterMs??0);
    const seconds=Number(p.retry_after_seconds??0);
    STATE.lastRateLimitAt=Date.now();
    STATE.retryAfterMs=Math.max(0,Number.isFinite(exactMs)?exactMs:0,Number.isFinite(seconds)?seconds*1000:0);
    try{globalThis.IHS2?.governor?.observeRateLimit({retryAfterMs:STATE.retryAfterMs,subsystem:'global'});}catch{}
    log(`Rate-limit rejection received${STATE.retryAfterMs?`; retry after ${STATE.retryAfterMs} ms`:''}`,'warn');
  }

  // Passive WebSocket observation. Mutations still use the game's normal client/UI path.
  try {
    const NativeWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = new Proxy(NativeWebSocket, {
      construct(Target, args) {
        const ws = new Target(...args);
        if (/idlehacking\.com\/ws/i.test(String(args[0] || ''))) STATE.gameWs = ws;
        ws.addEventListener('message', ev => {
          STATE.wsSeq++;
          const typ=messageType(ev.data);
          STATE.wsInboundTypes.add(typ);
          inspectRateLimit(ev.data);
          const msg=parseMaybeJson(ev.data);
          if (msg?.type === 'ERROR') {
            const payload=msg.payload||{};
            const pending=STATE.pendingGameAction,code=String(payload.code||'ERROR');
            const related=pending&&globalThis.IHS2?.errorMatchesAction?.(code,pending.type)!==false?pending:null;
            STATE.lastServerError={ts:Date.now(),code,message:String(payload.message||'Server rejected action'),actionType:related?.type||null,itemId:related?.itemId||null};
            if(related) traceAction({type:related.type,itemId:related.itemId,result:'error',detail:`${code}: ${STATE.lastServerError.message}`});
            if(code==='BREACH_STALE_VERSION'){
              STATE.breachLastAction='server state changed; waiting for fresh Breach state';
              setTimeout(()=>breachProtocolSend('GET_BREACH_STATE',{},'stale-version-refresh',4500),700);
            }
          } else if (/^EQUIPMENT_(?:AUGMENT|ANNUL|MASTERWORK|TIER_PROMOTE|COMPILE)_RESULT$/.test(String(msg?.type||''))) {
            const pending=STATE.pendingGameAction;
            STATE.lastActionResult={ts:Date.now(),resultType:String(msg.type),actionType:pending?.type||null,itemId:pending?.itemId||String(msg.payload?.item?.id||''),payload:msg.payload||{}};
          } else if (msg?.type === 'HACKING_RESULT') {
            const payload=msg.payload||{};
            const ev=globalThis.IHS2?.CombatAdvisor?.eventFromHackingResult?.(payload,Date.now());
            if(ev){
              STATE.combatEvents.push(ev); if(STATE.combatEvents.length>120)STATE.combatEvents.splice(0,STATE.combatEvents.length-120);
              STATE.combatMetrics=globalThis.IHS2?.CombatAdvisor?.rollup?.(STATE.combatEvents,60*60*1000,Date.now())||null;
              STATE.adaptiveWeights=globalThis.IHS2?.CombatAdvisor?.adaptiveWeights?.(STATE.combatMetrics,STATE.settings.optimizer?.profile,STATE.settings.optimizer?.hitRateTarget)||null;
              emit('IHS2_TELEMETRY',{store:'combat_events',value:ev});
              emit('IHS2_TELEMETRY',{store:'metrics_snapshots',value:{ts:Date.now(),kind:'combat_efficiency',...(STATE.combatMetrics||{})}});
            }
            if(payload.contracts_update&&STATE.contractsState){STATE.contractsState={...STATE.contractsState,...payload.contracts_update};STATE.contractsStateAt=Date.now();if(STATE.settings.contracts?.enabled)setTimeout(()=>runContracts().catch(()=>{}),20);}
          } else if (msg?.type === 'BREACH_STATE' || msg?.type === 'BREACH_TICK') {
            const payload=msg.payload || {};
            if (msg.type === 'BREACH_STATE') {
              STATE.breachState=payload;
              if (payload.registries) STATE.breachRegistries=payload.registries;
              if(STATE.settings.breach?.enabled&&STATE.settings.breach?.autopilot&&STATE.settings.breach?.alwaysReady!==false)setTimeout(()=>runBreachAutopilot().catch(()=>{}),20);
            } else if (STATE.breachState && payload.session_id === STATE.breachState.session_id) {
              // Ticks are compact/delta encoded in newer builds. Preserve the authoritative full state
              // rather than guessing how to merge an unrecognized transport revision.
            }
          } else if (msg?.type === 'BREACH_PUBLIC_LOBBIES') {
            const rev=Math.max(0,Number(msg.payload?.revision || 0));
            if (rev >= STATE.breachPublicLobbyRevision) {
              STATE.breachPublicLobbyRevision=rev;
              STATE.breachPublicLobbies=Array.isArray(msg.payload?.lobbies) ? msg.payload.lobbies : [];
            }
          } else if (msg?.type === 'BREACH_ENDED') {
            STATE.breachLastAction='run ended';
            // Request fresh authoritative progression before considering a recompile/rejoin.
            setTimeout(()=>breachProtocolSend('GET_BREACH_STATE',{},'refresh-after-end',1200),250);
          } else if (msg?.type === 'CONTRACTS_STATE') {
            const priorBoard=STATE.contractsState?.board_key||STATE.contractPreviousBoardKey||null;
            STATE.contractPreviousBoardKey=priorBoard; STATE.contractsState=msg.payload||null; STATE.contractsStateAt=Date.now();
            if(STATE.settings.contracts?.enabled)setTimeout(()=>runContracts().catch(()=>{}),25);
          } else if (msg?.type === 'CONTRACT_CLAIM_RESULT') {
            if(msg.payload?.contracts){STATE.contractsState=globalThis.IHS2?.ContractExecution?.mergeClaimPayload?.(STATE.contractsState,msg.payload)||STATE.contractsState;STATE.contractsStateAt=Date.now();}
            STATE.contractLastAction='claim result received; waiting for board verification';
            if(STATE.settings.contracts?.enabled)setTimeout(()=>runContracts().catch(()=>{}),60);
          } else if (msg?.type === 'CONTRACTS_UPDATE') {
            const u=msg.payload||{}; if(STATE.contractsState){STATE.contractsState={...STATE.contractsState,...u};STATE.contractsStateAt=Date.now();}
            if(STATE.settings.contracts?.enabled)setTimeout(()=>runContracts().catch(()=>{}),40);
          } else if (msg?.type === 'EVENT_NOTICE') {
            const x=msg.payload||{}; STATE.eventStatus={event_id:x.event_id,event_type:x.event_type,phase:'notice',notice_start_ms:x.notice_start_ms,active_start_ms:x.active_start_ms,ends_at_ms:x.ends_at_ms,join_window_open:true}; STATE.eventStatusAt=Date.now(); if(!STATE.eventParticipation?.opted_in)STATE.eventParticipation={opted_in:false}; if(STATE.settings.events?.enabled)setTimeout(()=>runEvents().catch(()=>{}),30);
          } else if (msg?.type === 'EVENT_STATUS') {
            STATE.eventStatus=msg.payload?.status||null; STATE.eventParticipation=msg.payload?.my_participation||STATE.eventParticipation; STATE.eventStatusAt=Date.now(); STATE.eventLastError=null; if(STATE.settings.events?.enabled)setTimeout(()=>runEvents().catch(()=>{}),30);
          } else if (msg?.type === 'EVENT_JOIN_RESULT') {
            const x=msg.payload||{}; STATE.eventLastJoinResult=x; STATE.eventLastAction=x.accepted?(x.opted_out?'left event':`joined ${x.role||'event'}`):`join rejected: ${x.reason_code||'unknown'}`;
            if(x.accepted&&!x.opted_out)STATE.eventParticipation={...(STATE.eventParticipation||{}),opted_in:true,role:x.role||STATE.eventParticipation?.role||''}; else if(x.opted_out)STATE.eventParticipation={opted_in:false}; if(STATE.settings.events?.enabled)setTimeout(()=>runEvents().catch(()=>{}),80);
          } else if (msg?.type === 'EVENT_ROLE_CHANGED') {
            const x=msg.payload||{}; STATE.eventParticipation={...(STATE.eventParticipation||{}),opted_in:true,role:x.role||''}; STATE.eventLastAction=`role ${x.role||'changed'}`;
          } else if (msg?.type === 'EVENT_ROLE_FORCED') {
            const x=msg.payload||{}; STATE.eventParticipation={...(STATE.eventParticipation||{}),opted_in:true,role:x.forced_role||'',role_locked_to_gather:Boolean(x.role_locked_to_gather)}; STATE.eventLastAction=`forced ${x.forced_role||'role'}`;
          } else if (msg?.type === 'EVENT_ERROR') {
            const x=msg.payload||{}; STATE.eventLastError=String(x.code||x.reason_code||x.message||'EVENT_ERROR'); STATE.eventLastAction=`event error: ${STATE.eventLastError}`;
          } else if (msg?.type === 'HARDWARE_INFO') {
            STATE.hardwareInfo=msg.payload||null;
          } else if (msg?.type === 'HARDWARE_UPGRADED' || msg?.type === 'HARDWARE_UPDATE') {
            if(STATE.hardwareInfo&&msg.payload)STATE.hardwareInfo={...STATE.hardwareInfo,...msg.payload};
            emit('IHS2_TELEMETRY',{store:'economy_purchases',value:{ts:Date.now(),kind:'hardware',event:msg.type,hardwareType:msg.payload?.hardware_type||null,newLevel:msg.payload?.new_level||null}});
          } else if (msg?.type === 'HOMELAB_INFO' || msg?.type === 'HOMELAB_UPDATED' || msg?.type === 'HOMELAB_UPDATE') {
            STATE.homelabInfo=msg.payload||STATE.homelabInfo;
            if(msg.type!=='HOMELAB_INFO')emit('IHS2_TELEMETRY',{store:'economy_purchases',value:{ts:Date.now(),kind:'homelab',event:msg.type}});
          } else if (msg?.type === 'MARKET_EQUIP_LIST') {
            handleMarketEquipListPayload(msg.payload || {});
          } else if (msg?.type === 'PLAYER_ACTIVITY_LOG') {
            handleMarketActivityPayload(msg.payload || {});
          } else if (msg?.type === 'INVENTORY_UPDATE') {
            STATE.lastInventoryUpdateAt=Date.now();
            // Keep optimizer, crafting, and inventory pressure decisions synchronized with authoritative state.
            setTimeout(()=>{try{completeSnapshot();}catch{}},0);
          }
        });
        const nativeSend = ws.send.bind(ws);
        ws.send = function(data) {
          STATE.wsSeq++;
          STATE.wsOutboundTypes.add(messageType(data));
          return nativeSend(data);
        };
        return ws;
      }
    });
  } catch (e) {
    log(`WebSocket observation unavailable: ${e.message}`, 'warn');
  }

  const BREACH_LATEST_STATE_COMMANDS=new Set(['BREACH_PUBLIC_LOBBIES_SUBSCRIBE','BREACH_PUBLIC_LOBBIES_UNSUBSCRIBE','GET_BREACH_RECENT_RUNS','BREACH_INVITE','BREACH_INVITE_RESPOND','BREACH_JOIN_PUBLIC_LOBBY','BREACH_SET_LOBBY_SETTINGS','BREACH_SET_NETWORK','BREACH_UPDATE_LOADOUT','BREACH_SET_READY','BREACH_SET_MODE','BREACH_SET_EXTRACTION_TARGET','BREACH_SET_CONTROL_GROUP']);
  function breachProtocolSend(type,payload={},throttleKey=type,minIntervalMs=900) {
    const sock=STATE.gameWs;
    if (!sock || sock.readyState !== WebSocket.OPEN) return false;
    const now=Date.now(), last=Number(STATE.breachLastCommandAt[throttleKey] || 0);
    if (now-last < minIntervalMs) return false;
    if (STATE.lastRateLimitAt && now-STATE.lastRateLimitAt < Math.max(3000,STATE.retryAfterMs||0)) return false;
    let body={...(payload||{})};
    const sv=Number(STATE.breachState?.session_version||0);
    if(sv>0 && body.session_version===undefined && !BREACH_LATEST_STATE_COMMANDS.has(type) && type!=='GET_BREACH_STATE') body.session_version=sv;
    try {
      const priority=type==='BREACH_SET_READY'?95:(/JOIN|START|PRESTIGE|ACCESS_ACTION|REFILL_REPEATS/.test(type)?80:(type==='GET_BREACH_STATE'?70:70));
      const isMutation=!/^GET_|BREACH_PUBLIC_LOBBIES_SUBSCRIBE$|BREACH_PUBLIC_LOBBIES_UNSUBSCRIBE$/.test(type);
      const gov=globalThis.IHS2?.governor;
      const ok=gov?gov.trySend({type,payload:body,subsystem:'breach',priority,dedupeKey:`breach:${throttleKey}:${JSON.stringify(body)}`,minIntervalMs,isMutation}):(sock.send(JSON.stringify({type,payload:body})),true);
      if(!ok)return false;
      STATE.breachLastCommandAt[throttleKey]=now;
      STATE.breachLastAction=type;
      traceAction({type,result:'sent',detail:body.class_id||body.skill_id||body.session_id||''});
      return true;
    } catch (e) { log(`Breach protocol ${type} failed: ${e.message}`,'warn'); return false; }
  }
  function scheduleDeferredAutomation(bucket,delayMs){
    const key=bucket==='event'?'events':'contracts';
    automationRechecks?.request(key,()=>{
      if(STATE.stopRequested||STATE.settings[key]?.enabled===false)return;
      return key==='events'?runEvents():runContracts();
    },Math.max(100,Number(delayMs)||350)+100);
  }
  function automationProtocolSend(type,payload={},bucket='automation',minIntervalMs=1200){
    const sock=STATE.gameWs;
    if(!sock||sock.readyState!==WebSocket.OPEN)return false;
    const store=bucket==='event'?STATE.eventLastCommandAt:STATE.contractLastCommandAt;
    const now=Date.now(),key=type+':'+JSON.stringify(payload||{});
    const localDelay=Math.max(0,minIntervalMs-(now-Number(store[key]||0)));
    if(localDelay>0){scheduleDeferredAutomation(bucket,localDelay);return false;}
    const serverWait=STATE.lastRateLimitAt?Math.max(0,Math.max(2500,STATE.retryAfterMs||0)-(now-STATE.lastRateLimitAt)):0;
    if(serverWait>0){scheduleDeferredAutomation(bucket,serverWait);return false;}
    try{
      const subsystem=bucket==='event'?'events':'contracts';
      const action={type,payload:payload||{},subsystem,priority:bucket==='event'?90:85,dedupeKey:`${subsystem}:${key}`,minIntervalMs,isMutation:!/^GET_/.test(type)};
      const gov=globalThis.IHS2?.governor;
      const delay=gov?.nextDelayMs?.(action)||0;
      if(delay>0){if(Number.isFinite(delay))scheduleDeferredAutomation(bucket,delay);return false;}
      const ok=gov?gov.trySend(action):(sock.send(JSON.stringify({type,payload:payload||{}})),true);
      if(!ok){scheduleDeferredAutomation(bucket,Math.max(350,Number(gov?.nextDelayMs?.(action)||0)));return false;}
      store[key]=now;
      traceAction({type,result:'sent'});
      return true;
    }catch(e){log(`${type} failed: ${e.message}`,'warn');return false;}
  }

  const BREACH_CLASS_IDS={daemonbinder:'daemonbinder',gatewarden:'gatewarden',tracewalker:'tracewalker',nullblade:'nullblade'};
  function breachPreferredClassId() {
    const raw=String(STATE.settings.breach.className||'auto').trim().toLowerCase();
    if(BREACH_CLASS_IDS[raw])return raw;
    const classes=STATE.breachState?.progression?.classes||{};
    return Object.entries(classes).filter(([id])=>BREACH_CLASS_IDS[id]).sort((a,b)=>Number(b[1]?.level||1)-Number(a[1]?.level||1)||Number(b[1]?.prestiges||0)-Number(a[1]?.prestiges||0)||Number(b[1]?.xp||0)-Number(a[1]?.xp||0))[0]?.[0]||'tracewalker';
  }
  function breachClassProgress(classId=breachPreferredClassId()) { return STATE.breachState?.progression?.classes?.[classId] || null; }
  function breachPrestigeRequirement(progress=breachClassProgress()) {
    if (!progress) return Infinity;
    if (Number.isFinite(Number(progress.recompile_requirement))) return Number(progress.recompile_requirement);
    const cfg=STATE.breachRegistries?.prestige || {};
    return Math.max(1,Number(cfg.base_level||61)) + Math.max(0,Number(progress.prestiges||0))*Math.max(1,Number(cfg.levels_per_prestige||1));
  }
  function breachSelfParticipant() {
    const state=STATE.breachState, name=String(liveCurrentPlayer()?.username||'').toLowerCase();
    return (Array.isArray(state?.participants)?state.participants:[]).find(p=>String(p?.username||'').toLowerCase()===name) || null;
  }
  function breachNetworkScore(id) { return ({tiered_breach:4,black_ice_citadel:3,cipherkeep:2,scrapnet_warrens:1})[String(id||'')] || 0; }
  function breachAllowedClassIds(){const requested=String(STATE.settings.breach.className||'auto').toLowerCase();if(BREACH_CLASS_IDS[requested])return[requested];const classes=STATE.breachState?.progression?.classes||{};return Object.keys(BREACH_CLASS_IDS).filter(id=>classes[id]).sort((a,b)=>Number(classes[b]?.level||1)-Number(classes[a]?.level||1));}
  function chooseBestPublicLobbyCandidate() {
    const cfg=STATE.settings.breach, classes=STATE.breachState?.progression?.classes||{}, candidates=[];
    for(const l of STATE.breachPublicLobbies||[]){if(!l?.can_join)continue;const joinable=Array.isArray(l.joinable_class_ids)?l.joinable_class_ids:[];for(const classId of breachAllowedClassIds()){if(!joinable.includes(classId))continue;const level=Number(classes[classId]?.level||1),min=Number(l.minimum_class_level||1);if(min>level||min<Number(cfg.minLobbyLevel||1))continue;const score=breachNetworkScore(l.network_id)*1e8+min*1e5+Number(l.member_count||1)*1e4+Number(Boolean(l.leader_ready_for_multiple))*2500+Number(Boolean(l.leader_online))*1500+level;candidates.push({lobby:l,classId,score});}}
    return candidates.sort((a,b)=>b.score-a.score)[0]||null;
  }
  function breachBestRelicLoadout(classId){
    const state=STATE.breachState, owned=state?.progression?.relics||{}, defs=STATE.breachRegistries?.relics||[];const out={};
    for(const slot of ['offense','defense','utility']){let best=null,bestScore=-Infinity;for(const d of defs){if(d?.slot!==slot)continue;if(d.class_id&&d.class_id!==classId)continue;const rank=Number(owned[d.id]||0);if(rank<=0)continue;let sc=rank*100+(d.class_id===classId?10000:0);if(slot==='utility')sc+=({pathfinder_seed:900,escalation_matrix:800,signal_relay:700,shard_compactor:600,access_beacon:500,cache_index:400}[d.id]||0);if(sc>bestScore){bestScore=sc;best=d.id;}}if(best)out[slot]=best;}
    return out;
  }
  function sameLoadout(a,b){return ['offense','defense','utility'].every(k=>String(a?.[k]||'')===String(b?.[k]||''));}
  function maybeOptimizeBreachLoadout(classId){const self=breachSelfParticipant();if(!self||!STATE.settings.breach.autoRelics)return false;const desired=breachBestRelicLoadout(classId);if(Object.keys(desired).length<3||sameLoadout(self.relic_loadout,desired))return false;const key=JSON.stringify(desired);if(STATE.breachLastLoadoutKey===key&&Date.now()-Number(STATE.breachLastCommandAt['loadout-opt']||0)<10*60*1000)return false;if(breachProtocolSend('BREACH_UPDATE_LOADOUT',{relic_loadout:desired},'loadout-opt',2500)){STATE.breachLastLoadoutKey=key;log(`Breach autopilot: optimized ${classId} relic loadout (${desired.offense}, ${desired.defense}, ${desired.utility})`);return true;}return false;}
  const BREACH_EFFECT_BASE={power:11,accuracy:10,evasion:7,armor:7,integrity:7,scan:10,cache_percent:8,barrier_absorption:8,party_barrier:8,execution_threshold:10,signature_maximum:8,starting_signature_percent:7,wipe_retention_percent:8,fatal_survival_percent:7};
  function breachTalentEffectWeight(classId,kind){const k=String(kind||'');let w=BREACH_EFFECT_BASE[k]||(/damage|crit|execution|power/.test(k)?10:/cache|treasure|reward|shard/.test(k)?8:/scan|trace|target|accuracy/.test(k)?9:/heal|barrier|integrity|armor|evasion|survival|reduction/.test(k)?7:/signature|combo|binding|aegis/.test(k)?7:4);if(classId==='tracewalker'&&/scan|trace|target|accuracy|forecast/.test(k))w+=4;if(classId==='daemonbinder'&&/daemon|binding|power|damage/.test(k))w+=4;if(classId==='gatewarden'&&/barrier|aegis|armor|integrity|heal|reduction/.test(k))w+=4;if(classId==='nullblade'&&/evasion|execution|combo|miss|damage/.test(k))w+=4;return w;}
  function breachTalentCandidate(classId){const p=breachClassProgress(classId);if(!p||Number(p.tree_points||0)<=0)return null;const alloc=p.allocations||{},invested=Object.values(alloc).reduce((a,v)=>a+Number(v||0),0),skills=(STATE.breachRegistries?.skills||[]).filter(x=>x.class_id===classId);const eligible=[];for(const sk of skills){const rank=Number(alloc[sk.id]||0),max=Number(sk.max_rank||1);if(rank>=max||Number(p.level||1)<Number(sk.mastery_level||1)||invested<Number(sk.points_required||0))continue;if((sk.requires||[]).some(r=>Number(alloc[r.skill_id]||0)<Number(r.rank||1)))continue;let score=0;for(const ef of sk.effects||[]){const vals=Array.isArray(ef.values)?ef.values:[],cur=Number(vals[Math.min(rank,vals.length-1)]||1),prev=rank>0?Number(vals[Math.min(rank-1,vals.length-1)]||0):0;let delta=Math.abs(cur-prev)||Math.abs(cur)||1;if(/_every$/.test(String(ef.kind||''))&&rank>0)delta=Math.max(1,prev-cur);score+=breachTalentEffectWeight(classId,ef.kind)*Math.log2(2+Math.abs(delta));}score+=Math.max(0,20-Number(sk.row||1));eligible.push({skill:sk,rank,score});}return eligible.sort((a,b)=>b.score-a.score||Number(a.skill.row||0)-Number(b.skill.row||0))[0]||null;}
  function maybeAllocateBreachTalent(classId){if(!STATE.settings.breach.autoTalent)return false;const c=breachTalentCandidate(classId);if(!c)return false;const payload={class_id:classId,skill_id:c.skill.id,expected_rank:c.rank};if(breachProtocolSend('BREACH_ALLOCATE_SKILL',payload,`talent-${classId}`,1000)){STATE.breachLastTalentAction={classId,skillId:c.skill.id,name:c.skill.name,rank:c.rank+1,score:c.score};log(`Breach autopilot: talent ${c.skill.name} → rank ${c.rank+1}`);return true;}return false;}
  function maybeUpgradeBreachRelic(classId){if(!STATE.settings.breach.autoUpgrade||!STATE.settings.breach.autoRelics)return false;const state=STATE.breachState,owned=state?.progression?.relics||{},costs=STATE.breachRegistries?.relic_upgrade_costs||[],shards=Number(state?.progression?.cipher_shards||0),reserve=Math.max(0,Number(STATE.settings.breach.shardReserve||1000)),desired=breachBestRelicLoadout(classId);const ids=['offense','defense','utility'].map(k=>desired[k]).filter(Boolean);for(const id of ids){const rank=Number(owned[id]||0);if(rank<1||rank>=5)continue;const cost=Number(costs[Math.max(0,rank-1)]||Infinity);if(!Number.isFinite(cost)||shards-reserve<cost)continue;if(breachProtocolSend('BREACH_UPGRADE_RELIC',{relic_id:id,expected_rank:rank},`relic-upgrade-${id}`,2500)){log(`Breach autopilot: upgrading ${id} rank ${rank} → ${rank+1} (${cost.toLocaleString()} shards)`);return true;}}return false;}
  function maybeAllocatePrestige(classId) {
    const cfg=STATE.settings.breach, p=breachClassProgress(classId);
    if (!p || Number(p.unallocated_prestiges||0) < 1 || cfg.prestigeAllocation === 'hold') return false;
    const reg=STATE.breachRegistries?.prestige || {};
    const theme=(reg.class_themes||[]).find(x=>x.class_id===classId);
    const statId=cfg.prestigeAllocation === 'integrity' ? 'integrity' : String(theme?.stat_id || 'integrity');
    const expectedRank=statId==='integrity' ? Number(p.prestige_integrity||0) : Number(p.prestige_themed||0);
    return breachProtocolSend('BREACH_ALLOCATE_PRESTIGE',{class_id:classId,stat_id:statId,expected_rank:expectedRank},`allocate-${classId}`,1200);
  }
  function maybePrestigeBetweenRuns(classId) {
    const cfg=STATE.settings.breach, state=STATE.breachState, p=breachClassProgress(classId);
    if (!cfg.autoPrestige || !p || state?.session_id) return false;
    const req=breachPrestigeRequirement(p);
    if (Number(p.level||1) < req) return maybeAllocatePrestige(classId);
    // Official client semantics: recompile resets class XP/level/talents, discards XP above req,
    // preserves priorities/relics/other classes/Clearance, and grants one unallocated Prestige star.
    return breachProtocolSend('BREACH_PRESTIGE',{class_id:classId,expected_prestiges:Number(p.prestiges||0)},`prestige-${classId}`,1800);
  }
  async function runBreachAutopilot() {
    const cfg=STATE.settings.breach;
    if (!cfg.enabled || !cfg.autopilot) { STATE.breachLastAction=!cfg.enabled?'disabled':'autopilot disabled'; return false; }
    if(!STATE.breachState)breachProtocolSend('GET_BREACH_STATE',{},'breach-state-refresh',2500);
    if (!STATE.breachState) { STATE.breachLastAction='waiting for state'; return true; }
    const player=liveCurrentPlayer()||{}, primary=breachPreferredClassId();
    const c=breachTalentCandidate(primary);
    const extensionTalentIntent=c?{type:'BREACH_ALLOCATE_SKILL',payload:{class_id:primary,skill_id:c.skill.id,expected_rank:c.rank}}:null;
    const themes={};for(const t of STATE.breachRegistries?.prestige?.class_themes||[])themes[t.class_id]=t.stat_id;
    const desiredLoadout=cfg.autoRelics?breachBestRelicLoadout(String(breachSelfParticipant()?.class_id||primary)):null;
    const premiumActive=Boolean(player.premium_active===true||Number(player.premium_expires_at_ms||0)>Date.now());
    const intents=globalThis.IHS2?.Breach?.planBreach?.(STATE.breachState,STATE.breachPublicLobbies,cfg,{username:player.username||player.name||'',playerId:player.id||player.player_id,premiumActive,extensionTalentIntent,desiredLoadout,classThemes:themes,breachMetrics:STATE.breachMetrics||{},allowRefillRepeats:!STATE.breachRepeatRefill||STATE.breachRepeatRefill.sessionId!==STATE.breachState?.session_id||STATE.breachRepeatRefill.remaining!==Number(STATE.breachState?.fixed_starts_remaining||0)||Date.now()-STATE.breachRepeatRefill.ts>600000})||[];
    for(const intent of intents){
      if(STATE.stopRequested)break;
      if(breachProtocolSend(intent.type,intent.payload||{},intent.dedupeKey||intent.type,Number(intent.minIntervalMs||900))){if(intent.type==='BREACH_REFILL_REPEATS'||intent.type==='BREACH_SET_REPEAT_STARTS')STATE.breachRepeatRefill={sessionId:STATE.breachState?.session_id,remaining:Number(STATE.breachState?.fixed_starts_remaining||0),ts:Date.now()};STATE.breachLastAction=intent.reason||intent.type;log(`Breach: ${STATE.breachLastAction}`);return true;}
    }
    if(cfg.autoUpgrade&&cfg.autoRelics&&maybeUpgradeBreachRelic(String(breachSelfParticipant()?.class_id||primary)))return true;
    const state=STATE.breachState,self=breachSelfParticipant();
    if(state.status==='active')STATE.breachLastAction='AFK run active';
    else if(state.status==='access')STATE.breachLastAction='access routing / repeat automation';
    else if(state.status==='lobby'&&self?.ready)STATE.breachLastAction='ready; waiting for launch';
    else if(!state.session_id)STATE.breachLastAction=STATE.breachPublicLobbies.length?'no eligible public lobby':'waiting for public lobbies';
    return true;
  }

  function parseNumber(raw) {
    if (raw == null) return NaN;
    let s = String(raw).trim().replace(/,/g,'').replace(/\$/g,'');
    const m = s.match(/(-?\d+(?:\.\d+)?)\s*([KMBTQ]?)/i);
    if (!m) return NaN;
    const mult = {K:1e3,M:1e6,B:1e9,T:1e12,Q:1e15}[m[2].toUpperCase()] || 1;
    return Number(m[1]) * mult;
  }

  function textOf(el) {
    return norm([el?.innerText, el?.textContent, el?.getAttribute?.('title'), el?.getAttribute?.('aria-label')].filter(Boolean).join(' '));
  }

  function extractSlot(text, el) {
    const ds = el?.dataset || {};
    const raw = ds.slot || ds.equipmentSlot || ds.type || '';
    const direct = SLOT_NAMES.find(s => upper(raw) === upper(s));
    if (direct) return direct;
    return SLOT_NAMES.find(s => new RegExp(`\\b${s}\\b`, 'i').test(text)) || null;
  }

  function extractRarity(text, el) {
    const ds = el?.dataset || {};
    const raw = ds.rarity || '';
    const direct = Object.keys(RARITY_WEIGHT).find(r => upper(raw) === upper(r));
    if (direct) return direct;
    return Object.keys(RARITY_WEIGHT).reverse().find(r => new RegExp(`\\b${r}\\b`, 'i').test(text)) || 'Basic';
  }

  function extractItemId(el) {
    if (!el) return null;
    const node = el.matches?.('[data-item-id]') ? el : el.querySelector?.('[data-item-id]');
    return el.dataset?.itemId || el.dataset?.inventoryItemId || node?.dataset?.itemId || null;
  }

  function extractItemLevel(text, el) {
    const ds = el?.dataset || {};
    const fromDs = parseNumber(ds.itemLevel || ds.ilvl || ds.level);
    if (Number.isFinite(fromDs)) return fromDs;
    const m = text.match(/(?:ITEM\s*LEVEL|ILVL)\s*:?\s*([\d.,KMBTQ]+)/i);
    return m ? parseNumber(m[1]) : NaN;
  }

  function extractRequiredLevel(text, el) {
    const ds = el?.dataset || {};
    const fromDs = parseNumber(ds.requiredLevel || ds.reqLevel);
    if (Number.isFinite(fromDs)) return fromDs;
    const m = text.match(/(?:REQUIRED\s*LEVEL|REQ(?:UIRED)?\s*LVL)\s*:?\s*([\d.,KMBTQ]+)/i);
    return m ? parseNumber(m[1]) : NaN;
  }

  function extractStability(text, el) {
    const ds = el?.dataset || {};
    const fromDs = parseNumber(ds.stability);
    if (Number.isFinite(fromDs)) return fromDs;
    const m = text.match(/STABILITY\s*:?\s*(\d+)/i);
    return m ? Number(m[1]) : NaN;
  }

  function extractSignature(text, el) {
    const ds = el?.dataset || {};
    if (ds.signature && !/^(false|0|none)$/i.test(ds.signature)) return ds.signature;
    return SIGNATURE_NAMES.find(n => text.toLowerCase().includes(n.toLowerCase())) || (/SIGNATURE/i.test(text) ? 'Signature' : null);
  }

  function extractAffixTiers(text) {
    return [...text.matchAll(/\bT([1-9])\b/gi)].map(m => Number(m[1]));
  }

  function itemFromElement(el, forcedSlot=null, equipped=false) {
    const text = textOf(el);
    const id = extractItemId(el);
    const slot = forcedSlot || extractSlot(text, el);
    const itemLevel = extractItemLevel(text, el);
    const requiredLevel = extractRequiredLevel(text, el);
    const stability = extractStability(text, el);
    const signature = extractSignature(text, el);
    const affixTiers = extractAffixTiers(text);
    const locked = /(^|\s)(LOCKED|DECOMPILE[- ]LOCKED)(\s|$)/i.test(text) || /true|1/i.test(el?.dataset?.locked || '');
    const listed = /(^|\s)LISTED(\s|$)/i.test(text) || /true|1/i.test(el?.dataset?.listed || '');
    const confidence = id && slot && Number.isFinite(itemLevel) ? 1 : id && slot ? 0.9 : id ? 0.7 : 0;
    return {id,slot,rarity:extractRarity(text,el),itemLevel,requiredLevel,stability,signature,affixTiers,locked,listed,equipped,text,identityConfidence:confidence,element:el};
  }

  const OPTIMIZER_PROFILE_EFFECTS={
    balanced:{attack_damage:3,attack_speed:2.2,accuracy:2.5,crit_chance:2.2,crit_damage:2.1,armor_penetration:2.2,max_hp:1.8,defense:1.9,evasion:1.9,regeneration:1.4,damage_barrier:1.5,thorns:1.2,corruption:1.5,xp_global:1.2,xp_gathering:.8,xp_hack:.8,item_rarity:.7,drop_boost:.7,credits:.5},
    itemlevel:{},
    leveling:{xp_global:5,xp_gathering:4.5,xp_hack:3.5,item_rarity:1.2,drop_boost:1.2,credits:.7},
    gathering:{xp_gathering:5,gathering_resources_multi:4,xp_global:2,item_rarity:1,drop_boost:1},
    hacking:{xp_hack:5,xp_global:3,attack_damage:1.4,accuracy:1.3,credits:1},
    loot:{item_rarity:5,drop_boost:5,credits:2,xp_global:1}
  };
  function normalizedEffectUtility(e){
    const v=Math.abs(Number(e?.value)||0), typ=String(e?.type||'').toLowerCase();
    if(!v)return 0;
    if(typ.includes('mult')||v<10)return Math.min(12,v*100);
    return Math.min(12,Math.log10(1+v)*1.7);
  }
  function optimizerAdaptiveEffectWeights(profile){
    if(STATE.settings.optimizer?.adaptive===false||!STATE.adaptiveWeights)return{};
    const a=STATE.adaptiveWeights||{};return{accuracy:Number(a.accuracy||0),attack_damage:Number(a.attack||0),attack_speed:Number(a.attack||0)*.65,crit_chance:Number(a.crit||0),crit_damage:Number(a.crit||0)*.75,defense:Number(a.defense||0),max_hp:Number(a.maxhp||0),evasion:Number(a.evasion||0),armor:Number(a.armor||0)};
  }
  function optimizerRawScore(raw,profile='balanced'){
    if(!raw)return 0;
    const p=String(profile||'balanced'), weights={...(OPTIMIZER_PROFILE_EFFECTS[p]||OPTIMIZER_PROFILE_EFFECTS.balanced)};
    const objective=String(STATE.settings.optimizer?.objective||'balanced');
    const adjustments={
      xp_per_hour:{xp_global:4,xp_hack:3.6,attack_damage:1.7,attack_speed:1.9,accuracy:1.6},
      sustainable_streak:{accuracy:2.2,max_hp:3,defense:3,evasion:3,regeneration:2.4,damage_barrier:2},
      credits_per_hour:{credits:5,drop_boost:2.2,item_rarity:1.8,attack_damage:1.5,attack_speed:1.6},
      accuracy_first:{accuracy:5,attack_damage:1.3,attack_speed:1.4}
    };
    for(const [stat,multiple] of Object.entries(adjustments[objective]||{}))weights[stat]=Math.max(.2,Number(weights[stat]||.5))*multiple;
    const adaptive=optimizerAdaptiveEffectWeights(p);
    for(const [k,v] of Object.entries(adaptive))weights[k]=Number(weights[k]||0)+Number(v||0);
    // A level baseline preserves item-power differences, but limits their dominance over
    // multiple strong target-specific affixes. These are utility weights, NOT predicted DPS.
    let score=(Number(raw.item_level)||0)*4;
    const rarity=String(raw.rarity||'Basic').replace(/^./,c=>c.toUpperCase());
    score+=(RARITY_WEIGHT[rarity]||0)*350;
    if(raw.signature_id||raw.signature_name)score+=900;
    if(STATE.optimizerPenaltyIds?.has?.(String(raw.id||'')))score*=.92;
    score+=Math.max(0,Number(raw.effective_compiled_bonus_pct||raw.compiled_bonus_pct)||0)*6000;
    for(const x of rawAffixes(raw)){
      const a=x.affix||{}, tier=Number(a.tier);
      if(Number.isFinite(tier))score+=Math.max(0,10-tier)*28;
      score+=affixRollQualityPct(a)*1.2;
      if(p!=='itemlevel')for(const e of Array.isArray(a.effects)?a.effects:[]){
        const key=canonicalEnhanceEffect(e?.resource), w=Number(weights[key]||0);
        if(w>0)score+=w*normalizedEffectUtility(e)*32;
      }
    }
    return score;
  }
  function scoreItem(item,profile='balanced') {
    const raw=item?.id ? rawItemById(item.id) : null;
    if(raw)return optimizerRawScore(raw,profile);
    let score=(Number.isFinite(item?.itemLevel)?item.itemLevel:0)*10+(RARITY_WEIGHT[item?.rarity]||0)*350;
    if(item?.signature)score+=900;
    for(const tier of item?.affixTiers||[])score+=Math.max(0,10-Number(tier))*28;
    return score;
  }

  const GAME_SLOT_TO_BASE={main_hand:'Payload',off_hand:'Firewall',head:'Analyzer',chest:'Shell',gloves:'Driver',boots:'Router',acc1:'Daemon',acc2:'Kernel'};
  function slotFromGameItem(item) {
    const base=String(item?.base_type||'').trim();
    if (SLOT_NAMES.includes(base)) return base;
    return GAME_SLOT_TO_BASE[String(item?.slot||'').trim()] || null;
  }
  function itemFromGameData(item, equipped=false) {
    if (!item || typeof item!=='object') return null;
    const prefixes=Array.isArray(item.prefixes)?item.prefixes:[];
    const suffixes=Array.isArray(item.suffixes)?item.suffixes:[];
    const signature=item.signature_name || (item.signature_id ? String(item.signature_id) : null);
    const affixTiers=[...prefixes,...suffixes].map(a=>Number(a?.tier)).filter(Number.isFinite);
    const id=String(item.id||'').trim() || null;
    const slot=slotFromGameItem(item);
    return {
      id,slot,rarity:String(item.rarity||'Basic').replace(/^./,c=>c.toUpperCase()),
      itemLevel:Number(item.item_level)||0,requiredLevel:Number(item.required_hack_level)||0,
      stability:Number(item.stability),signature,affixTiers,
      locked:Boolean(item.decompile_locked),listed:Boolean(item.market_listed),equipped,
      text:String(item.name||''),identityConfidence:id&&slot?1:id?0.8:0,element:null
    };
  }

  function inventoryNodes() {
    const candidates = [
      ...document.querySelectorAll('.inventory-slot[data-item-id]'),
      ...document.querySelectorAll('[data-inventory-item-id]'),
      ...document.querySelectorAll('[data-item-id].inventory-item'),
      ...document.querySelectorAll('[data-item-id][class*="inventory"]')
    ];
    return [...new Set(candidates)].filter(el => !el.closest?.('.equipment-slot[data-slot]'));
  }

  function readInventory() {
    const data=liveInventoryData();
    const live=Array.isArray(data?.items) ? data.items : null;
    if (live) {
      const items=live.map(x=>itemFromGameData(x,false)).filter(x=>x?.id);
      STATE.inventory=items;
      STATE.signatureIds=new Set(items.filter(i=>i.signature).map(i=>i.id));
      for (const id of STATE.signatureIds) STATE.neverDeleteIds.add(id);
      return items;
    }
    const byId = new Map();
    for (const el of inventoryNodes()) {
      const item = itemFromElement(el);
      if (item.id && (!byId.has(item.id) || item.identityConfidence > byId.get(item.id).identityConfidence)) byId.set(item.id, item);
    }
    const items = [...byId.values()];
    STATE.inventory = items;
    STATE.signatureIds = new Set(items.filter(i => i.signature).map(i => i.id));
    for (const id of STATE.signatureIds) STATE.neverDeleteIds.add(id);
    return items;
  }

  function readEquipped() {
    const data=liveEquipmentData();
    if (data && typeof data==='object') {
      const out={};
      for (const raw of Object.values(data)) {
        const item=itemFromGameData(raw,true);
        if (item?.id && item.slot) out[item.slot]=item;
      }
      STATE.equipped=out;
      return out;
    }
    const out = {};
    for (const slot of SLOT_NAMES) {
      const slotEl = [...document.querySelectorAll('.equipment-slot[data-slot], [data-slot].equipment-slot')].find(el => upper(el.dataset?.slot) === upper(slot));
      const idEl = slotEl?.querySelector?.('[data-item-id]');
      if (idEl) {
        const item = itemFromElement(idEl, slot, true);
        if (item.id) out[slot] = item;
      }
    }
    STATE.equipped = out;
    return out;
  }

  function expectedInventoryCount() {
    const body = norm(document.body?.innerText || '');
    const matches = [...body.matchAll(/INVENTORY\s*:?\s*(\d+)\s*\/\s*(\d+)/ig)];
    if (!matches.length) return null;
    return Number(matches[0][1]);
  }

  function completeSnapshot() {
    const inventory = readInventory();
    const equipped = readEquipped();
    const expected = expectedInventoryCount();
    const uniqueOwned = new Set([...inventory.map(i=>i.id), ...Object.values(equipped).map(i=>i.id).filter(Boolean)]);
    const complete = expected == null ? inventory.length > 0 : uniqueOwned.size >= expected;
    return {inventory,equipped,expected,complete};
  }

  function clickables(root=document) {
    return [...root.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a')].filter(visible);
  }

  function findButtonExact(names, root=document) {
    const list = Array.isArray(names) ? names : [names];
    const wanted = list.map(upper);
    return clickables(root).find(el => wanted.includes(upper(el.value || textOf(el)))) || null;
  }

  function findButtonRegex(rx, root=document) {
    return clickables(root).find(el => rx.test(norm(el.value || textOf(el)))) || null;
  }

  function clickIf(names, root=document) {
    const b = findButtonExact(names, root);
    if (!b) return false;
    b.click();
    return true;
  }

  async function waitFor(fn, timeout=5000, interval=80) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const v = fn();
        if (v) return v;
      } catch {}
      await sleep(interval);
    }
    return null;
  }

  async function openMenu(name) {
    const exact = findButtonExact([`> ${name}`, name]);
    if (exact) {
      exact.click();
      await sleep(180);
      return true;
    }
    const b = findButtonRegex(new RegExp(`^>?\\s*${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*$`,'i'));
    if (b) {
      b.click(); await sleep(180); return true;
    }
    return false;
  }

  function visibleDialog() {
    const nodes = [...document.querySelectorAll('[role="dialog"],dialog,.modal,[class*="modal"],[class*="dialog"],[class*="panel"]')].filter(visible);
    return nodes.at(-1) || document;
  }

  async function selectInventoryItem(id) {
    readInventory();
    const item = STATE.inventory.find(i => i.id === id);
    if (!item?.element || !visible(item.element)) {
      const escaped = globalThis.CSS?.escape ? CSS.escape(id) : id.replace(/["\\]/g,'\\$&');
      const el = document.querySelector(`.inventory-slot[data-item-id="${escaped}"],[data-inventory-item-id="${escaped}"]`);
      if (!el) return null;
      el.click();
    } else item.element.click();
    await sleep(180);
    const panel = await waitFor(() => {
      const p = visibleDialog();
      const txt = textOf(p);
      return /STABILITY|ITEM LEVEL|EQUIP|DECOMPILE|AUGMENT|COMPILE/i.test(txt) ? p : null;
    }, 2500);
    return panel;
  }

  async function settle(beforeSeq, timeout=5000) {
    const startText = norm(document.body?.innerText || '').slice(-4000);
    return waitFor(() => {
      if (STATE.wsSeq > beforeSeq) return true;
      const now = norm(document.body?.innerText || '').slice(-4000);
      return now !== startText;
    }, timeout, 100);
  }

  async function confirmDialog(preferred=['CONFIRM','YES','OK']) {
    await sleep(100);
    const d = visibleDialog();
    const b = findButtonExact(preferred, d);
    if (b) { b.click(); return true; }
    return false;
  }

  function rateLimitedSince(ts) { return STATE.lastRateLimitAt >= ts; }

  async function withBackoff(task, cfg, label) {
    const maxRetries = Math.max(0, Number(cfg.maxRetries) || 0);
    for (let attempt=0; attempt<=maxRetries; attempt++) {
      if (STATE.stopRequested) throw new Error('Stopped');
      const started = Date.now();
      try {
        const r = await task(attempt);
        if (!rateLimitedSince(started)) return r;
      } catch (e) {
        if (attempt >= maxRetries) throw e;
      }
      if (attempt >= maxRetries) throw new Error(`${label}: retry limit reached`);
      const base = Math.min(Number(cfg.maxDelayMs)||5000, (Number(cfg.baseDelayMs)||300) * (2 ** attempt));
      const jitter = Math.floor(Math.random() * Math.max(75, base * .25));
      const delay = Math.max(STATE.retryAfterMs || 0, base + jitter);
      STATE.enhanceStatus = 'backoff';
      log(`${label}: backing off ${delay} ms (retry ${attempt+1}/${maxRetries})`, 'warn');
      await sleep(delay);
      completeSnapshot();
    }
  }

  function traceAction(entry){
    STATE.actionTrace.push({ts:Date.now(),...entry});
    if(STATE.actionTrace.length>120)STATE.actionTrace.splice(0,STATE.actionTrace.length-120);
  }
  function safeResourceSnapshot(){
    const p=liveCurrentPlayer()||{};
    return Object.fromEntries(['credits','snippets','cycles','hashes','packets','stabilizers','hack_level'].map(k=>[k,Number(p[k])||0]));
  }
  function gameProtocolStatus(type,payload={},throttleKey=type,minIntervalMs=300){
    const sock=STATE.gameWs;if(!sock||sock.readyState!==WebSocket.OPEN)return{ok:false,reason:'socket'};
    const now=Date.now(),last=Number(STATE.actionLastCommandAt[throttleKey]||0),localWait=Math.max(0,minIntervalMs-(now-last)),cooldown=marketCooldownRemaining();
    if(localWait>0)return{ok:false,reason:'pace',retryMs:localWait};
    if(cooldown>0)return{ok:false,reason:'rate-limit',retryMs:cooldown};
    try{const subsystem=type==='EQUIPMENT_EQUIP'||type==='ITEM_SET_DECOMPILE_LOCK'?'optimizer':'enhancement';const priority=subsystem==='optimizer'?65:55;const gov=globalThis.IHS2?.governor;const action={type,payload,subsystem,priority,dedupeKey:`${subsystem}:${throttleKey}:${JSON.stringify(payload||{})}`,minIntervalMs,isMutation:type!=='INVENTORY_LIST'};const pendingMs=gov?.nextDelayMs?.(action)||0;if(!Number.isFinite(pendingMs))return{ok:false,reason:'paused'};if(pendingMs>0)return{ok:false,reason:'governor',retryMs:Math.ceil(pendingMs)};const ok=gov?gov.trySend(action):(sock.send(JSON.stringify({type,payload})),true);if(!ok)return{ok:false,reason:'governor',retryMs:Math.max(300,Number(gov?.nextDelayMs?.(action)||0))};STATE.actionLastCommandAt[throttleKey]=now;return{ok:true};}
    catch(e){return{ok:false,reason:'send',error:e.message};}
  }
  async function sendActionAndAwait({type,payload={},itemId=null,throttleKey=type,minIntervalMs=350,timeoutMs=7000,predicate,allowNoChange=false,resultTypes=[]}){
    const authorizedSend=globalThis.IHS2?.waitForAuthorizedSend;
    const attempt=()=>gameProtocolStatus(type,payload,throttleKey,minIntervalMs);
    const st=authorizedSend?await authorizedSend(attempt,{maxWaitMs:90000,stopRequested:()=>STATE.stopRequested,onWaiting:({reason,retryMs})=>log(`${type}: waiting for permitted ${reason} window (${Math.ceil(retryMs/1000)}s)`)}):attempt();
    if(!st.ok)throw new Error(`${type} send failed: ${st.error||st.reason}`);
    const started=Date.now();
    STATE.lastServerError=null; STATE.lastActionResult=null;
    STATE.pendingGameAction={type,itemId:itemId?String(itemId):null,started};
    traceAction({type,itemId,result:'sent'});
    const deadline=Date.now()+Math.max(1200,Number(timeoutMs)||7000),accepted=new Set(resultTypes||[]);
    try{
      while(Date.now()<deadline){
        const err=STATE.lastServerError;
        if(err&&err.ts>=started&&globalThis.IHS2?.errorMatchesAction?.(err.code,type)!==false&&(!err.actionType||err.actionType===type))throw new Error(`${err.code}: ${err.message}`);
        const ar=STATE.lastActionResult;
        if(ar&&ar.ts>=started&&accepted.has(ar.resultType)&&(!ar.actionType||ar.actionType===type)){traceAction({type,itemId,result:'server-result',detail:ar.resultType});return{__actionResult:ar};}
        let value=null;try{value=predicate?predicate():null;}catch{}
        if(value){traceAction({type,itemId,result:'verified'});return value;}
        await sleep(100);
      }
      if(allowNoChange){traceAction({type,itemId,result:'sent-unverified'});return true;}
      throw new Error(`${type} timed out waiting for authoritative state`);
    } finally { if(STATE.pendingGameAction?.started===started)STATE.pendingGameAction=null; }
  }
  async function refreshAuthoritativeInventory(timeoutMs=3500){
    const before=STATE.lastInventoryUpdateAt;
    const st=gameProtocolStatus('INVENTORY_LIST',{},'inventory-refresh',700);
    if(st.ok)await waitFor(()=>STATE.lastInventoryUpdateAt>before,timeoutMs,100);
    return completeSnapshot();
  }

  function protectedIds() {
    return new Set([...Object.values(STATE.finalKeepSet),...STATE.signatureIds,...STATE.sessionTouchedIds,...STATE.quarantineIds,...STATE.neverDeleteIds].filter(Boolean));
  }

  function protectItem(item, touched=false) {
    if (!item?.id) return;
    STATE.neverDeleteIds.add(item.id);
    if (touched) STATE.sessionTouchedIds.add(item.id);
    if (item.signature) STATE.signatureIds.add(item.id);
  }

  function fingerprint(item) {
    return JSON.stringify({
      slot:item.slot,rarity:item.rarity,itemLevel:item.itemLevel,signature:item.signature,
      affixTiers:[...(item.affixTiers||[])].sort((a,b)=>a-b)
    });
  }

  function reconcileAfterMutation(beforeItem) {
    const prior = fingerprint(beforeItem);
    const snap = completeSnapshot();
    const same = snap.inventory.find(i => i.id === beforeItem.id) || Object.values(snap.equipped).find(i=>i.id===beforeItem.id);
    if (same) {
      protectItem(same,true);
      return same;
    }
    const candidates = [...snap.inventory,...Object.values(snap.equipped)].filter(i => i.slot === beforeItem.slot);
    const near = candidates
      .map(i => ({i,delta:Math.abs((i.itemLevel||0)-(beforeItem.itemLevel||0)), fp:fingerprint(i)}))
      .sort((a,b)=>(a.fp===prior?0:1)-(b.fp===prior?0:1)||a.delta-b.delta);
    if (near.length === 1 || (near[0] && near[1] && near[0].delta < near[1].delta)) {
      const current = near[0].i;
      protectItem(current,true);
      for (const [slot,id] of Object.entries(STATE.finalKeepSet)) if (id === beforeItem.id) STATE.finalKeepSet[slot] = current.id;
      log(`Item identity reconciled ${beforeItem.id} → ${current.id}`);
      return current;
    }
    STATE.purgeEnabled = false;
    STATE.quarantineIds.add(beforeItem.id);
    log(`Could not reconcile mutated ${beforeItem.slot} item; destructive cleanup disabled`, 'error');
    return null;
  }

  async function normalItemAction(item, actionNames, options={}) {
    if (!item?.id) throw new Error('No exact item ID');
    if (options.destructive && protectedIds().has(item.id)) throw new Error(`Refusing destructive action on protected ${item.id}`);
    const panel = await selectInventoryItem(item.id);
    if (!panel) throw new Error(`Could not open item ${item.id}`);
    const button = findButtonExact(actionNames, panel);
    if (!button) throw new Error(`${actionNames[0]} control not found for ${item.id}`);
    const beforeSeq = STATE.wsSeq;
    button.click();
    if (options.confirm) await confirmDialog(options.confirmNames || ['CONFIRM','DECOMPILE','YES']);
    await settle(beforeSeq, options.timeout || 5000);
    return true;
  }

  async function setDecompileLockDirect(item,locked=true){
    if(!item?.id)return false;
    const raw=rawItemById(item.id);if(Boolean(raw?.decompile_locked)===Boolean(locked))return true;
    try{
      await sendActionAndAwait({type:'ITEM_SET_DECOMPILE_LOCK',payload:{item_id:String(item.id),locked:Boolean(locked)},itemId:item.id,throttleKey:`decompile-lock-${item.id}`,timeoutMs:6000,predicate:()=>Boolean(rawItemById(item.id)?.decompile_locked)===Boolean(locked)});
      return true;
    }catch(e){log(`Optimizer: item protection lock failed for ${item.id}: ${e.message}`,'warn');return false;}
  }
  async function equipWinnerDirect(slot,item){
    if(!item?.id)return false;
    const already=readEquipped()[slot];if(already?.id===item.id)return true;
    const oldId=already?.id||null;if(oldId)STATE.quarantineIds.add(oldId);
    protectItem(item);
    try{
      await sendActionAndAwait({type:'EQUIPMENT_EQUIP',payload:{item_id:String(item.id)},itemId:item.id,throttleKey:`equip-${slot}`,timeoutMs:7000,predicate:()=>{const eq=readEquipped();return eq[slot]?.id===String(item.id)?eq[slot]:null;}});
      log(`Optimizer: equipped ${slot} → ${item.name||item.id}`);
      return true;
    }catch(e){log(`Optimizer: ${slot} equip failed: ${e.message}`,'error');return false;}
  }
  function optimizerCandidateRows(profile){
    const inv=liveInventoryData(),eq=liveEquipmentData(),player=liveCurrentPlayer()||{},hack=Number(player.hack_level)||Infinity,map=new Map();
    for(const raw of Array.isArray(inv?.items)?inv.items:[])if(raw?.id)map.set(String(raw.id),raw);
    if(eq&&typeof eq==='object')for(const raw of Object.values(eq))if(raw?.id)map.set(String(raw.id),raw);
    return [...map.values()].filter(raw=>slotFromGameItem(raw)&&!raw.market_listed&&(Number(raw.required_hack_level)||0)<=hack).map(raw=>({raw,item:itemFromGameData(raw,Object.values(eq||{}).some(x=>String(x?.id)===String(raw.id))),score:optimizerRawScore(raw,profile)}));
  }
  async function runOptimizer() {
    if(STATE.runningEngine&&STATE.runningEngine!=='optimizer')throw new Error(`Busy: ${STATE.runningEngine}`);
    STATE.runningEngine='optimizer';STATE.stopRequested=false;STATE.purgeEnabled=true;STATE.sessionTouchedIds=new Set();STATE.quarantineIds=new Set();STATE.deleteCandidates=new Set();STATE.optimizerPlan=[];STATE.optimizerResult=[];
    const cfg=STATE.settings.optimizer,profile=String(cfg.profile||'balanced'),minPct=Math.max(0,Number(cfg.minImprovementPct)||0);
    try{
      STATE.optimizerPenaltyIds=new Set();
      if(STATE.optimizerEvidenceBaseline&&STATE.combatMetrics&&globalThis.IHS2?.CombatAdvisor?.assessChange){STATE.optimizerOutcome=globalThis.IHS2.CombatAdvisor.assessChange(STATE.optimizerEvidenceBaseline.metrics||{},STATE.combatMetrics||{});if(STATE.optimizerOutcome.degraded){STATE.optimizerPenaltyIds=new Set(STATE.optimizerEvidenceBaseline.winnerIds||[]);log(`Optimizer: measured effectiveness declined after the previous gear change; penalizing ${STATE.optimizerPenaltyIds.size} prior winner(s) and re-evaluating`,'warn');emit('IHS2_DECISION',{ts:Date.now(),subsystem:'optimizer',action:'rollback-or-reoptimize',reason:'measured post-change combat efficiency declined',evidence:{before:STATE.optimizerEvidenceBaseline.metrics,after:STATE.combatMetrics,outcome:STATE.optimizerOutcome}});}}
      log(`Optimizer: refreshing authoritative equipment state (${profile} profile)`);
      let snap=await refreshAuthoritativeInventory();
      if(!snap.inventory.length&&!Object.keys(snap.equipped).length)throw new Error('No equipment state found. Open/login to the game first.');
      const rows=optimizerCandidateRows(profile),groups=Object.fromEntries(SLOT_NAMES.map(x=>[x,[]]));
      for(const row of rows){const slot=slotFromGameItem(row.raw);if(slot)groups[slot].push(row);}
      const selected={};
      for(const slot of SLOT_NAMES){
        const list=groups[slot].sort((a,b)=>b.score-a.score);if(!list.length)continue;
        const incumbentRaw=Object.values(liveEquipmentData()||{}).find(x=>slotFromGameItem(x)===slot)||null;
        const incumbent=incumbentRaw?{raw:incumbentRaw,item:itemFromGameData(incumbentRaw,true),score:optimizerRawScore(incumbentRaw,profile)}:null;
        const best=list[0];
        const improvement=incumbent&&incumbent.score>0?((best.score/incumbent.score)-1)*100:Infinity;
        const winner=incumbent&&best.raw.id!==incumbent.raw.id&&improvement<minPct?incumbent:best;
        selected[slot]=winner;
        protectItem(winner.item);
        const plan={slot,profile,incumbentId:incumbent?.item?.id||null,incumbentName:incumbentRaw?.name||null,incumbentLevel:Number(incumbentRaw?.item_level)||0,incumbentScore:incumbent?.score||0,winnerId:winner.item.id,winnerName:winner.raw.name||null,winnerLevel:Number(winner.raw.item_level)||0,winnerScore:winner.score,improvementPct:Number.isFinite(improvement)?improvement:null,action:winner.item.id===incumbent?.item?.id?'keep':'equip'};
        STATE.optimizerPlan.push(plan);
        if(plan.action==='equip'&&globalThis.IHS2?.CombatAdvisor?.decisionRecord){const d=globalThis.IHS2.CombatAdvisor.decisionRecord(slot,plan.incumbentId,plan.winnerId,STATE.combatMetrics||{},STATE.adaptiveWeights||{},Date.now());emit('IHS2_DECISION',d);}
        log(`Optimizer: ${slot} ${plan.action==='keep'?'keeps':'selects'} ${winner.raw.name||winner.item.id} · iLVL ${plan.winnerLevel} · score ${winner.score.toFixed(1)}${Number.isFinite(improvement)?` · ${improvement>=0?'+':''}${improvement.toFixed(2)}% vs equipped`:''}`);
      }
      if(Object.keys(selected).length!==8||new Set(Object.values(selected).map(x=>x.item.id)).size!==8){STATE.purgeEnabled=false;log('Optimizer: final eight incomplete; cleanup disabled','warn');}

      if(cfg.equipWinners!==false&&!STATE.stopRequested){
        for(const slot of SLOT_NAMES){
          const row=selected[slot];if(!row)continue;
          const incumbent=readEquipped()[slot];
          let ok=true;
          if(incumbent?.id!==row.item.id)ok=await equipWinnerDirect(slot,row.item);
          if(!ok){STATE.purgeEnabled=false;const fallback=readEquipped()[slot];if(fallback){selected[slot]={raw:rawItemById(fallback.id)||{},item:fallback,score:scoreItem(fallback,profile)};protectItem(fallback);}}
          STATE.optimizerResult.push({slot,selectedId:row.item.id,equippedId:readEquipped()[slot]?.id||null,status:ok?'verified':'failed'});
        }
      }

      STATE.finalKeepSet=Object.fromEntries(Object.entries(selected).map(([slot,row])=>[slot,row.item.id]));
      if(cfg.lockWinners&&!STATE.stopRequested){
        for(const [slot,id] of Object.entries(STATE.finalKeepSet)){const item=itemFromGameData(rawItemById(id),readEquipped()[slot]?.id===id)||readEquipped()[slot];if(item&&!item.locked){const ok=await setDecompileLockDirect(item,true);if(!ok)STATE.purgeEnabled=false;}}
      }

      if(cfg.enhanceAfterOptimize&&STATE.settings.enhance.enabled&&!STATE.stopRequested){await runEnhancement(true);STATE.runningEngine='optimizer';}

      snap=await refreshAuthoritativeInventory(2500);
      for(const [slot,id] of Object.entries(STATE.finalKeepSet)){
        const eq=snap.equipped[slot];if(cfg.equipWinners!==false&&eq?.id!==id){STATE.purgeEnabled=false;log(`Optimizer verification: ${slot} expected ${id}, found ${eq?.id||'empty'}`,'error');}
        const raw=rawItemById(id);if(cfg.lockWinners&&raw&&!raw.decompile_locked){STATE.purgeEnabled=false;log(`Optimizer verification: ${slot} winner is not decompile-locked`,'warn');}
      }
      if(cfg.cleanupEnabled&&!STATE.stopRequested){await exactCleanup();STATE.runningEngine='optimizer';}else log('Optimizer: cleanup disabled by settings');
      STATE.lastRuns.optimizer=Date.now();STATE.optimizerEvidenceBaseline={ts:Date.now(),metrics:STATE.combatMetrics?{...STATE.combatMetrics}:null,winnerIds:Object.values(STATE.finalKeepSet||{})};log(`Optimizer complete: ${STATE.optimizerResult.filter(x=>x.status==='verified').length}/${STATE.optimizerResult.length} slot actions verified`);const failedSlots=STATE.optimizerResult.filter(x=>x.status==='failed').map(x=>x.slot);if(failedSlots.length)throw new Error(`Optimizer incomplete: ${failedSlots.length} slot(s) failed (${failedSlots.join(', ')}). Consult Diagnostics before retrying.`);
    } finally {STATE.runningEngine=null;emitStatus();}
  }

  async function exactCleanup() {
    let snap=completeSnapshot();
    if (!STATE.purgeEnabled || !snap.complete) {
      log(`Cleanup refused: purgeEnabled=${STATE.purgeEnabled}, inventoryComplete=${snap.complete}`, 'warn');
      return;
    }
    const protectedSet=protectedIds();
    const deleteSet=snap.inventory.filter(i =>
      i.identityConfidence === 1 &&
      !i.signature && !i.locked && !i.listed &&
      !protectedSet.has(i.id)
    );
    STATE.deleteCandidates=new Set(deleteSet.map(i=>i.id));
    if (!deleteSet.length) { log('Cleanup: no proven disposable items'); return; }

    const assertProtected = () => {
      const s=completeSnapshot();
      const owned=new Set([...s.inventory.map(i=>i.id),...Object.values(s.equipped).map(i=>i.id)]);
      for (const id of protectedIds()) {
        if (!owned.has(id) && STATE.inventory.some(i=>i.id===id)) throw new Error(`Protected item missing: ${id}`);
      }
    };
    assertProtected();

    const decompileOne=async(item)=>{
      if (protectedIds().has(item.id) || item.signature || item.locked || item.identityConfidence!==1) throw new Error(`Deletion denied ${item.id}`);
      await normalItemAction(item,['DECOMPILE'],{destructive:true,confirm:true,confirmNames:['DECOMPILE','CONFIRM','YES'],timeout:7000});
      await sleep(180);
      const remains=completeSnapshot().inventory.some(i=>i.id===item.id);
      if (remains) throw new Error(`Delete did not settle for ${item.id}`);
      assertProtected();
    };

    const canary=deleteSet[0];
    log(`Cleanup canary: ${canary.id}`);
    try { await decompileOne(canary); }
    catch(e){ STATE.purgeEnabled=false; log(`Canary failed; purge stopped: ${e.message}`,'error'); return; }

    for (let i=1;i<deleteSet.length;i++) {
      if (STATE.stopRequested || !STATE.purgeEnabled) break;
      const id=deleteSet[i].id;
      const current=completeSnapshot().inventory.find(x=>x.id===id);
      if (!current) continue;
      try { await decompileOne(current); }
      catch(e){ STATE.purgeEnabled=false; log(`Cleanup stopped on ${id}: ${e.message}`,'error'); break; }
      if ((i+1)%4===0) assertProtected();
      await sleep(120);
    }
  }

  function craftSnapshot(panel,item) {
    const text=textOf(panel);
    const sm=text.match(/STABILITY\s*:?\s*(\d+)(?:\s*\/\s*(\d+))?/i);
    const stability=sm?Number(sm[1]):item.stability;
    const tiers=extractAffixTiers(text);
    const signature=extractSignature(text,panel)||item.signature;
    const available=clickables(panel).map(b=>upper(b.value||textOf(b)));
    const affixCount=Math.max(tiers.length, [...text.matchAll(/\b(?:PREFIX|SUFFIX)\b/gi)].length);
    return {text,stability,tiers,signature,available,affixCount,maxAffixes:signature==='Stable Construction'?7:6};
  }

  function targetTierNumber(v) {
    const m=String(v).match(/T([1-9])/i); return m?Number(m[1]):null;
  }

  function creditsCostNear(button) {
    const txt=textOf(button.parentElement || button);
    const m=txt.match(/([\d.,KMBTQ]+)\s*CREDITS?/i) || txt.match(/CREDITS?\s*:?\s*([\d.,KMBTQ]+)/i);
    return m?parseNumber(m[1]):0;
  }

  function allowedCreditCost(cost,cfg,spent) {
    if (!cost) return true;
    if (!cfg.maxCreditsPerAction || !cfg.maxCreditsPerRun) return false;
    return cost <= cfg.maxCreditsPerAction && spent + cost <= cfg.maxCreditsPerRun;
  }

  // Canonical effect families. Aliases let the profile survive minor server naming changes.
  const ENHANCE_EFFECT_ALIASES={
    xp_global:['xp_global','global_xp','experience_global'],
    xp_gathering:['xp_gathering','gathering_xp','gather_xp'],
    xp_hack:['xp_hack','hack_xp','hacking_xp'],
    xp_crafting:['xp_crafting','crafting_xp','craft_xp','enhancing_xp','enhancement_xp'],
    gathering_resources_multi:['gathering_resources_multi','gathering_resources','resource_gathering_multi'],
    credits:['credits','credit_gain','credits_multi'],
    item_rarity:['item_rarity','rarity_boost'],
    drop_boost:['drop_boost','item_drop_boost']
  };
  const ENHANCE_PROFILE_EFFECTS={
    leveling:{xp_global:5,xp_gathering:4.5,xp_hack:3.5,xp_crafting:3.5,item_rarity:1.25,drop_boost:1.25},
    progression:{xp_global:5,xp_gathering:4.5,xp_hack:3.5,xp_crafting:3.5,item_rarity:1.25,drop_boost:1.25}, // v1.8 compatibility
    gathering:{xp_gathering:5,gathering_resources_multi:4,xp_global:2,item_rarity:1,drop_boost:1},
    hacking:{xp_hack:5,xp_global:3,credits:1.5,item_rarity:1},
    crafting:{xp_crafting:6,xp_global:2,item_rarity:1,drop_boost:1},
    loot:{item_rarity:5,drop_boost:5,credits:2,xp_global:1},
    combat:{attack_damage:3,accuracy:2.5,crit_chance:2.3,crit_damage:2.3,armor_penetration:2.2,max_hp:1.8,defense:1.8,evasion:1.8},
    balanced:{xp_global:2,xp_gathering:2,xp_hack:2,xp_crafting:2,gathering_resources_multi:2,credits:1.5,item_rarity:1.5,drop_boost:1.5,attack_damage:1,accuracy:1,max_hp:1,defense:1}
  };
  function canonicalEnhanceEffect(resource){
    const r=String(resource||'').trim().toLowerCase();
    for(const [canonical,aliases] of Object.entries(ENHANCE_EFFECT_ALIASES)) if(aliases.includes(r)) return canonical;
    return r;
  }
  function enhanceWeights(cfg){
    const profile=String(cfg.profile||'leveling');
    const base={...(ENHANCE_PROFILE_EFFECTS[profile]||ENHANCE_PROFILE_EFFECTS.leveling)};
    const preferred=new Set((Array.isArray(cfg.preferredEffects)?cfg.preferredEffects:[]).map(canonicalEnhanceEffect));
    for(const x of preferred) base[x]=Math.max(7,Number(base[x]||0));
    for(const x of String(cfg.customEffectIds||'').split(',').map(x=>canonicalEnhanceEffect(x)).filter(Boolean)) base[x]=Math.max(8,Number(base[x]||0));
    if(String(cfg.focusMode||'weighted')==='strict' && preferred.size){
      for(const k of Object.keys(base)) if(!preferred.has(k)) base[k]=0;
    }
    return base;
  }
  function rawAffixes(item){
    const out=[];
    for(const [type,key] of [['prefix','prefixes'],['suffix','suffixes']]) (Array.isArray(item?.[key])?item[key]:[]).forEach((a,index)=>out.push({type,index,affix:a}));
    return out;
  }
  function affixProfileScore(a,cfg){
    const weights=enhanceWeights(cfg); let score=0;
    for(const e of Array.isArray(a?.effects)?a.effects:[]){
      const w=Number(weights[canonicalEnhanceEffect(e?.resource)])||0, v=Number(e?.value), lo=Number(e?.value_min), hi=Number(e?.value_max);
      const q=Number.isFinite(v)&&Number.isFinite(lo)&&Number.isFinite(hi)&&hi>lo?clamp01((v-lo)/(hi-lo)):.5;
      score+=w*(.7+.6*q);
    }
    if(String(a?.affix_id||'').startsWith('prefix_') && score===0) score+=.05;
    return score;
  }
  function rawItemById(id){
    const inv=liveInventoryData(); if(Array.isArray(inv?.items)){const x=inv.items.find(i=>String(i?.id)===String(id));if(x)return x;}
    const eq=liveEquipmentData(); if(eq&&typeof eq==='object') for(const x of Object.values(eq)) if(String(x?.id)===String(id)) return x;
    return null;
  }
  function rawItemFingerprint(item){
    if(!item)return '';
    return JSON.stringify({id:item.id,stability:item.stability,compiled:item.compiled_bonus_pct||item.effective_compiled_bonus_pct||0,p:rawAffixes(item).map(x=>[x.type,x.index,x.affix?.affix_id,x.affix?.tier,(x.affix?.effects||[]).map(e=>e.value)])});
  }
  function maxAffixCapacity(item){return Math.max(1,Number(item?.max_normal_affixes)||Number(item?.max_affixes)||6);}
  function affixRollQualityPct(a){
    const qs=(Array.isArray(a?.effects)?a.effects:[]).map(e=>{const v=Number(e?.value),lo=Number(e?.value_min),hi=Number(e?.value_max);return Number.isFinite(v)&&Number.isFinite(lo)&&Number.isFinite(hi)&&hi>lo?clamp01((v-lo)/(hi-lo))*100:null;}).filter(x=>x!==null);
    return qs.length?qs.reduce((a,b)=>a+b,0)/qs.length:50;
  }
  const SLOT_PRIMARY_RESOURCES={main_hand:'snippets',off_hand:'hashes',head:'packets',chest:'hashes',gloves:'cycles',boots:'packets',acc1:'cycles',acc2:'snippets'};
  const SLOT_SECONDARY_RESOURCES={main_hand:'cycles',off_hand:'packets',head:'cycles',chest:'snippets',gloves:'snippets',boots:'hashes',acc1:'packets',acc2:'hashes'};
  function primaryResourceKey(item){try{if(typeof getPrimaryResourceKey==='function')return getPrimaryResourceKey(item);}catch{}return SLOT_PRIMARY_RESOURCES[String(item?.slot||'')]||'credits';}
  function secondaryResourceKey(item){try{if(typeof getSecondaryResourceKey==='function')return getSecondaryResourceKey(item);}catch{}return SLOT_SECONDARY_RESOURCES[String(item?.slot||'')]||'credits';}
  function previewCost(item,key){const p=item?.crafting_preview||{};const n=Number(p[key]);return Number.isFinite(n)&&n>=0?n:0;}
  function playerHas(resource,cost){return (Number(liveCurrentPlayer()?.[resource])||0)>=Math.max(0,Number(cost)||0);}
  function effectiveTargetTier(cfg){const explicit=targetTierNumber(cfg.targetTier);if(explicit)return explicit;const strategy=String(cfg.strategy||'balanced');return strategy==='maximize-stats'?1:strategy==='minimize-cost'?5:3;}
  function costLabel(costs){return costs.filter(x=>x.amount>0).map(x=>`${Math.ceil(x.amount).toLocaleString()} ${x.resource} (${Math.floor(x.have).toLocaleString()} available)`).join(' + ')||'no resource cost';}
  function makeCraftPlan(item,op,label,payload,reason,costs=[],creditCost=0,extra={}){
    const cfg=extra.cfg||STATE.settings.enhance,spent=Number(extra.spent)||0;
    const all=[...costs].map(x=>({...x,have:Number(liveCurrentPlayer()?.[x.resource])||0}));
    const missing=all.filter(x=>x.have+1e-9<x.amount);
    let creditBlocked=false;
    if(creditCost>0){const credits=Number(liveCurrentPlayer()?.credits)||0;if(credits<creditCost)missing.push({resource:'credits',amount:creditCost,have:credits});else if(!allowedCreditCost(creditCost,cfg,spent))creditBlocked=true;}
    const affordable=!missing.length&&!creditBlocked;
    const blockedReason=missing.length?`needs ${costLabel(missing)}`:creditBlocked?`credit budget blocks ${Math.ceil(creditCost).toLocaleString()} credits`:null;
    return{op,label,payload,reason,costs:all,creditCost,affordable,blockedReason,...extra};
  }
  function desiredAffixRows(item,cfg){return rawAffixes(item).map(x=>({...x,score:affixProfileScore(x.affix,cfg),qualityPct:affixRollQualityPct(x.affix)})).filter(x=>x.score>.05).sort((a,b)=>b.score-a.score);}
  function directCraftPlan(item,cfg,stats={creditsSpent:0}){
    if(!item)return{plan:null,blocked:['item unavailable']};
    const stability=Math.max(0,Number(item.stability)||0);if(stability<=0)return{plan:null,blocked:['0 Stability']};
    const primary=primaryResourceKey(item),secondary=secondaryResourceKey(item),aff=rawAffixes(item),desired=desiredAffixRows(item,cfg),target=effectiveTargetTier(cfg),rollFloor=Math.max(0,Math.min(100,Number(cfg.refactorBelowPct)||75)),blocked=[];
    const candidates=[];
    const prefixes=Array.isArray(item.prefixes)?item.prefixes:[],suffixes=Array.isArray(item.suffixes)?item.suffixes:[];
    const canAdd=aff.length<maxAffixCapacity(item)&&(prefixes.length<(Number(item.max_prefixes)||3)||suffixes.length<(Number(item.max_suffixes)||3));
    if(canAdd)candidates.push(makeCraftPlan(item,'EQUIPMENT_AUGMENT','AUGMENT',{item_id:String(item.id)},'Fill an open affix slot',[{resource:primary,amount:previewCost(item,'augment_cost')}],previewCost(item,'augment_credit_cost'),{cfg,spent:stats.creditsSpent}));

    const poor=desired.filter(x=>x.qualityPct<rollFloor&&!(x.affix?.effects||[]).every(e=>e.value_max!=null&&Number(e.value)>=Number(e.value_max))).sort((a,b)=>a.qualityPct-b.qualityPct||b.score-a.score);
    for(const x of poor.slice(0,3))candidates.push(makeCraftPlan(item,'EQUIPMENT_MASTERWORK','REFACTOR',{item_id:String(item.id),affix_type:x.type,affix_index:x.index},`Improve ${x.affix?.affix_id||x.type} roll (${x.qualityPct.toFixed(0)}% < ${rollFloor}% target)`,[{resource:secondary,amount:previewCost(item,'masterwork_cost')}],0,{cfg,spent:stats.creditsSpent,affix:x}));

    if(cfg.allowRiskyVersionUpgrade){const ups=desired.filter(x=>Number(x.affix?.tier)>target&&Number(x.affix?.tier)>1).sort((a,b)=>b.score-a.score||Number(b.affix?.tier)-Number(a.affix?.tier));for(const x of ups.slice(0,3))candidates.push(makeCraftPlan(item,'EQUIPMENT_TIER_PROMOTE','VERSION UPGRADE',{item_id:String(item.id),affix_type:x.type,affix_index:x.index},`Promote preferred ${x.affix?.affix_id||x.type} from T${x.affix?.tier} toward T${target}`,[{resource:primary,amount:previewCost(item,'tier_promotion_primary_cost')},{resource:secondary,amount:previewCost(item,'tier_promotion_secondary_cost')}],0,{cfg,spent:stats.creditsSpent,affix:x,chance:Number(x.affix?.tier_promotion_chance)}));}

    const unwanted=rawAffixes(item).map(x=>({...x,score:affixProfileScore(x.affix,cfg)})).filter(x=>x.score<=.05).sort((a,b)=>Number(b.affix?.tier)-Number(a.affix?.tier));
    if(cfg.allowPrune&&unwanted.length)candidates.push(makeCraftPlan(item,'EQUIPMENT_ANNUL','PRUNE',{item_id:String(item.id)},'Remove an unwanted affix so the build can roll again',[{resource:secondary,amount:previewCost(item,'annul_cost')}],0,{cfg,spent:stats.creditsSpent,destructive:true}));

    const full=aff.length>=maxAffixCapacity(item),hasDesired=desired.length>0,desiredAtTier=hasDesired&&desired.every(x=>Number(x.affix?.tier)<=target),desiredRolled=hasDesired&&desired.every(x=>x.qualityPct>=Math.max(rollFloor,85));
    const compileAllowed=cfg.compilePolicy==='terminal'?(candidates.length===0&&full):cfg.compilePolicy==='when-optimal'?(full&&hasDesired&&desiredAtTier&&desiredRolled):false;
    if(compileAllowed)candidates.push(makeCraftPlan(item,'EQUIPMENT_COMPILE','COMPILE',{item_id:String(item.id)},'Full item meets selected profile/tier/roll goals; bank remaining Stability as compiled power',[{resource:primary,amount:previewCost(item,'compile_cost')}],0,{cfg,spent:stats.creditsSpent,terminal:true}));

    for(const c of candidates){if(c.affordable)return{plan:c,blocked};blocked.push(`${c.label}: ${c.blockedReason}`);}
    return{plan:null,blocked:blocked.length?blocked:['no worthwhile action under current profile/policy']};
  }
  async function sendDirectCraft(item,plan,cfg,stats){
    protectItem(itemFromGameData(item,false)||{id:item.id},true);
    if(cfg.dryRun){log(`[ENHANCE] DRY RUN ${slotFromGameItem(item)||item.base_type}: ${plan.label} — ${plan.reason}; cost ${costLabel((plan.costs||[]).map(x=>({...x,have:Number(liveCurrentPlayer()?.[x.resource])||0})))}${plan.creditCost?` + ${Math.ceil(plan.creditCost).toLocaleString()} credits`:''}`);STATE.enhanceResult.push({itemId:String(item.id),slot:slotFromGameItem(item),op:plan.op,status:'dry-run',reason:'Preview only; no action sent and no resources spent'});return{item,rolledFailure:false};}
    const before=rawItemFingerprint(item),beforeCredits=Number(liveCurrentPlayer()?.credits)||0;
    const resultType=`${plan.op}_RESULT`;
    const changed=await sendActionAndAwait({type:plan.op,payload:plan.payload,itemId:item.id,throttleKey:`craft-${plan.op}-${item.id}`,minIntervalMs:Math.max(450,Number(cfg.baseDelayMs)||450),timeoutMs:Math.max(2500,Number(cfg.settlementTimeoutMs)||10000),resultTypes:[resultType],predicate:()=>{const now=rawItemById(item.id);return now&&rawItemFingerprint(now)!==before?now:null;}});
    const actionResult=changed&&changed.__actionResult?changed.__actionResult:null;
    if(actionResult)await sleep(80); // Let the game's own result handler apply resources/item state.
    const authoritative=actionResult?.payload?.item||rawItemById(item.id)||item;
    const afterCredits=Number(actionResult?.payload?.resources?.credits??liveCurrentPlayer()?.credits)||0;stats.creditsSpent+=Math.max(0,beforeCredits-afterCredits);stats.succeeded++;
    const rolledFailure=plan.op==='EQUIPMENT_TIER_PROMOTE'&&actionResult&&actionResult.payload?.rolled_success===false;
    STATE.enhanceResult.push({itemId:String(item.id),slot:slotFromGameItem(item),op:plan.op,status:rolledFailure?'rolled-failure':'verified',reason:rolledFailure?(actionResult.payload?.stability_preserved?'Version Upgrade failed; Snapshot Backups preserved Stability':'Version Upgrade roll failed'):plan.reason,creditSpent:Math.max(0,beforeCredits-afterCredits)});
    await sleep(Math.max(350,Number(cfg.baseDelayMs)||450));return{item:authoritative,rolledFailure};
  }
  async function runEnhancement(nested=false) {
    if(STATE.runningEngine&&!nested&&STATE.runningEngine!=='enhance')throw new Error(`Busy: ${STATE.runningEngine}`);
    const priorEngine=STATE.runningEngine;STATE.runningEngine='enhance';STATE.stopRequested=false;STATE.enhanceStatus='planning';STATE.enhancePlan=[];STATE.enhanceResult=[];
    if(!nested){STATE.sessionTouchedIds=new Set();STATE.quarantineIds=new Set();}
    const cfg=STATE.settings.enhance,stats={planned:0,attempted:0,succeeded:0,failed:0,skipped:0,creditsSpent:0,rateLimits:0};
    const currentResources=safeResourceSnapshot();
    if(!STATE.enhanceBudgetLedger&&globalThis.IHS2?.EnhancementBudget?.createLedger)STATE.enhanceBudgetLedger=globalThis.IHS2.EnhancementBudget.createLedger(currentResources,Date.now());
    if(STATE.enhanceBudgetLedger){STATE.enhanceBudgetLedger.startingResources={...currentResources};STATE.enhanceBudgetLedger.itemSpent={};STATE.enhanceBudgetLedger.passSpent={};}
    try{
      await refreshAuthoritativeInventory();
      let targets=[];
      if(Object.keys(STATE.finalKeepSet).length){for(const [slot,id] of Object.entries(STATE.finalKeepSet)){if(cfg.slots[slot]){const x=rawItemById(id);if(x)targets.push(x);}}}
      if(!targets.length){const eq=liveEquipmentData();if(eq&&typeof eq==='object')for(const x of Object.values(eq)){const slot=slotFromGameItem(x);if(slot&&cfg.slots[slot])targets.push(x);}}
      if(!targets.length){const inv=liveInventoryData(),profile=STATE.settings.optimizer.profile||'balanced';for(const slot of SLOT_NAMES.filter(x=>cfg.slots[x])){const list=(Array.isArray(inv?.items)?inv.items:[]).filter(x=>slotFromGameItem(x)===slot).map(raw=>({raw,score:optimizerRawScore(raw,profile)})).sort((a,b)=>b.score-a.score);if(list[0])targets.push(list[0].raw);}}
      if(!targets.length)throw new Error('No enhancement targets found in authoritative inventory/equipment state');
      STATE.enhanceStatus=cfg.dryRun?'dry-run':'running';
      for(let target of targets){
        if(STATE.stopRequested)break;let steps=0;
        while(!STATE.stopRequested&&steps<24){
          target=rawItemById(target.id)||target;const decision=directCraftPlan(target,cfg,stats),slot=slotFromGameItem(target)||target.base_type;
          if(!decision.plan){stats.skipped++;const why=decision.blocked.slice(0,3).join('; ');STATE.enhancePlan.push({itemId:String(target.id),slot,action:null,blocked:decision.blocked,resources:safeResourceSnapshot()});STATE.enhanceResult.push({itemId:String(target.id),slot,status:'blocked',reason:why});log(`[ENHANCE] ${slot}: skipped — ${why}`,'warn');break;}
          const plan=decision.plan;
          const resources=safeResourceSnapshot();
          const budget=globalThis.IHS2?.EnhancementBudget?.canSpend?.(plan.costs||[],resources,cfg,STATE.enhanceBudgetLedger,{itemId:String(target.id),now:Date.now(),isReroll:plan.op==='EQUIPMENT_MASTERWORK'} )||{ok:true,reason:'legacy budget path'};
          if(!budget.ok){stats.skipped++;const why=`Crafting budget: ${budget.reason}`;STATE.enhancePlan.push({itemId:String(target.id),slot,action:null,blocked:[why],resources,budget});STATE.enhanceResult.push({itemId:String(target.id),slot,status:'budget-blocked',reason:why});log(`[ENHANCE] ${slot}: ${why}`,'warn');break;}
          STATE.enhancePlan.push({itemId:String(target.id),slot,action:plan.op,label:plan.label,reason:plan.reason,costs:plan.costs,creditCost:plan.creditCost,resources,budget});if(cfg.dryRun)stats.planned++;else stats.attempted++;log(`[ENHANCE] ${slot}: ${plan.label} — ${plan.reason} · budget ${budget.profile||cfg.budgetProfile||'balanced'}`);
          try{const outcome=await sendDirectCraft(target,plan,cfg,stats);if(!cfg.dryRun&&STATE.enhanceBudgetLedger&&globalThis.IHS2?.EnhancementBudget?.recordSpend){globalThis.IHS2.EnhancementBudget.recordSpend(STATE.enhanceBudgetLedger,String(target.id),plan.costs||[],Date.now(),{isReroll:plan.op==='EQUIPMENT_MASTERWORK',improved:!outcome?.rolledFailure});emit('IHS2_TELEMETRY',{store:'enhancement_spend',value:{ts:Date.now(),itemId:String(target.id),slot,op:plan.op,costs:plan.costs||[],profile:cfg.budgetProfile||'balanced'}});}if(cfg.dryRun||plan.terminal||outcome?.rolledFailure){if(outcome?.rolledFailure)log(`[ENHANCE] ${slot}: Version Upgrade roll failed; stopping this item for the current pass`,'warn');break;}target=outcome?.item||target;steps++;}
          catch(e){stats.failed++;const msg=String(e.message||e);if(/rate/i.test(msg))stats.rateLimits++;STATE.enhanceResult.push({itemId:String(target.id),slot,op:plan.op,status:'failed',reason:msg});log(`[ENHANCE] ${slot}: ${msg}`,'warn');break;}
        }
      }
      STATE.enhanceStatus=STATE.stopRequested?'stopped':cfg.dryRun?'dry-run':'complete';STATE.lastRuns.enhance=Date.now();
      log(`[ENHANCE] ${STATE.enhanceStatus}: profile ${cfg.profile||'leveling'}, previewed ${stats.planned}, attempted ${stats.attempted}, succeeded ${stats.succeeded}, blocked/skipped ${stats.skipped}, failed ${stats.failed}, credits ${Math.round(stats.creditsSpent).toLocaleString()}`);
    } finally {STATE.runningEngine=nested?priorEngine:null;emitStatus();}
  }

  function closestCard(button) {
    let el=button;
    for (let i=0;i<6 && el;i++,el=el.parentElement) {
      const txt=textOf(el);
      if (txt.length>20 && txt.length<2500) return el;
    }
    return button.parentElement || document;
  }

  function rewardScore(text) {
    let s=0;
    for (const m of text.matchAll(/([\d.,KMBTQ]+)\s*HACKCOIN/ig)) s+=parseNumber(m[1])*1e6;
    for (const m of text.matchAll(/([\d.,KMBTQ]+)\s*CHIPS?/ig)) s+=parseNumber(m[1])*2000;
    for (const m of text.matchAll(/([\d.,KMBTQ]+)\s*CREDITS?/ig)) s+=parseNumber(m[1]);
    if (/COMPLETED|100%/i.test(text)) s+=1e9;
    return s;
  }

  function contractRewardValue(c){const r=c?.rewards||{};return Number(r.hackcoin||0)*1e9+Number(r.chips||0)*1e5+Number(r.credits||0);}
  function eventEffectiveRole(){const r=String(STATE.eventParticipation?.role||'');return r|| (STATE.settings.events.role==='gatherer'?'gathering':'hacking');}
  function contractScore(c){if(!c||c.claimed)return-Infinity;const remaining=Math.max(1,Number(c.target||1)-Number(c.progress||0)),progress=Math.max(0,Number(c.progress||0))/Math.max(1,Number(c.target||1)),duration=({quick:1.45,standard:1.2,extended:1,marathon:.8})[String(c.duration||'').toLowerCase()]||1;let score=contractRewardValue(c)/remaining*duration*(1+progress*.9);if(c.is_carryover&&Number(c.progress||0)>0)score*=1.2;if(STATE.settings.contracts.preferRoleAligned){const role=eventEffectiveRole();if(role==='gathering'&&c.type==='harvest')score*=1.8;if(role==='hacking'&&(c.type==='kills'||c.type==='drops'))score*=1.45;}return score;}
  async function runContracts() {
    const cfg=STATE.settings.contracts;if(!cfg.enabled)return;
    const now=Date.now(),contractsCheck=globalThis.IHS2?.ContractExecution;
    if(STATE.contractPending){
      const pending=STATE.contractPending;
      const verified=contractsCheck?.verify?.(STATE.contractsState,pending)||{verified:false,reason:'no verification logic'};
      if(verified.verified){
        STATE.contractLastAction=pending.type==='CONTRACT_CLAIM'?'claim verified by server':'active contract verified by server';
        STATE.contractLastVerifiedAt=now;
        traceAction({type:pending.type,result:'verified',detail:pending.id});
        STATE.contractPending=null;STATE.contractLastRejected=null;
      }else if(now-pending.startedAt<12000){
        STATE.contractLastAction=`waiting to verify ${pending.type} (${verified.reason})`;
        if(now-STATE.contractsStateAt>2500)automationProtocolSend('GET_CONTRACTS',{},'contract',2500);
        STATE.lastRuns.contracts=now;return;
      }else{
        STATE.contractLastRejected=`${pending.type} ${pending.id}: no authoritative confirmation within 12s`;
        STATE.contractLastAction=STATE.contractLastRejected;
        traceAction({type:pending.type,result:'unverified',detail:pending.id});
        STATE.contractPending=null;
        automationProtocolSend('GET_CONTRACTS',{},'contract',2500);
        STATE.lastRuns.contracts=now;return;
      }
    }
    if(!STATE.contractsState||now-STATE.contractsStateAt>Number(cfg.recoveryPollMs||45000)){
      if(automationProtocolSend('GET_CONTRACTS',{},'contract',5000))STATE.contractLastAction='refresh requested';
      if(!STATE.contractsState){STATE.lastRuns.contracts=now;return;}
    }
    const ctx={eventRole:eventEffectiveRole(),previousBoardKey:STATE.contractPreviousBoardKey};
    const intents=globalThis.IHS2?.Contracts?.planContracts?.(STATE.contractsState,cfg,ctx)||[];
    const intent=intents[0];
    if(intent){
      if(automationProtocolSend(intent.type,intent.payload??{},'contract',intent.type==='GET_CONTRACTS'?1200:1800)){
        STATE.contractLastAction=intent.reason||intent.type;
        const pending=contractsCheck?.pendingFor?.(intent,Date.now(),STATE.contractsState?.board_key||'');
        if(pending){STATE.contractPending=pending;STATE.contractLastAction+='; awaiting server verification';}
        log(`Contracts: ${STATE.contractLastAction}`);
        if(intent.type==='GET_CONTRACTS')STATE.contractPreviousBoardKey=STATE.contractsState?.board_key||null;
      }
    } else STATE.contractLastAction=STATE.contractsState?.active_contract_id?'active contract retained':'no actionable contract';
    STATE.lastRuns.contracts=Date.now();
  }

  async function runEvents() {
    const cfg=STATE.settings.events;if(!cfg.enabled)return;
    if(!STATE.eventStatus||Date.now()-STATE.eventStatusAt>10000){if(automationProtocolSend('EVENT_GET_STATUS',{},'event',5000))STATE.eventLastAction='status requested';if(!STATE.eventStatus){STATE.lastRuns.events=Date.now();return;}}
    const intents=globalThis.IHS2?.Events?.planEvent?.(STATE.eventStatus,STATE.eventParticipation||{},cfg)||[];
    const intent=intents[0];
    if(intent&&automationProtocolSend(intent.type,intent.payload||{},'event',1800)){STATE.eventLastAction=intent.reason||intent.type;log(`Events: ${STATE.eventLastAction}`);}
    else if(!intent){const part=STATE.eventParticipation||{},phase=String(STATE.eventStatus?.phase||'idle');STATE.eventLastAction=part.opted_in?`participating ${part.role||eventEffectiveRole()}`:(phase==='idle'?'no active event':`event ${phase}`);}
    STATE.lastRuns.events=Date.now();
  }

  async function setSelectByText(select, desired) {
    if (!select) return false;
    const opt=[...select.options].find(o=>upper(o.textContent).includes(upper(desired)) || upper(o.value)===upper(desired));
    if (!opt) return false;
    select.value=opt.value;
    select.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  }

  async function runResources() {
    const cfg=STATE.settings.resources;
    if (!cfg.enabled) return;
    const labels={
      bottleneck_balancer:'Bottleneck Balancer',
      target_reserve:'Target Reserve',
      progression_priority:'Progression Priority'
    };
    const mode=String(cfg.mode||'bottleneck_balancer');
    if (mode==='equalizer'||mode==='goal') {
      // Legacy v1.x compatibility only. New 2.0 strategies are cross-system
      // decision hints until a current direct Resource Store protocol is captured.
      await openMenu('RESOURCES'); await sleep(120);
      const desired=mode==='goal'?'GOAL':'EQUALIZER';
      const b=findButtonRegex(new RegExp(`\\b${desired}\\b`,'i'));
      if (b) { b.click(); log(`Resources (legacy): switched to ${desired}`); }
      else {
        for (const s of document.querySelectorAll('select')) {
          if (await setSelectByText(s,desired)) { log(`Resources (legacy): selected ${desired}`); break; }
        }
      }
      STATE.resourceStrategyStatus=`Legacy ${desired} control requested`;
    } else {
      const label=labels[mode]||mode;
      STATE.resourceStrategyStatus=`${label} is active as a cross-system strategy. Direct Resource Store purchasing is disabled until its current protocol is verified.`;
      log(`Resources: ${STATE.resourceStrategyStatus}`);
    }
    STATE.lastRuns.resources=Date.now();
  }


  function creditCostFromText(text) {
    const m=text.match(/([\d.,KMBTQ]+)\s*CREDITS?/i) || text.match(/CREDITS?\s*:?\s*([\d.,KMBTQ]+)/i);
    return m?parseNumber(m[1]):NaN;
  }

  function economyProtocolSend(type,payload={},key=type,priority=45,isMutation=true){
    const sock=STATE.gameWs;if(!sock||sock.readyState!==WebSocket.OPEN)return false;
    const gov=globalThis.IHS2?.governor;try{return gov?gov.trySend({type,payload,subsystem:'economy',priority,dedupeKey:`economy:${key}:${JSON.stringify(payload||{})}`,minIntervalMs:isMutation?1200:800,isMutation}):(sock.send(JSON.stringify({type,payload})),true);}catch(e){log(`Economy protocol ${type} failed: ${e.message}`,'warn');return false;}
  }
  async function runShopHomelab() {
    const cfg={...(STATE.settings.shopHomelab||{}),...(STATE.settings.economy||{})};
    if(!cfg.enabled)return;
    const resources=safeResourceSnapshot(),ctx={resources,aggressiveness:cfg.aggressiveness||'balanced',creditReservePct:Number(cfg.creditReservePct??.10),adaptiveWeights:STATE.adaptiveWeights||{},objective:'progression'};
    const hw=liveHardwareInfo();if(!hw){economyProtocolSend('GET_HARDWARE_INFO',{},'hardware-info',45,false);STATE.economyRecommendation='Waiting for Hardware state';}
    const hl=liveHomelabInfo();if(!hl){economyProtocolSend('GET_HOMELAB_INFO',{},'homelab-info',45,false);STATE.economyRecommendation=STATE.economyRecommendation||'Waiting for Homelab state';}
    const options=[];
    if(hw&&globalThis.IHS2?.Hardware){const rows=globalThis.IHS2.Hardware.candidates(hw,{...ctx,adaptiveWeights:STATE.adaptiveWeights||{}});const ranked=globalThis.IHS2.Economy?.rankPurchases?.(rows,ctx)||rows;const x=ranked.find(r=>r.legal!==false);if(x)options.push({...x,actionType:'PURCHASE_HARDWARE',priority:45});}
    if(hl&&globalThis.IHS2?.Homelab){const rows=globalThis.IHS2.Homelab.candidates(hl,ctx);const action=globalThis.IHS2.Homelab.nextAction(rows,hl,ctx);if(action?.candidate)options.push({...action.candidate,actionType:action.type,payload:action.payload,priority:45,reason:action.reason});}
    options.sort((a,b)=>Number(b.score||b.utility||0)-Number(a.score||a.utility||0));const best=options[0];
    if(!best){if(hw&&hl)STATE.economyRecommendation='No legal affordable Hardware/Homelab upgrade under current reserve policy';STATE.lastRuns.shopHomelab=Date.now();return;}
    STATE.economyRecommendation=best.reason||best.name||best.id;
    const payload=best.actionType==='PURCHASE_HARDWARE'?(best.payload||{hardware_type:best.id,quantity:1}):best.payload;
    if(economyProtocolSend(best.actionType,payload,`${best.actionType}:${best.id}`,45,true)){log(`Economy: ${STATE.economyRecommendation}`);emit('IHS2_DECISION',{ts:Date.now(),subsystem:'economy',action:best.actionType,target:best.id,reason:STATE.economyRecommendation,utility:best.utility,cost:best.cost});}
    STATE.lastRuns.shopHomelab=Date.now();
  }

  function marketCooldownRemaining(){const wait=Math.max(3500,Number(STATE.retryAfterMs)||0);return STATE.lastRateLimitAt?Math.max(0,STATE.lastRateLimitAt+wait-Date.now()):0;}
  function marketProtocolStatus(type,payload={},throttleKey=type,minIntervalMs=250) {
    const sock=STATE.gameWs; if(!sock||sock.readyState!==WebSocket.OPEN)return {ok:false,reason:'socket'};
    const now=Date.now(),last=Number(STATE.marketLastCommandAt[throttleKey]||0),localWait=Math.max(0,minIntervalMs-(now-last)),cooldown=marketCooldownRemaining();
    if(localWait>0)return {ok:false,reason:'pace',retryMs:localWait};
    if(cooldown>0)return {ok:false,reason:'rate-limit',retryMs:cooldown};
    try{const isMutation=!/QUERY|GET_|SUBSCRIBE|UNSUBSCRIBE/.test(type);const gov=globalThis.IHS2?.governor;const ok=gov?gov.trySend({type,payload,subsystem:'market',priority:isMutation?25:10,dedupeKey:`market:${throttleKey}:${JSON.stringify(payload||{})}`,minIntervalMs,isMutation}):(sock.send(JSON.stringify({type,payload})),true);if(!ok)return{ok:false,reason:'governor',retryMs:Math.max(0,Number(gov?.snapshot?.().globalCooldownUntil||0)-Date.now())};STATE.marketLastCommandAt[throttleKey]=now;return {ok:true};}catch(e){log(`Marketplace protocol ${type} failed: ${e.message}`,'warn');return {ok:false,reason:'send',error:e.message};}
  }
  function marketProtocolSend(type,payload={},throttleKey=type,minIntervalMs=250){return marketProtocolStatus(type,payload,throttleKey,minIntervalMs).ok;}

  function clamp01(v){ return Math.max(0,Math.min(1,Number(v)||0)); }
  function marketAffixQuality(affix) {
    const scores=(Array.isArray(affix?.effects)?affix.effects:[]).map(e=>{const v=Number(e?.value),lo=Number(e?.value_min),hi=Number(e?.value_max);if(!Number.isFinite(v)||!Number.isFinite(lo)||!Number.isFinite(hi)||hi<=lo)return null;return clamp01((v-lo)/(hi-lo));}).filter(v=>v!==null);
    return scores.length?Math.round((scores.reduce((a,b)=>a+b,0)/scores.length)*10):5;
  }
  function marketLevelBand(level){const n=Math.max(1,Number(level)||1);return Math.floor(Math.log2(n)*4);}
  function marketDescriptor(item) {
    if(!item||typeof item!=='object')return null;
    const affixes=rawAffixes(item).map(x=>({id:String(x.affix?.affix_id||x.affix?.group||'unknown'),tier:Number(x.affix?.tier)||99,q:marketAffixQuality(x.affix),effects:(Array.isArray(x.affix?.effects)?x.affix.effects:[]).map(e=>({resource:String(e?.resource||''),value:Number(e?.value)||0}))})).sort((a,b)=>a.id.localeCompare(b.id)||a.tier-b.tier||a.q-b.q);
    return {baseType:String(item.base_type||slotFromGameItem(item)||'Unknown'),rarity:String(item.rarity||'unknown').toLowerCase(),signatureId:String(item.signature_id||'none'),itemLevel:Number(item.item_level)||1,requiredLevel:Number(item.required_hack_level)||1,compiledBonus:Number(item.effective_compiled_bonus_pct||item.compiled_bonus_pct||0),stability:Number(item.stability)||0,implicitStat:String(item.implicit_info?.stat_type||item.implicit?.stat_type||''),implicitValue:Number(item.implicit_info?.value||0),affixes};
  }
  function marketKeys(desc){if(!desc)return{};const lb=marketLevelBand(desc.itemLevel),base=`${desc.baseType}|${desc.rarity}|${desc.signatureId}|L${lb}`,exact=desc.affixes.map(a=>`${a.id}@${a.tier}:Q${a.q}`).join(','),tier=desc.affixes.map(a=>`${a.id}@${a.tier}`).join(','),set=desc.affixes.map(a=>a.id).join(',');return{exact:`E|${base}|${exact}`,tier:`T|${base}|${tier}`,set:`A|${base}|${set}`,base:`B|${base}`};}
  function marketSampleFromListing(listing){const item=listing?.item,desc=marketDescriptor(item),cents=Number(listing?.price_cents);if(!desc||!Number.isFinite(cents)||cents<=0)return null;return{listingId:String(listing.id||''),itemId:String(listing.item_id||item?.id||''),sellerPlayerId:Number(listing.seller_player_id||0),sellerUsername:String(listing.seller_username||listing.username||''),observedAt:Date.now(),listedAt:Number(listing.created_at)||0,priceCredits:cents/100,descriptor:desc,keys:marketKeys(desc)};}
  function marketSaleSample(activity){const p=activity?.payload_json||{},item=p.item_snapshot,cents=Number(p.price_cents);const desc=marketDescriptor(item);if(!desc||!Number.isFinite(cents)||cents<=0)return null;return{saleId:String(activity.id||`${p.listing_id||''}-${activity.occurred_at||''}`),listingId:String(p.listing_id||''),itemId:String(item.id||''),soldAt:Date.parse(activity.occurred_at||'')||Date.now(),priceCredits:cents/100,descriptor:desc,keys:marketKeys(desc)};}
  function settleMarketWaiter(payload){if(!STATE.marketResponseWaiters.length)return;const page=Number(payload?.page)||1,size=Number(payload?.page_size)||0,mine=Boolean(payload?.mine_only);const idx=STATE.marketResponseWaiters.findIndex(w=>w.page===page&&(!w.pageSize||w.pageSize===size)&&w.mineOnly===mine);if(idx<0)return;const[w]=STATE.marketResponseWaiters.splice(idx,1);clearTimeout(w.timer);w.resolve(payload);}
  function handleMarketEquipListPayload(payload){const listings=Array.isArray(payload?.listings)?payload.listings:[],samples=listings.map(marketSampleFromListing).filter(Boolean);for(const l of listings){if(l?.id)STATE.marketRecentListings.set(String(l.id),l);}if(STATE.marketRecentListings.size>20000){const keep=[...STATE.marketRecentListings.entries()].slice(-15000);STATE.marketRecentListings=new Map(keep);}if(samples.length)emit('MARKET_SAMPLES',{samples,page:Number(payload.page)||1,total:Number(payload.total)||listings.length,mineOnly:Boolean(payload.mine_only)});if(payload?.mine_only)STATE.marketOwnedListings=listings;settleMarketWaiter(payload);}
  function handleMarketActivityPayload(payload){if(!STATE.marketActivityWaiters.length)return;const cats=Array.isArray(payload?.filters?.categories)?payload.filters.categories.map(String):[];if(String(payload?.source||'')!=='marketplace'&&!cats.includes('marketplace_equipment'))return;const page=Number(payload?.page)||1,idx=STATE.marketActivityWaiters.findIndex(w=>w.page===page);if(idx<0)return;const[w]=STATE.marketActivityWaiters.splice(idx,1);clearTimeout(w.timer);const sales=(Array.isArray(payload?.items)?payload.items:[]).filter(x=>x?.event_type==='MARKETPLACE_SELL_FILLED'&&x?.payload_json?.market_kind==='equipment').map(marketSaleSample).filter(Boolean);if(sales.length)emit('MARKET_SALES',{sales});w.resolve(payload);}
  function waitForMarketPage(page,pageSize=100,mineOnly=false,timeoutMs=16000){return new Promise((resolve,reject)=>{const waiter={page,pageSize,mineOnly,resolve,reject,timer:null};waiter.timer=setTimeout(()=>{const i=STATE.marketResponseWaiters.indexOf(waiter);if(i>=0)STATE.marketResponseWaiters.splice(i,1);reject(new Error(`Marketplace page ${page} response timeout`));},timeoutMs);STATE.marketResponseWaiters.push(waiter);});}
  async function requestMarketPage(page,{mineOnly=false,pageSize=100,sort='level_desc',maxRequired=null,retries=6}={}){
    const payload={page,page_size:pageSize,sort};if(mineOnly)payload.mine_only=true;if(!mineOnly&&Number.isFinite(Number(maxRequired))&&Number(maxRequired)>0)payload.max_required_hack_level=Math.floor(Number(maxRequired));
    for(let attempt=0;attempt<=retries;attempt++){
      if(STATE.stopRequested)throw new Error('Stopped');const cooldown=marketCooldownRemaining();if(cooldown>0)await sleep(cooldown+150);
      const waiter=waitForMarketPage(page,pageSize,mineOnly,16000),st=marketProtocolStatus('MARKET_EQUIP_QUERY',payload,`equip-query-${mineOnly?'mine':'all'}-${page}`,Math.max(350,Number(STATE.settings.marketplace.pageDelayMs)||550));
      if(!st.ok){const idx=STATE.marketResponseWaiters.findIndex(w=>w.page===page&&w.mineOnly===mineOnly);if(idx>=0){const[w]=STATE.marketResponseWaiters.splice(idx,1);clearTimeout(w.timer);}if(st.reason==='socket')throw new Error('Marketplace socket closed');await sleep(Math.max(300,Number(st.retryMs)||750));continue;}
      try{return await waiter;}catch(e){if(attempt>=retries)throw e;const back=Math.min(60000,4000*(2**attempt));STATE.marketScan.backoffMs=back;STATE.marketScan.nextRetryAt=Date.now()+back;log(`Marketplace page ${page}: retrying after ${Math.round(back/1000)}s`, 'warn');await sleep(back);}
    }throw new Error(`Marketplace page ${page} retry limit reached`);
  }
  function waitForMarketActivity(page,timeoutMs=16000){return new Promise((resolve,reject)=>{const w={page,resolve,reject,timer:null};w.timer=setTimeout(()=>{const i=STATE.marketActivityWaiters.indexOf(w);if(i>=0)STATE.marketActivityWaiters.splice(i,1);reject(new Error(`Marketplace sales page ${page} response timeout`));},timeoutMs);STATE.marketActivityWaiters.push(w);});}
  async function requestMarketActivityPage(page){for(let attempt=0;attempt<5;attempt++){const cooldown=marketCooldownRemaining();if(cooldown)await sleep(cooldown+150);const waiter=waitForMarketActivity(page),st=marketProtocolStatus('GET_ACTIVITY_LOG',{page,categories:['marketplace_equipment'],source:'marketplace'},`market-sales-${page}`,650);if(st.ok){try{return await waiter;}catch(e){if(attempt===4)throw e;}}else{const idx=STATE.marketActivityWaiters.findIndex(w=>w.page===page);if(idx>=0){const[w]=STATE.marketActivityWaiters.splice(idx,1);clearTimeout(w.timer);}if(st.reason==='socket')throw new Error('Marketplace socket closed');}await sleep(Math.min(30000,2500*(2**attempt)));}throw new Error('Marketplace sales history retry limit reached');}
  async function scanMarketplaceSalesHistory(force=false){const now=Date.now();if(!STATE.settings.marketplace.useCompletedSales)return false;if(!force&&STATE.marketLastSalesScanAt&&now-STATE.marketLastSalesScanAt<30*60000)return false;try{let page=1,pages=1;while(page<=pages&&page<=25&&!STATE.stopRequested){const p=await requestMarketActivityPage(page);pages=Math.max(1,Number(p.total_pages)||1);page++;await sleep(700);}STATE.marketLastSalesScanAt=Date.now();log(`Marketplace: completed-sale history refreshed (${Math.min(pages,25)} page(s))`);return true;}catch(e){log(`Marketplace sales history refresh paused: ${e.message}`,'warn');return false;}}
  async function scanEquipmentMarketplace(force=false){
    const cfg=STATE.settings.marketplace,now=Date.now(),interval=Math.max(1,Number(cfg.scanIntervalMinutes)||10)*60000;
    if(STATE.marketScan.active)return false;if(!force&&STATE.marketScan.nextRetryAt&&now<STATE.marketScan.nextRetryAt)return false;if(!force&&STATE.marketScan.lastCompletedAt&&now-STATE.marketScan.lastCompletedAt<interval)return false;
    const resuming=Boolean(STATE.marketScan.resumePage>1&&Number(STATE.marketScan.lastStartedAt||0)>Number(STATE.marketScan.lastCompletedAt||0)&&Number(STATE.marketScan.total||0)>0);let page=resuming?STATE.marketScan.resumePage:1,pages=resuming?Math.max(1,STATE.marketScan.pages):1,total=resuming?STATE.marketScan.total:0,listings=resuming?STATE.marketScan.listings:0,maxRequired=null;
    if(!resuming)STATE.marketRecentListings.clear();STATE.marketScan={...STATE.marketScan,active:true,scanId:resuming?STATE.marketScan.scanId:`scan-${now}`,page,pages,total,listings,resumePage:page,lastStartedAt:resuming?STATE.marketScan.lastStartedAt:now,lastError:null,nextRetryAt:0};emitStatus();
    try{let processed=0;const pageBudget=STATE.settings.masterEnabled?8:250;while(page<=pages&&page<=250&&!STATE.stopRequested&&processed<pageBudget){if(processed>0&&globalThis.IHS2?.MarketGoverned?.shouldYield?.(globalThis.IHS2?.governor?.snapshot?.()||{},10)){log(`Marketplace scan yielding at page ${page} to higher-priority automation`);break;}processed++;STATE.marketScan.page=page;STATE.marketScan.resumePage=page;emitStatus();let p;try{p=await requestMarketPage(page,{mineOnly:false,pageSize:100,sort:'level_desc',maxRequired});}catch(e){if(page===1&&maxRequired===null&&/timeout|accepted|query/i.test(e.message)){const fallback=Math.max(1,Number(liveCurrentPlayer()?.hack_level)||1);log(`Marketplace unrestricted scan fallback: required Hack Lv ≤ ${fallback}`,'warn');maxRequired=fallback;p=await requestMarketPage(page,{mineOnly:false,pageSize:100,sort:'level_desc',maxRequired});}else throw e;}const batch=Array.isArray(p.listings)?p.listings:[];total=Math.max(0,Number(p.total)||batch.length);pages=Math.max(1,Math.ceil(total/Math.max(1,Number(p.page_size)||100)));listings+=batch.length;STATE.marketScan.total=total;STATE.marketScan.pages=pages;STATE.marketScan.listings=listings;STATE.marketScan.resumePage=page+1;page++;await sleep(Math.max(400,Number(cfg.pageDelayMs)||550));}
      if(page>pages||page>250){STATE.marketScan.lastCompletedAt=Date.now();STATE.marketScan.resumePage=1;STATE.marketScan.backoffMs=0;STATE.marketScan.nextRetryAt=0;log(`Marketplace history scan complete: ${listings}/${total} active equipment listings across ${Math.min(pages,250)} page(s)`);await scanMarketplaceSalesHistory(force);return true;}return false;
    }catch(e){const back=Math.min(120000,Math.max(5000,(Number(STATE.marketScan.backoffMs)||4000)*2));STATE.marketScan.backoffMs=back;STATE.marketScan.nextRetryAt=Date.now()+back;STATE.marketScan.lastError=e.message;log(`Marketplace scan paused at page ${STATE.marketScan.resumePage}/${pages}; resumes in ${Math.round(back/1000)}s: ${e.message}`,'warn');return false;}finally{STATE.marketScan.active=false;emitStatus();}
  }

  function requestExtension(type,payload={},timeoutMs=10000){return new Promise((resolve,reject)=>{const id=`ext-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`,timer=setTimeout(()=>{STATE.extensionRequests.delete(id);reject(new Error(`${type} timeout`));},timeoutMs);STATE.extensionRequests.set(id,{resolve,reject,timer});emit(type,payload,id);});}
  function percentileLocal(values,p=.5){const a=values.map(Number).filter(x=>Number.isFinite(x)&&x>0).sort((a,b)=>a-b);if(!a.length)return NaN;const i=(a.length-1)*p,l=Math.floor(i),h=Math.ceil(i);return l===h?a[l]:a[l]+(a[h]-a[l])*(i-l);}
  function liveMarketRecommendation(item,excludeListingId=''){
    const target=marketDescriptor(item);if(!target)return null;const tk=marketKeys(target),me=String(liveCurrentPlayer()?.username||'').toLowerCase(),groups={exact:[],tier:[],set:[],base:[]};
    for(const l of STATE.marketRecentListings.values()){if(String(l?.id)===String(excludeListingId))continue;if(me&&String(l?.seller_username||l?.username||'').toLowerCase()===me)continue;const d=marketDescriptor(l?.item),c=Number(l?.price_cents)/100;if(!d||!Number.isFinite(c)||c<=0)continue;const k=marketKeys(d);if(k.exact===tk.exact)groups.exact.push(c);else if(k.tier===tk.tier)groups.tier.push(c);else if(k.set===tk.set)groups.set.push(c);else if(k.base===tk.base)groups.base.push(c);}
    for(const [kind,min] of [['exact',1],['tier',2],['set',3],['base',8]]){const a=groups[kind];if(a.length>=min)return{source:'live',kind,samples:a.length,lowest:Math.min(...a),p20:percentileLocal(a,.2),median:percentileLocal(a,.5),p75:percentileLocal(a,.75)};}return null;
  }
  async function marketPriceForItem(item,excludeListingId=''){
    const desc=marketDescriptor(item),keys=marketKeys(desc);if(!desc)return null;let hist=null;try{const r=await requestExtension('MARKET_HISTORY_QUERY',{keys,minSamples:Number(STATE.settings.marketplace.minComparableSamples)||3},15000);hist=r?.result||null;}catch(e){log(`Marketplace pricing history unavailable: ${e.message}`,'warn');}
    const live=liveMarketRecommendation(item,excludeListingId),cfg=STATE.settings.marketplace,mode=String(cfg.pricingMode||'fast');let anchor=NaN,source='',samples=0,kind='';
    // Completed fills are highest-quality evidence; live exact competition is highest-quality listing evidence.
    if(hist?.source==='sold'&&Number.isFinite(Number(hist.price))){anchor=mode==='fast'?Number(hist.p25||hist.price):mode==='max'?Number(hist.p75||hist.price):Number(hist.price);source='sold';samples=Number(hist.samples)||0;kind=hist.kind;}
    if(live){let lp=mode==='fast'?Number(live.lowest):mode==='max'?Number(live.p75||live.median):Number(live.p20||live.median);if(Number.isFinite(lp)&&lp>0){if(!Number.isFinite(anchor)||live.kind==='exact'||mode==='fast')anchor=Math.min(Number.isFinite(anchor)?anchor:lp,lp);source=source?`${source}+live`:'live';samples=Math.max(samples,live.samples);kind=live.kind;}}
    if(!Number.isFinite(anchor)&&hist?.source==='ask'&&Number(hist.samples)>=Math.max(3,Number(cfg.minComparableSamples)||3)){anchor=Number(mode==='fast'?hist.p25||hist.price:mode==='max'?hist.p75||hist.price:hist.price);source='ask-history';samples=Number(hist.samples);kind=hist.kind;}
    if(!Number.isFinite(anchor)||anchor<=0)return null;const under=Math.max(0,Number(cfg.undercutPct)||0)/100,target=Math.max(1,Math.floor(anchor*(1-under)));return{price:target,anchor,source,kind,samples,live,historical:hist};
  }
  function ownedRawInventory(){const d=liveInventoryData();return Array.isArray(d?.items)?d.items:[];}
  function gearSetUsed(itemId){return liveGearSetUsageCount(itemId)>0;}
  function ensureMarketProtectedWinners(){if(Object.keys(STATE.finalKeepSet).length===8)return true;const raw=[...ownedRawInventory()];const eq=liveEquipmentData();if(eq&&typeof eq==='object')raw.push(...Object.values(eq));const f={};for(const slot of SLOT_NAMES){const list=raw.filter(x=>slotFromGameItem(x)===slot).map(x=>({raw:x,score:scoreItem(itemFromGameData(x,false)||{})})).sort((a,b)=>b.score-a.score);if(list[0]){f[slot]=String(list[0].raw.id);STATE.neverDeleteIds.add(String(list[0].raw.id));}}if(Object.keys(f).length===8){STATE.finalKeepSet=f;log('Marketplace: established a read-only protected best-in-slot set');return true;}return false;}
  function safeMarketSurplusRawItems(){if(!ensureMarketProtectedWinners()){log('Marketplace auto-list skipped: could not prove one protected item for all eight slots','warn');return [];}const protectedSet=protectedIds();return ownedRawInventory().filter(item=>{const id=String(item?.id||'');if(!id)return false;return!item.market_listed&&!item.decompile_locked&&!item.signature_id&&!item.signature_name&&!protectedSet.has(id)&&!gearSetUsed(id);});}
  async function autoListSurplusFromHistory(){const cfg=STATE.settings.marketplace;if(!cfg.autoListSurplus||!cfg.confirmLiveTrading)return 0;const free=inventoryFreeSlots(),reserve=Math.max(0,Number(cfg.inventoryReserveSlots)||8),pressure=Number.isFinite(free)&&free<=reserve;const limit=pressure?Math.max(1,Number(cfg.maxListActionsPerPass)||25):Math.max(1,Math.min(Number(cfg.maxListActionsPerPass)||25,Number(cfg.maxTradesPerRun)||3));let actions=0;for(const item of safeMarketSurplusRawItems()){if(actions>=limit||STATE.stopRequested)break;const rec=await marketPriceForItem(item);if(!rec?.price){log(`Marketplace: no defensible comp for ${item.name||item.id}; leaving unlisted`);continue;}const st=marketProtocolStatus('MARKET_EQUIP_LIST',{item_id:String(item.id),price:Math.max(1,Math.floor(rec.price))},`list-${item.id}`,900);if(st.ok){STATE.sessionTouchedIds.add(String(item.id));actions++;log(`Marketplace: listed ${item.name||item.id} at ${Math.floor(rec.price).toLocaleString()} credits (${rec.source}/${rec.kind}, n=${rec.samples}${pressure?', inventory pressure':''})`);await sleep(1050);}else if(st.reason==='rate-limit'){await sleep(Math.max(3500,Number(st.retryMs)||3500));}else if(st.reason==='socket')break;}return actions;}
  async function scanMyListings(){let page=1,pages=1,out=[];while(page<=pages&&page<=50&&!STATE.stopRequested){const p=await requestMarketPage(page,{mineOnly:true,pageSize:100,sort:'updated_desc'});out.push(...(Array.isArray(p.listings)?p.listings:[]));pages=Math.max(1,Math.ceil((Number(p.total)||out.length)/Math.max(1,Number(p.page_size)||100)));page++;await sleep(Math.max(450,Number(STATE.settings.marketplace.pageDelayMs)||550));}STATE.marketOwnedListings=out;return out;}
  async function autoRepriceOwnedListings(){const cfg=STATE.settings.marketplace;if(!cfg.autoReprice||!cfg.confirmLiveTrading)return 0;const listings=await scanMyListings();let actions=0;for(const listing of listings){if(actions>=Number(cfg.maxTradesPerRun||3)||STATE.stopRequested)break;const rec=await marketPriceForItem(listing.item,listing.id),current=Number(listing.price_cents)/100;if(!rec?.price||!Number.isFinite(current)||current<=0)continue;const target=Math.max(1,Math.floor(rec.price)),delta=Math.abs(target/current-1)*100;if(delta<Number(cfg.repriceThresholdPct||10))continue;const st=marketProtocolStatus('MARKET_EQUIP_UPDATE_PRICE',{listing_id:String(listing.id),price:target},`reprice-${listing.id}`,900);if(st.ok){actions++;log(`Marketplace: repriced ${listing.item?.name||listing.item_id} ${Math.round(current).toLocaleString()} → ${target.toLocaleString()} (${rec.source}/${rec.kind})`);await sleep(1050);}}return actions;}
  async function runArbitrage(){
    const cfg=STATE.settings.marketplace;if(!cfg.autoArbitrage||!cfg.confirmLiveTrading||!(Number(cfg.maxCreditsPerTrade)>0))return 0;
    const reserve=Math.max(0,Number(cfg.inventoryReserveSlots)||8),me=String(liveCurrentPlayer()?.username||'').toLowerCase();
    if(inventoryFreeSlots()<=reserve){log(`Arbitrage paused: inventory reserve (${reserve}) would be breached`,'warn');return 0;}
    // Price the cheapest plausible candidates first, then buy the BEST projected margins rather than first-match wins.
    const candidates=[...STATE.marketRecentListings.values()].filter(l=>{
      if(!l?.id||STATE.marketPurchasedListingIds.has(String(l.id)))return false;
      if(me&&String(l.seller_username||l.seller_name||l.username||'').toLowerCase()===me)return false;
      const ask=Number(l.price_cents)/100;return Number.isFinite(ask)&&ask>0&&ask<=Number(cfg.maxCreditsPerTrade);
    }).sort((a,b)=>Number(a.price_cents)-Number(b.price_cents)).slice(0,200);
    const opportunities=[];
    for(const listing of candidates){
      if(STATE.stopRequested)break;const ask=Number(listing.price_cents)/100,rec=await marketPriceForItem(listing.item,listing.id);if(!rec?.price)continue;
      const conservative=Number(rec.price)*(1-Math.max(0,Number(cfg.arbitrageSafetyPct)||10)/100),profitPct=(conservative/ask-1)*100,absolute=conservative-ask;
      if(profitPct>=Number(cfg.minProfitPct||20))opportunities.push({listing,ask,rec,conservative,profitPct,absolute});
      if(opportunities.length>=Math.max(12,Number(cfg.maxTradesPerRun||3)*6))break;
    }
    opportunities.sort((a,b)=>b.profitPct-a.profitPct||b.absolute-a.absolute);
    let actions=0;
    for(const o of opportunities){
      if(actions>=Number(cfg.maxTradesPerRun||3)||STATE.stopRequested||inventoryFreeSlots()<=reserve)break;
      const l=o.listing,st=marketProtocolStatus('MARKET_EQUIP_BUY',{listing_id:String(l.id),displayed_price_cents:Number(l.price_cents)},`buy-${l.id}`,1200);STATE.marketPurchasedListingIds.add(String(l.id));
      if(st.ok){actions++;log(`Arbitrage: BUY ${l.item?.name||l.item_id} at ${Math.round(o.ask).toLocaleString()} vs conservative ${Math.round(o.conservative).toLocaleString()} (${o.profitPct.toFixed(1)}% projected, ranked opportunity)`);await sleep(1400);completeSnapshot();}
      else if(st.reason==='rate-limit')await sleep(Math.max(3500,Number(st.retryMs)||3500));
    }
    return actions;
  }
  function extensionSlotPresent(item){
    return Boolean(item?.extension_slot || item?.extension_slot_id || item?.extension || item?.plugin || item?.installed_plugin || (Array.isArray(item?.plugins)&&item.plugins.length));
  }
  function listingMatchesCleanupRule(listing,cfg){
    const item=listing?.item||{}, slot=slotFromGameItem(item)||String(item?.base_type||''), rarity=String(item?.rarity||'');
    if(cfg.cleanupSlot && cfg.cleanupSlot!=='Any' && slot!==cfg.cleanupSlot)return false;
    if(cfg.cleanupRarity && cfg.cleanupRarity!=='Any' && rarity.toLowerCase()!==String(cfg.cleanupRarity).toLowerCase())return false;
    const q=String(cfg.cleanupSearch||'').trim().toLowerCase();
    if(q){
      const hay=[item?.name,item?.base_type,item?.rarity,item?.signature_name,item?.signature_id,...rawAffixes(item).flatMap(x=>[x.affix?.affix_id,...(x.affix?.effects||[]).map(e=>e?.resource)])].filter(Boolean).join(' ').toLowerCase();
      const terms=q.split(',').map(x=>x.trim()).filter(Boolean).filter(x=>!/^ilvl\s*:/i.test(x));
      if(terms.some(t=>!hay.includes(t)))return false;
      for(const term of q.split(',').map(x=>x.trim())){const m=term.match(/^ilvl\s*:\s*([<>]=?)\s*(\d+)$/i);if(!m)continue;const v=Number(item?.item_level)||0,n=Number(m[2]);if(m[1]==='>'&&!(v>n))return false;if(m[1]==='>='&&!(v>=n))return false;if(m[1]==='<'&&!(v<n))return false;if(m[1]==='<='&&!(v<=n))return false;}
    }
    return true;
  }
  function nativeMarketplaceListingsPanel(){
    const mass=clickables().find(b=>/^MASS\s+DELIST\s*\+\s*DECOMPILE$/i.test(norm(b.value||textOf(b))));
    if(!mass)return null;let n=mass.parentElement;for(let i=0;i<8&&n;i++,n=n.parentElement){const t=upper(textOf(n));if(t.includes('MY EQUIPMENT LISTINGS')&&t.includes('MASS DELIST'))return n;}return mass.parentElement||document.body;
  }
  function nativeCheckboxByText(container,re){
    for(const cb of container.querySelectorAll('input[type=checkbox]')){const t=norm(cb.closest('label')?.innerText||cb.parentElement?.innerText||'');if(re.test(t))return cb;}return null;
  }
  function dispatchInput(el){el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
  async function setNativeSelectByLabel(container,labelRe,value){
    if(!value||value==='Any')return true;
    for(const sel of container.querySelectorAll('select')){const near=norm(sel.closest('label')?.innerText||sel.parentElement?.innerText||'');if(labelRe.test(near)&&await setSelectByText(sel,value))return true;}return false;
  }
  async function configureNativeCleanupFilters(panel,cfg){
    const reset=clickables(panel).find(b=>/^RESET$/i.test(norm(b.value||textOf(b))));if(reset){reset.click();await sleep(180);}
    if(cfg.cleanupMode==='all')return true;
    const search=[...panel.querySelectorAll('input[type=text],input[type=search]')].find(x=>/search my equipment listings/i.test(String(x.placeholder||'')));
    if(search){search.value=String(cfg.cleanupSearch||'');dispatchInput(search);}else if(cfg.cleanupSearch)throw new Error('Native My Listings search field not found');
    if(cfg.cleanupSlot&&cfg.cleanupSlot!=='Any'&&!await setNativeSelectByLabel(panel,/\bslot\b/i,cfg.cleanupSlot))throw new Error(`Native My Listings slot filter not found (${cfg.cleanupSlot})`);
    if(cfg.cleanupRarity&&cfg.cleanupRarity!=='Any'&&!await setNativeSelectByLabel(panel,/\brarity\b/i,cfg.cleanupRarity))throw new Error(`Native My Listings rarity filter not found (${cfg.cleanupRarity})`);
    await sleep(300);return true;
  }
  function dangerousCleanupMatches(listings,cfg){
    const scoped=(cfg.cleanupMode==='all'?listings:listings.filter(l=>listingMatchesCleanupRule(l,cfg)));return scoped.filter(l=>{const item=l?.item||{};return(!cfg.cleanupIncludeSignatures&&Boolean(item.signature_id||item.signature_name))||(!cfg.cleanupIncludeExtensionSlots&&extensionSlotPresent(item));});
  }
  async function setNativeAutoDecompileExpired(enabled){
    await openMenu('MARKETPLACE');await sleep(200);const my=findButtonExact(['MY LISTINGS']);if(my){my.click();await sleep(350);}const panel=nativeMarketplaceListingsPanel();if(!panel)return false;
    const cb=nativeCheckboxByText(panel,/auto decompile expired listings/i);if(!cb)return false;if(Boolean(cb.checked)!==Boolean(enabled)){cb.click();await sleep(120);}return Boolean(cb.checked)===Boolean(enabled);
  }
  async function runMarketplaceCleanup(force=false){
    const cfg=STATE.settings.marketplace,st=STATE.marketCleanup,now=Date.now(),interval=Math.max(1,Number(cfg.cleanupIntervalMinutes)||60)*60000;
    if(st.running)return 0;if(!cfg.cleanupEnabled&&!force)return 0;if(!force&&st.lastRunAt&&now-st.lastRunAt<interval)return 0;
    st.running=true;st.lastError=null;emitStatus();
    try{
      if(cfg.cleanupAutoExpired){const ok=await setNativeAutoDecompileExpired(true);if(!ok)log('Marketplace cleanup: native Auto Decompile Expired Listings control was not found','warn');}
      if(String(cfg.cleanupMode||'expired')==='expired'){st.lastRunAt=Date.now();st.lastResult='expired-listing automation armed';log('Marketplace cleanup: native expired-listing auto-decompile is armed');return 0;}
      if(!cfg.confirmLiveTrading)throw new Error('Live trading must be confirmed before destructive marketplace cleanup');
      const listings=await scanMyListings();const scoped=cfg.cleanupMode==='all'?listings:listings.filter(l=>listingMatchesCleanupRule(l,cfg));st.lastCandidates=scoped.length;
      if(!scoped.length){st.lastRunAt=Date.now();st.lastResult='no matching listings';log('Marketplace cleanup: no listings match the cleanup scope');return 0;}
      const dangerous=dangerousCleanupMatches(listings,cfg);if(dangerous.length)throw new Error(`${dangerous.length} scoped listing(s) contain protected Signature/Extension content; enable the matching include option or narrow the filter`);
      if(cfg.cleanupDryRun){st.lastRunAt=Date.now();st.lastResult=`dry-run: ${scoped.length} candidate(s)`;log(`Marketplace cleanup dry run: ${scoped.length} listing(s) would be delisted + decompiled`);return scoped.length;}
      await openMenu('MARKETPLACE');await sleep(250);const my=findButtonExact(['MY LISTINGS']);if(my){my.click();await sleep(450);}const panel=nativeMarketplaceListingsPanel();if(!panel)throw new Error('Native MASS DELIST + DECOMPILE control not found');await configureNativeCleanupFilters(panel,cfg);
      const mass=clickables(panel).find(b=>/^MASS\s+DELIST\s*\+\s*DECOMPILE$/i.test(norm(b.value||textOf(b))));if(!mass)throw new Error('Native MASS DELIST + DECOMPILE button unavailable');mass.click();await sleep(300);
      // Prefer the game's own modal options. Never opt into Signature/Extension destruction unless explicitly configured.
      const modals=[...document.querySelectorAll('[role=dialog],dialog,.modal,.modal-content')].filter(visible);const modal=modals.find(x=>/DELIST/i.test(upper(textOf(x)))&&/DECOMPILE/i.test(upper(textOf(x))))||modals.at(-1)||document.body;
      for(const cb of modal.querySelectorAll('input[type=checkbox]')){const t=norm(cb.closest('label')?.innerText||cb.parentElement?.innerText||'');if(/signature/i.test(t)&&Boolean(cb.checked)!==Boolean(cfg.cleanupIncludeSignatures))cb.click();if(/extension|plugin/i.test(t)&&Boolean(cb.checked)!==Boolean(cfg.cleanupIncludeExtensionSlots))cb.click();}
      const confirm=clickables(modal).find(b=>{const t=upper(b.value||textOf(b));return /^(CONFIRM\s+)?(MASS\s+)?DELIST.*DECOMPILE$/.test(t)||/^CONFIRM$/.test(t);});if(!confirm)throw new Error('Cleanup confirmation dialog was not recognized; no destructive confirmation was clicked');confirm.click();
      await sleep(1800);const after=await scanMyListings();const removed=Math.max(0,listings.length-after.length);st.lastRunAt=Date.now();st.lastResult=`requested ${scoped.length}; ${removed} listing(s) no longer active`;log(`Marketplace cleanup: native delist + decompile requested for ${scoped.length} listing(s); active listings decreased by ${removed}`);completeSnapshot();return removed;
    }catch(e){st.lastError=e.message;st.lastResult='failed';log(`Marketplace cleanup: ${e.message}`,'warn');return 0;}finally{st.running=false;emitStatus();}
  }
  async function runMarketplace(forceScan=false){const cfg=STATE.settings.marketplace;if(!cfg.enabled)return;if(!STATE.gameWs||STATE.gameWs.readyState!==WebSocket.OPEN){log('Marketplace: authenticated game WebSocket is not available','warn');return;}completeSnapshot();if(cfg.scanAllEquipment!==false)await scanEquipmentMarketplace(Boolean(forceScan));if(cfg.cleanupEnabled)await runMarketplaceCleanup(false);const destructiveCleanup=Boolean(cfg.cleanupEnabled&&!cfg.cleanupDryRun&&String(cfg.cleanupMode||'expired')!=='expired');if(destructiveCleanup){log('Marketplace: listing/reprice/arbitrage mutations suppressed this pass because destructive cleanup is armed');STATE.lastRuns.marketplace=Date.now();return;}if(cfg.autoReprice)await autoRepriceOwnedListings();if(cfg.autoListSurplus)await autoListSurplusFromHistory();if(cfg.autoArbitrage)await runArbitrage();STATE.lastRuns.marketplace=Date.now();}

  function buildAuditSnapshot() {
    return {
      schema:'idle-hacking-suite-audit-v5',generatedAt:new Date().toISOString(),url:location.origin+location.pathname+location.hash,
      status:status(),logs:STATE.logs.slice(-250),lastRuns:{...STATE.lastRuns},
      governor:globalThis.IHS2?.governor?.snapshot?.()||null,
      combat:{metrics:STATE.combatMetrics||null,adaptiveWeights:STATE.adaptiveWeights||null,recentEvents:STATE.combatEvents.slice(-25),optimizerOutcome:STATE.optimizerOutcome||null,optimizerEvidenceBaseline:STATE.optimizerEvidenceBaseline||null},
      enhancementBudget:STATE.enhanceBudgetLedger?{startingResources:{...(STATE.enhanceBudgetLedger.startingResources||{})},passSpent:{...(STATE.enhanceBudgetLedger.passSpent||{})},hourEvents:(STATE.enhanceBudgetLedger.hourEvents||[]).slice(-40),rerolls:{...(STATE.enhanceBudgetLedger.rerolls||{})}}:null,
      economy:{recommendation:STATE.economyRecommendation||null,hardwareLoaded:Boolean(liveHardwareInfo()),homelabLoaded:Boolean(liveHomelabInfo())},
      resourceStrategy:{mode:STATE.settings.resources?.mode||'bottleneck_balancer',status:STATE.resourceStrategyStatus||null,directStoreAutomation:false},
      websocket:{sequence:STATE.wsSeq,outboundTypes:[...STATE.wsOutboundTypes],inboundTypes:[...STATE.wsInboundTypes],lastRateLimitAt:STATE.lastRateLimitAt,retryAfterMs:STATE.retryAfterMs,lastServerError:STATE.lastServerError?{...STATE.lastServerError}:null,socketOpen:Boolean(STATE.gameWs&&STATE.gameWs.readyState===WebSocket.OPEN)},
      resources:safeResourceSnapshot(),
      actions:{trace:STATE.actionTrace.slice(-100),optimizerPlan:STATE.optimizerPlan.slice(-16),optimizerResult:STATE.optimizerResult.slice(-16),enhancePlan:STATE.enhancePlan.slice(-50),enhanceResult:STATE.enhanceResult.slice(-50)},
      inventory:{count:STATE.inventory.length,capacity:inventoryCapacity(),freeSlots:inventoryFreeSlots(),equippedCount:Object.keys(STATE.equipped).length,protectedCount:protectedIds().size,signatureCount:STATE.signatureIds.size,purgeEnabled:STATE.purgeEnabled},
      marketplace:{scan:{...STATE.marketScan},cleanup:{...STATE.marketCleanup},ownedListings:STATE.marketOwnedListings.length,recentListings:STATE.marketRecentListings.size,lastSalesScanAt:STATE.marketLastSalesScanAt,settings:{...STATE.settings.marketplace,confirmLiveTrading:Boolean(STATE.settings.marketplace.confirmLiveTrading)}},
      breach:{lastAction:STATE.breachLastAction,hasState:Boolean(STATE.breachState),publicLobbyCount:STATE.breachPublicLobbies.length,settings:{...STATE.settings.breach},sessionId:STATE.breachState?.session_id||'',status:STATE.breachState?.status||'idle',preferredClass:breachPreferredClassId(),lastTalentAction:STATE.breachLastTalentAction},
      contracts:{lastAction:STATE.contractLastAction,state:STATE.contractsState?{active_contract_id:STATE.contractsState.active_contract_id||'',board_key:STATE.contractsState.board_key||'',contracts:(STATE.contractsState.contracts||[]).map(c=>({id:c.id,name:c.name,type:c.type,duration:c.duration,progress:c.progress,target:c.target,completed:c.completed,claimed:c.claimed,is_carryover:c.is_carryover,rewards:c.rewards}))}:null,settings:{...STATE.settings.contracts}},
      event:{lastAction:STATE.eventLastAction,status:STATE.eventStatus?{...STATE.eventStatus}:null,participation:STATE.eventParticipation?{...STATE.eventParticipation}:null,lastJoinResult:STATE.eventLastJoinResult,lastError:STATE.eventLastError,settings:{...STATE.settings.events}}
    };
  }

  function chooseBestDraftButton() {
    const choices=clickables().filter(b=>/^(CHOOSE|SELECT|TAKE)\b/i.test(norm(b.value||textOf(b))));
    choices.sort((a,b)=>rewardScore(textOf(closestCard(b)))-rewardScore(textOf(closestCard(a))));
    return choices[0]||null;
  }

  async function runBreach() {
    const cfg=STATE.settings.breach;
    if (!cfg.enabled) { STATE.breachLastAction='disabled'; STATE.lastRuns.breach=Date.now(); return; }
    if (cfg.autopilot) { await runBreachAutopilot(); STATE.lastRuns.breach=Date.now(); return; }
    if (cfg.autoOptIn) {
      const opt=findButtonExact(['OPT-IN TO BREACH TESTING','> BREACH BETA TEST']);
      if (opt) { opt.click(); await sleep(150); await confirmDialog(['OPT-IN','CONFIRM','YES']); log('Breach: opt-in action requested'); }
    }
    await openMenu('NETWORK BREACH'); await sleep(160);
    if (cfg.className && cfg.className!=='auto') {
      const b=findButtonExact([cfg.className]);
      if (b) b.click();
      else for (const s of document.querySelectorAll('select')) if (await setSelectByText(s,cfg.className)) break;
    }
    if (cfg.movement) {
      const b=findButtonExact([cfg.movement]);
      if (b) b.click();
      else for (const s of document.querySelectorAll('select')) if (await setSelectByText(s,cfg.movement)) break;
    }
    if (cfg.autoDraft) {
      const c=chooseBestDraftButton();
      if (c) { c.click(); log('Breach: resolved visible upgrade draft'); }
    }
    if (cfg.autoUpgrade) {
      // Do not blindly click generic UPGRADE controls. Current HAR showed repeated
      // BREACH_INSUFFICIENT_SHARDS from this legacy DOM path. Verified Breach
      // progression actions are handled by the state-aware autopilot instead.
      log('Breach: generic DOM auto-upgrade suppressed; use Breach autopilot for verified upgrades');
    }
    const ready=findButtonExact(['READY','READY UP','START RUN','START']);
    if (ready) { ready.click(); log('Breach: readied current lobby/run'); }
    STATE.lastRuns.breach=Date.now();
  }

  async function autoEnhanceIfDue(){
    const cfg=STATE.settings.enhance;
    if(!cfg?.enabled||STATE.stopRequested)return false;
    if(Date.now()-Number(STATE.lastRuns.enhance||0)<30*60*1000)return false;
    await runEnhancement(true);
    return true;
  }

  async function runEnabledPass() {
    if (STATE.runningEngine || STATE.stopRequested) return;
    STATE.runningEngine='automation';
    try {
      await runContracts();
      await runEvents();
      await runResources();
      await runBreach();
      await autoEnhanceIfDue();
      await runShopHomelab();
      await runMarketplace();
      STATE.lastRuns.automation=Date.now();
    } catch(e) { log(`Automation pass: ${e.message}`,'warn'); }
    finally { STATE.runningEngine=null; emitStatus(); }
  }

  async function runBreachLoopOnly() {
    if (STATE.runningEngine || STATE.stopRequested) return;
    STATE.runningEngine='breach-autopilot';
    try { await runBreach(); await autoEnhanceIfDue(); }
    catch(e) { log(`Breach autopilot pass: ${e.message}`,'warn'); }
    finally { STATE.runningEngine=null; emitStatus(); }
  }

  function runBackgroundMaintenance(maintenance) {
    if(STATE.maintenanceRunning)return;
    STATE.maintenanceRunning=true;
    Promise.resolve().then(async()=>{
      if(maintenance.contracts)await runContracts();
      if(maintenance.events)await runEvents();
    }).catch(e=>log(`Contracts/Events background maintenance: ${e.message}`,'warn'))
      .finally(()=>{STATE.maintenanceRunning=false;emitStatus();});
  }
  function restartLoop() {
    if (STATE.loopHandle) clearInterval(STATE.loopHandle);
    STATE.loopHandle=null;
    const breachOnly=Boolean(STATE.settings.breach?.enabled && STATE.settings.breach?.autopilot);
    const enhanceOnly=Boolean(STATE.settings.enhance?.enabled);
    const marketOnly=Boolean(STATE.settings.marketplace?.enabled && STATE.settings.marketplace?.continuousScan);
    const maintenance=globalThis.IHS2?.planMaintenance?.(STATE.settings)||{contracts:false,events:false};
    if (!STATE.settings.masterEnabled && !breachOnly && !marketOnly && !enhanceOnly && !maintenance.contracts && !maintenance.events) return;
    const interval=Math.max(3000,Number(STATE.settings.masterIntervalMs)||15000);
    const tick=()=>{
      if (STATE.settings.masterEnabled) return runEnabledPass();
      const current=globalThis.IHS2?.planMaintenance?.(STATE.settings)||{contracts:false,events:false};
      if(current.contracts||current.events)runBackgroundMaintenance(current);
      if (breachOnly) return runBreachLoopOnly();
      if (enhanceOnly && !STATE.runningEngine && Date.now()-Number(STATE.lastRuns.enhance||0)>=30*60*1000){return runEnhancement(false).catch(e=>log(`Enhancement background pass: ${e.message}`,'warn'));}
      if (marketOnly && !STATE.runningEngine) { STATE.runningEngine='market-history'; return runMarketplace(false).catch(e=>log(`Marketplace background pass: ${e.message}`,'warn')).finally(()=>{STATE.runningEngine=null;emitStatus();}); }
    };
    STATE.loopHandle=setInterval(tick,interval);
    setTimeout(tick,500);
  }

  async function command(type, requestId) {
    try {
      switch(type) {
        case 'RUN_ALL':
          STATE.stopRequested=false;
          await runEnabledPass();
          break;
        case 'STOP_ALL':
          STATE.stopRequested=true;
          STATE.enhanceStatus='stopped';
          log('Stop requested; no new mutation will start');
          break;
        case 'RUN_CONTRACTS':
          await runContracts();
          break;
        case 'RUN_OPTIMIZER':
          await runOptimizer();
          break;
        case 'RUN_ENHANCEMENT':
          await runEnhancement(false);
          break;
        case 'STOP_ENHANCEMENT':
          STATE.stopRequested=true; STATE.enhanceStatus='stopped'; log('[ENHANCE] stop requested');
          break;
        case 'RUN_BREACH':
          if (STATE.runningEngine) throw new Error(`Busy: ${STATE.runningEngine}`);
          STATE.runningEngine='breach'; STATE.stopRequested=false; await runBreach(); STATE.runningEngine=null;
          break;
        case 'RUN_MARKET':
          if (STATE.runningEngine) throw new Error(`Busy: ${STATE.runningEngine}`);
          STATE.runningEngine='marketplace'; STATE.stopRequested=false; await runMarketplace(true); STATE.runningEngine=null;
          break;
        case 'RUN_MARKET_CLEANUP':
          if (STATE.runningEngine) throw new Error(`Busy: ${STATE.runningEngine}`);
          STATE.runningEngine='market-cleanup'; STATE.stopRequested=false; await runMarketplaceCleanup(true); STATE.runningEngine=null;
          break;
        case 'GET_AUDIT':
          result(requestId,true,{audit:buildAuditSnapshot()}); return;
        default: throw new Error(`Unknown command ${type}`);
      }
      result(requestId,true,{status:status()});
    } catch(e) {
      STATE.runningEngine=null;
      log(`${type} failed: ${e.message}`,'error');
      result(requestId,false,{error:e.message,status:status()});
    }
  }

  window.addEventListener('message', event => {
    if (event.source !== window) return;
    const m=event.data;
    if (!m || m.source!==SOURCE || m.channel!=='EXTENSION_TO_PAGE') return;
    if (m.type==='MARKET_HISTORY_RESULT' && m.requestId && STATE.extensionRequests.has(m.requestId)) {
      const p=STATE.extensionRequests.get(m.requestId); STATE.extensionRequests.delete(m.requestId); clearTimeout(p.timer); p.resolve(m.payload||{}); return;
    }
    if (m.type==='SETTINGS_UPDATED') {
      STATE.settings=merge(DEFAULTS,m.payload?.settings||{});
      if(STATE.settings.breach.autopilot)STATE.settings.breach.enabled=true;
      restartLoop();
      log('Settings synchronized');
      result(m.requestId,true,{status:status()});
      return;
    }
    command(m.type,m.requestId);
  });

  document.addEventListener('DOMContentLoaded', () => {
    completeSnapshot();
    emitStatus();
  }, {once:true});

  setInterval(() => {
    try { completeSnapshot(); emitStatus(); } catch {}
  }, 5000);

  log('MAIN-world bridge initialized; WebSocket observation active');
  emit('BRIDGE_READY',{status:status()});
})();
