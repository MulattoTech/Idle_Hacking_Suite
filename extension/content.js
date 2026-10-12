'use strict';

(() => {
  if (globalThis.__IHS_CONTENT_LOADED__) return;
  globalThis.__IHS_CONTENT_LOADED__ = true;

  const SOURCE = 'IDLE_HACKING_SUITE';
  const STORAGE_KEY = 'idleHackingSuiteSettings';
  const MARKET_HISTORY_KEY='idleHackingMarketHistoryV3';
  const MARKET_HISTORY_V2_KEY='idleHackingMarketHistoryV2';
  const SETTINGS_SCHEMA_VERSION=11;
  let marketHistoryCache=null;
  let marketWriteChain=Promise.resolve();
  let marketHistoryMeta={observations:0,buckets:0,lastScanAt:0};
  const pending = new Map();
  let cachedStatus = {bridgeReady:false, runningEngine:null, lastLog:'Waiting for page bridge'};
  let hud;

  function requestId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
  }

  function post(type, payload={}, id=null) {
    window.postMessage({
      source: SOURCE,
      channel: 'EXTENSION_TO_PAGE',
      type,
      requestId: id || requestId(),
      payload
    }, '*');
  }

  async function syncSettings() {
    const stored = await chrome.storage.sync.get(STORAGE_KEY);
    const settings=structuredClone(stored[STORAGE_KEY]||{});
    if(Number(settings.settingsSchemaVersion||0)<SETTINGS_SCHEMA_VERSION){
      const b=settings.breach||{};
      if(settings.masterEnabled&&b.autoJoinPublic&&b.autoUpgrade&&b.autoPrestige){b.enabled=true;b.autopilot=true;settings.breach=b;}
      settings.contracts=settings.contracts||{};
      if(settings.contracts.autoSwitch===undefined)settings.contracts.autoSwitch=true;
      if(settings.contracts.switchGainPct===undefined)settings.contracts.switchGainPct=35;
      if(settings.contracts.preferRoleAligned===undefined)settings.contracts.preferRoleAligned=true;
      settings.settingsSchemaVersion=SETTINGS_SCHEMA_VERSION;
      await chrome.storage.sync.set({[STORAGE_KEY]:settings});
    }
    post('SETTINGS_UPDATED', {settings});
  }

  function makeHud() {
    if (hud || !document.documentElement) return;
    const host = document.createElement('div');
    host.id = 'ihs-hud-host';
    host.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:2147483646;font:11px/1.35 ui-monospace,Consolas,monospace;color:#d9e6f2;';
    const shadow = host.attachShadow({mode:'open'});
    shadow.innerHTML = `
      <style>
      .box{width:270px;background:rgba(8,14,20,.94);border:1px solid #2c4051;border-radius:6px;box-shadow:0 8px 28px #0008;overflow:hidden}
      .head{display:flex;align-items:center;justify-content:space-between;padding:6px 8px;background:#101a23;border-bottom:1px solid #2c4051}
      .title{color:#65e59a;font-weight:700}.body{padding:7px}.status{color:#9fb0c1;white-space:pre-wrap;max-height:100px;overflow:auto}
      button{font:inherit;background:#172531;color:#d9e6f2;border:1px solid #344b5f;border-radius:3px;padding:4px 6px;margin:5px 3px 0 0;cursor:pointer}
      button.go{color:#79f3ad;border-color:#2d8f5b}button.stop{color:#ff9c9c;border-color:#8b3c3c}
      .collapsed .body{display:none}
      </style>
      <div class="box">
        <div class="head"><span class="title">Idle Hacking Suite</span><button id="toggle">−</button></div>
        <div class="body">
          <div class="status" id="status">Connecting…</div>
          <button class="go" data-cmd="RUN_OPTIMIZER">Optimize</button>
          <button class="go" data-cmd="RUN_ENHANCEMENT">Enhance</button>
          <button data-cmd="RUN_ALL">Run enabled</button>
          <button class="stop" data-cmd="STOP_ALL">Stop</button>
        </div>
      </div>`;
    shadow.getElementById('toggle').addEventListener('click', () => {
      const box = shadow.querySelector('.box');
      box.classList.toggle('collapsed');
      shadow.getElementById('toggle').textContent = box.classList.contains('collapsed') ? '+' : '−';
    });
    shadow.addEventListener('click', e => {
      const b = e.target.closest('[data-cmd]');
      if (b) post(b.dataset.cmd);
    });
    (document.body || document.documentElement).appendChild(host);
    hud = {host, shadow};
    updateHud();
  }

  function updateHud() {
    if (!hud) return;
    const s = cachedStatus || {};
    hud.shadow.getElementById('status').textContent =
      `${s.bridgeReady ? 'bridge ready' : 'bridge offline'}\n` +
      `engine: ${s.runningEngine || 'idle'}\n` +
      `items: ${s.inventoryCount ?? '?'} · protected: ${s.protectedCount ?? 0}\n` +
      `${s.lastLog || ''}`;
  }

  async function loadMarketHistory() {
    if(marketHistoryCache)return marketHistoryCache;
    const got=await chrome.storage.local.get([MARKET_HISTORY_KEY,MARKET_HISTORY_V2_KEY]);
    let db=got[MARKET_HISTORY_KEY], migrated=false;
    if(!db){
      const old=got[MARKET_HISTORY_V2_KEY];
      db={version:3,createdAt:Date.now(),updatedAt:Number(old?.updatedAt)||0,asks:{observations:Number(old?.observations)||0,lastSeen:old?.lastSeen||{},buckets:old?.buckets||{}},sales:{observations:0,seenIds:{},buckets:{}}}; migrated=true;
    }
    db.version=3;db.asks=db.asks||{observations:0,lastSeen:{},buckets:{}};db.sales=db.sales||{observations:0,seenIds:{},buckets:{}};db.asks.lastSeen=db.asks.lastSeen||{};db.asks.buckets=db.asks.buckets||{};db.sales.seenIds=db.sales.seenIds||{};db.sales.buckets=db.sales.buckets||{};
    marketHistoryCache=db;marketHistoryMeta={observations:(Number(db.asks.observations)||0)+(Number(db.sales.observations)||0),askObservations:Number(db.asks.observations)||0,saleObservations:Number(db.sales.observations)||0,buckets:Object.keys(db.asks.buckets).length+Object.keys(db.sales.buckets).length,lastScanAt:Number(db.updatedAt)||0};if(migrated)await chrome.storage.local.set({[MARKET_HISTORY_KEY]:db});return db;
  }
  function addBucketObservation(buckets,key,price,ts){if(!key||!Number.isFinite(price)||price<=0)return;const b=buckets[key]||{n:0,prices:[],min:price,max:price,lastSeen:ts};b.n=(Number(b.n)||0)+1;b.min=Math.min(Number(b.min)||price,price);b.max=Math.max(Number(b.max)||price,price);b.lastSeen=ts;b.prices=Array.isArray(b.prices)?b.prices:[];b.prices.push(price);if(b.prices.length>96)b.prices.splice(0,b.prices.length-96);buckets[key]=b;}
  async function trimAndStore(db){
    const seen=Object.entries(db.asks.lastSeen);if(seen.length>30000){seen.sort((a,b)=>Number(b[1]?.seen||0)-Number(a[1]?.seen||0));db.asks.lastSeen=Object.fromEntries(seen.slice(0,30000));}
    for(const section of [db.asks,db.sales]){const entries=Object.entries(section.buckets);if(entries.length>18000){entries.sort((a,b)=>Number(b[1]?.lastSeen||0)-Number(a[1]?.lastSeen||0));section.buckets=Object.fromEntries(entries.slice(0,18000));}}
    const ids=Object.entries(db.sales.seenIds);if(ids.length>20000){ids.sort((a,b)=>Number(b[1]||0)-Number(a[1]||0));db.sales.seenIds=Object.fromEntries(ids.slice(0,20000));}
    db.updatedAt=Date.now();marketHistoryMeta={observations:(Number(db.asks.observations)||0)+(Number(db.sales.observations)||0),askObservations:Number(db.asks.observations)||0,saleObservations:Number(db.sales.observations)||0,buckets:Object.keys(db.asks.buckets).length+Object.keys(db.sales.buckets).length,lastScanAt:db.updatedAt};await chrome.storage.local.set({[MARKET_HISTORY_KEY]:db});
  }
  async function persistMarketSamples(samples){const db=await loadMarketHistory(),now=Date.now();for(const s of Array.isArray(samples)?samples:[]){const listingId=String(s?.listingId||''),price=Number(s?.priceCredits);if(!listingId||!Number.isFinite(price)||price<=0)continue;const prev=db.asks.lastSeen[listingId];if(!prev||Number(prev.price)!==price){for(const key of Object.values(s.keys||{}))addBucketObservation(db.asks.buckets,key,price,Number(s.observedAt)||now);db.asks.observations=(Number(db.asks.observations)||0)+1;}db.asks.lastSeen[listingId]={price,seen:Number(s.observedAt)||now,itemId:String(s.itemId||'')};}await trimAndStore(db);}
  async function persistMarketSales(sales){const db=await loadMarketHistory(),now=Date.now();for(const s of Array.isArray(sales)?sales:[]){const id=String(s?.saleId||''),price=Number(s?.priceCredits);if(!id||db.sales.seenIds[id]||!Number.isFinite(price)||price<=0)continue;for(const key of Object.values(s.keys||{}))addBucketObservation(db.sales.buckets,key,price,Number(s.soldAt)||now);db.sales.seenIds[id]=Number(s.soldAt)||now;db.sales.observations=(Number(db.sales.observations)||0)+1;}await trimAndStore(db);}
  function percentile(values,p=.5){const a=(values||[]).map(Number).filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return NaN;const i=(a.length-1)*p,l=Math.floor(i),h=Math.ceil(i);return l===h?a[l]:a[l]+(a[h]-a[l])*(i-l);}
  function recFromBucket(source,kind,b){return{source,kind,samples:Number(b.n)||b.prices.length,price:percentile(b.prices,.5),p25:percentile(b.prices,.25),p75:percentile(b.prices,.75),min:Number(b.min),max:Number(b.max),lastSeen:Number(b.lastSeen)||0};}
  async function marketHistoryRecommendation(keys,minSamples=3){await marketWriteChain;const db=await loadMarketHistory(),order=[['exact',keys?.exact],['tier',keys?.tier],['set',keys?.set],['base',keys?.base]],min=Math.max(1,Number(minSamples)||3);
    // Actual completed sales are allowed to speak with fewer samples than active asks.
    for(const[kind,key]of order){const b=key?db.sales.buckets[key]:null;if(!b||!Array.isArray(b.prices)||!b.prices.length)continue;const r=recFromBucket('sold',kind,b);if(r.samples>=Math.max(1,kind==='exact'?1:Math.min(min,2)))return r;}
    // Asking prices are only evidence of seller intent, not value. Never allow a singleton ask to price automation.
    for(const[kind,key]of order){const b=key?db.asks.buckets[key]:null;if(!b||!Array.isArray(b.prices)||!b.prices.length)continue;const r=recFromBucket('ask',kind,b),need=kind==='exact'?Math.max(2,min):kind==='tier'?Math.max(3,min):kind==='set'?Math.max(5,min):Math.max(10,min);if(r.samples>=need)return r;}
    return null;
  }

  window.addEventListener('message', event => {
    if (event.source !== window) return;
    const m = event.data;
    if (!m || m.source !== SOURCE || m.channel !== 'PAGE_TO_EXTENSION') return;

    if (m.type === 'MARKET_SAMPLES') {
      const samples=m.payload?.samples||[];
      marketWriteChain=marketWriteChain.then(()=>persistMarketSamples(samples)).catch(e=>console.warn('[IHS] market history persist failed',e));
      return;
    }
    if (m.type === 'MARKET_SALES') {
      const sales=m.payload?.sales||[];
      marketWriteChain=marketWriteChain.then(()=>persistMarketSales(sales)).catch(e=>console.warn('[IHS] market sales history persist failed',e));
      return;
    }
    if (m.type === 'MARKET_HISTORY_QUERY') {
      const rid=m.requestId;
      marketHistoryRecommendation(m.payload?.keys||{},m.payload?.minSamples||3).then(rec=>post('MARKET_HISTORY_RESULT',{result:rec},rid)).catch(e=>post('MARKET_HISTORY_RESULT',{result:null,error:e.message},rid));
      return;
    }
    if (m.type === 'BRIDGE_READY') {
      cachedStatus = {...cachedStatus, bridgeReady:true, lastLog:'Bridge ready'};
      updateHud();
      syncSettings();
      return;
    }
    if (m.type === 'STATUS') {
      cachedStatus = {...cachedStatus, ...(m.payload?.status || {})};
      updateHud();
      return;
    }
    if (m.type === 'RESULT' && m.requestId && pending.has(m.requestId)) {
      const cb = pending.get(m.requestId);
      pending.delete(m.requestId);
      cb(m.payload || {ok:true});
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message?.type) return;
    if (message.type === 'GET_STATUS') {
      loadMarketHistory().finally(()=>sendResponse({ok:true, status:{...cachedStatus,marketHistory:marketHistoryMeta}}));
      return true;
    }
    const allowed = new Set([
      'SETTINGS_UPDATED','RUN_ALL','STOP_ALL','RUN_OPTIMIZER','RUN_ENHANCEMENT',
      'STOP_ENHANCEMENT','RUN_BREACH','RUN_MARKET','RUN_MARKET_CLEANUP','GET_AUDIT'
    ]);
    if (!allowed.has(message.type)) {
      sendResponse({ok:false, error:'Unsupported command'});
      return;
    }

    const id = requestId();
    pending.set(id, sendResponse);
    if (message.type === 'SETTINGS_UPDATED') {
      post('SETTINGS_UPDATED', {settings: message.settings || {}}, id);
    } else {
      post(message.type, {}, id);
    }
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        sendResponse({ok:false, error:'Page bridge response timeout'});
      }
    }, ['RUN_OPTIMIZER','RUN_ENHANCEMENT','RUN_BREACH','RUN_MARKET','RUN_MARKET_CLEANUP','RUN_ALL'].includes(message.type) ? 180000 : 20000);
    return true;
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', makeHud, {once:true});
  } else {
    makeHud();
  }
  setTimeout(syncSettings, 100);
})();
