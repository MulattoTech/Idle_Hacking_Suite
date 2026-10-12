(function(root,factory){const out=factory();if(typeof module!=='undefined'&&module.exports)module.exports=out;root.IHS2=root.IHS2||{};Object.assign(root.IHS2,out);})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const DB_NAME='idle-hacking-suite-v2';const DB_VERSION=1;
  const STORES=['metrics_snapshots','combat_events','automation_actions','decision_records','equipment_changes','enhancement_spend','breach_runs','contract_events','event_participation','market_sales','market_asks_summary','economy_purchases','changelog_entries'];
  function round(n,d=2){const p=10**d;return Math.round((Number(n)||0)*p)/p;}
  function rollupCombatEvents(events,windowMs,now=Date.now()){
    const a=(events||[]).filter(e=>Number(e.ts)>=now-windowMs&&Number(e.ts)<=now);
    const legacyHits=a.reduce((s,e)=>s+Number(e.hits||0),0),legacyMisses=a.reduce((s,e)=>s+Number(e.misses||0),0),attempts=a.reduce((s,e)=>s+Number(e.playerAttackAttempts||0),0),hitRounds=a.reduce((s,e)=>s+Number(e.playerHitRounds||0),0),hits=attempts?hitRounds:legacyHits,misses=attempts?Math.max(0,attempts-hitRounds):legacyMisses,fights=a.length,wins=a.filter(e=>e.won===true||e.victory===true).length;
    const survival=a.map(e=>e.survivalRatio).filter(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))).map(Number);
    return {fights,wins,winRate:fights?round(wins/fights*100):0,hits,misses,hitRate:hits+misses?round(hits/(hits+misses)*100):0,avgRounds:fights?round(a.reduce((s,e)=>s+Number(e.rounds||0),0)/fights):0,avgSurvival:survival.length?round(survival.reduce((x,y)=>x+y,0)/survival.length*100):0,xp:round(a.reduce((s,e)=>s+Number(e.xp||0),0)),credits:round(a.reduce((s,e)=>s+Number(e.credits||0),0))};
  }

  function effectivenessScore(r={}){const speed=Math.max(0,Math.min(100,100-Math.max(0,Number(r.avgRounds||0)-5)*3));return round(Number(r.winRate||0)*.35+Number(r.hitRate||0)*.35+Number(r.avgSurvival||0)*.20+speed*.10);}
  function rollupCombatRange(events,start,end){const subset=(events||[]).filter(e=>Number(e.ts)>=start&&Number(e.ts)<=end);const fakeNow=end,window=Math.max(1,end-start);return rollupCombatEvents(subset,window,fakeNow);}
  function buildEffectivenessTrend(events,now=Date.now()){
    const day=86400000,current=rollupCombatRange(events,now-day,now),previous=rollupCombatRange(events,now-2*day,now-day-1);current.score=effectivenessScore(current);previous.score=effectivenessScore(previous);
    return{current,previous,delta:{score:round(current.score-previous.score),winRate:round(current.winRate-previous.winRate),hitRate:round(current.hitRate-previous.hitRate),survival:round(current.avgSurvival-previous.avgSurvival),rounds:round(current.avgRounds-previous.avgRounds)}};
  }
  function openTelemetryDb(){
    if(typeof indexedDB==='undefined')return Promise.reject(new Error('IndexedDB unavailable'));
    return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;for(const name of STORES){if(db.objectStoreNames.contains(name))continue;const store=db.createObjectStore(name,{keyPath:'id',autoIncrement:true});store.createIndex('ts','ts',{unique:false});store.createIndex('kind','kind',{unique:false});}};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  }
  async function addTelemetry(storeName,value){if(!STORES.includes(storeName))throw new Error(`Unknown telemetry store ${storeName}`);const db=await openTelemetryDb();return new Promise((resolve,reject)=>{const tx=db.transaction(storeName,'readwrite');tx.objectStore(storeName).add({...value,ts:Number(value?.ts)||Date.now()});tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{const e=tx.error;db.close();reject(e)};});}
  async function getRecent(storeName,sinceMs=86400000,limit=5000){if(!STORES.includes(storeName))throw new Error(`Unknown telemetry store ${storeName}`);const db=await openTelemetryDb();return new Promise((resolve,reject)=>{const tx=db.transaction(storeName,'readonly');const idx=tx.objectStore(storeName).index('ts');const range=IDBKeyRange.lowerBound(Date.now()-sinceMs);const out=[];idx.openCursor(range,'prev').onsuccess=e=>{const cur=e.target.result;if(cur&&out.length<limit){out.push(cur.value);cur.continue();}else{db.close();resolve(out.reverse());}};tx.onerror=()=>{const er=tx.error;db.close();reject(er)};});}
  async function summary(){const windows={m15:15*60000,h1:3600000,h6:6*3600000,h24:24*3600000,d7:7*86400000};const now=Date.now(),events=await getRecent('combat_events',365*86400000,20000).catch(()=>[]);const out={generatedAt:now,combat:{},effectiveness:buildEffectivenessTrend(events,now),performance:globalThis.IHS2?.Performance?.trends?.(events,120)||null};for(const[k,v]of Object.entries(windows))out.combat[k]=rollupCombatEvents(events,v,now);return out;}
  async function exportTelemetryData(limitPerStore=3000){
    const db=await openTelemetryDb(),output={};
    try{
      for(const name of STORES){
        output[name]=await new Promise((resolve,reject)=>{
          const tx=db.transaction(name,'readonly'),req=tx.objectStore(name).index('ts').openCursor(null,'prev'),rows=[];
          req.onsuccess=()=>{const c=req.result;if(c&&rows.length<limitPerStore){rows.push(c.value);c.continue();}else resolve(rows.reverse());};
          req.onerror=()=>reject(req.error);tx.onerror=()=>reject(tx.error);
        });
      }
    }finally{db.close();}
    return output;
  }
  async function importTelemetryData(input={},mode='merge'){
    const db=await openTelemetryDb(),counts={};
    try{
      for(const name of STORES){
        const incoming=Array.isArray(input[name])?input[name]:[];
        if(!incoming.length&&mode!=='replace')continue;
        if(incoming.length>3000)throw new Error('Too many '+name+' rows in snapshot');
        const existing=mode==='replace'?[]:await new Promise((resolve,reject)=>{
          const t=db.transaction(name,'readonly'),req=t.objectStore(name).getAll();
          req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);
        });
        const fingerprint=obj=>JSON.stringify(Object.fromEntries(Object.entries(obj||{}).filter(([k])=>k!=='id')));
        const seen=new Set(existing.map(fingerprint));
        const cleaned=[];
        for(const row of incoming){
          if(!row||typeof row!=='object'||!Number.isFinite(Number(row.ts)))continue;
          const safe=globalThis.IHS2?.sanitize?.(row)||row;
          delete safe.id;
          const key=fingerprint(safe);
          if(!seen.has(key)){seen.add(key);cleaned.push(safe);}
        }
        await new Promise((resolve,reject)=>{
          const tx=db.transaction(name,'readwrite'),store=tx.objectStore(name);
          if(mode==='replace')store.clear();
          for(const row of cleaned)store.add(row);
          tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);
        });
        counts[name]=cleaned.length;
      }
    }finally{db.close();}
    return counts;
  }
  async function clearTelemetry(){const db=await openTelemetryDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORES,'readwrite');for(const s of STORES)tx.objectStore(s).clear();tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{const e=tx.error;db.close();reject(e)};});}
  return {DB_NAME,DB_VERSION,STORES,rollupCombatEvents,effectivenessScore,buildEffectivenessTrend,openTelemetryDb,addTelemetry,getRecent,summary,exportTelemetryData,importTelemetryData,clearTelemetry};
});
