'use strict';
importScripts('../shared/defaults.js','../shared/math.js','../shared/sanitize.js','migrations.js','telemetry-db.js','../main/engines/changelog.js','changelog-store.js','export.js');
const SETTINGS_KEY='idleHackingSuiteSettings';
const MIGRATION_REPORT_KEY='ihs2MigrationReport';
const CHANGELOG_STATE_KEY='ihs2ChangelogState';
const CHANGELOG_URL='https://www.idlehacking.com/content/changelog';
const CHANGELOG_MIN_REFRESH_MS=15*60*1000;
let lastStatus={bridgeReady:false,updatedAt:0};

async function ensureMigrated(){
  const got=await chrome.storage.sync.get(SETTINGS_KEY);const raw=got[SETTINGS_KEY]||{};
  const {settings,report}=IHS2.migrateSettings(raw);
  if(Number(raw.settingsSchemaVersion||0)<200||report.length){await chrome.storage.sync.set({[SETTINGS_KEY]:settings});await chrome.storage.local.set({[MIGRATION_REPORT_KEY]:{ts:Date.now(),items:report}});}
  return settings;
}

async function getChangelogState(){const got=await chrome.storage.local.get(CHANGELOG_STATE_KEY);return got[CHANGELOG_STATE_KEY]||{entries:[],updatedAt:0,lastAttemptAt:0,lastError:null};}
async function saveChangelogState(state){await chrome.storage.local.set({[CHANGELOG_STATE_KEY]:state});return state;}
async function refreshChangelog(force=false){
  const settings=await ensureMigrated();let state=await getChangelogState(),now=Date.now();
  if(settings.changelog?.enabled===false)return IHS2.ChangelogStore.buildView(state);
  if(!force&&Number(state.lastAttemptAt||0)&&now-Number(state.lastAttemptAt)<CHANGELOG_MIN_REFRESH_MS)return IHS2.ChangelogStore.buildView(state);
  state={...state,lastAttemptAt:now};await saveChangelogState(state);
  try{
    const res=await fetch(CHANGELOG_URL,{cache:'no-store',credentials:'omit'});if(!res.ok)throw new Error(`Changelog HTTP ${res.status}`);
    const html=await res.text(),raw=IHS2.Changelog.extractEntriesFromHtml(html),normalized=IHS2.Changelog.normalizeChangelog(raw),known=new Set((state.entries||[]).map(x=>x.id)),merged=IHS2.ChangelogStore.mergeState(state,normalized,now);
    merged.lastAttemptAt=now;await saveChangelogState(merged);
    for(const row of merged.entries.filter(x=>!known.has(x.id)))await IHS2.addTelemetry('changelog_entries',{...row,kind:'changelog_seen'}).catch(()=>{});
    return IHS2.ChangelogStore.buildView(merged);
  }catch(e){const failed={...state,lastAttemptAt:now,lastError:String(e.message||e)};await saveChangelogState(failed);return IHS2.ChangelogStore.buildView(failed);}
}
async function markChangelogRead(ids=[]){const state=IHS2.ChangelogStore.markRead(await getChangelogState(),ids,Date.now());await saveChangelogState(state);return IHS2.ChangelogStore.buildView(state);}

chrome.runtime.onInstalled.addListener(()=>{ensureMigrated().catch(()=>{});});
chrome.runtime.onStartup.addListener(()=>{ensureMigrated().catch(()=>{});});

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(!message?.type)return;
  (async()=>{
    if(message.type==='IHS2_STATUS'){lastStatus={...IHS2.sanitize(message.payload||{}),updatedAt:Date.now()};sendResponse({ok:true});return;}
    if(message.type==='IHS2_TELEMETRY'){const p=IHS2.sanitize(message.payload||{});await IHS2.addTelemetry(p.store||'metrics_snapshots',p.value||p);sendResponse({ok:true});return;}
    if(message.type==='IHS2_DECISION'){await IHS2.addTelemetry('decision_records',IHS2.sanitize(message.payload||{}));sendResponse({ok:true});return;}
    if(message.type==='GET_V2_STATUS'){sendResponse({ok:true,status:lastStatus});return;}
    if(message.type==='GET_V2_SETTINGS'){sendResponse({ok:true,settings:await ensureMigrated()});return;}
    if(message.type==='SAVE_V2_SETTINGS'){const {settings,report}=IHS2.migrateSettings(message.settings||{});await chrome.storage.sync.set({[SETTINGS_KEY]:settings});if(report.length)await chrome.storage.local.set({[MIGRATION_REPORT_KEY]:{ts:Date.now(),items:report}});sendResponse({ok:true,settings});return;}
    if(message.type==='GET_TELEMETRY_SUMMARY'){sendResponse({ok:true,summary:await IHS2.summary()});return;}
    if(message.type==='GET_CHANGELOG_INTELLIGENCE'){sendResponse({ok:true,view:IHS2.ChangelogStore.buildView(await getChangelogState())});return;}
    if(message.type==='REFRESH_CHANGELOG'){sendResponse({ok:true,view:await refreshChangelog(message.force===true)});return;}
    if(message.type==='MARK_CHANGELOG_READ'){sendResponse({ok:true,view:await markChangelogRead(message.ids||[])});return;}
    if(message.type==='GET_MIGRATION_REPORT'){const got=await chrome.storage.local.get(MIGRATION_REPORT_KEY);sendResponse({ok:true,report:got[MIGRATION_REPORT_KEY]||{ts:0,items:[]}});return;}
    if(message.type==='EXPORT_V5'){const got=await chrome.storage.local.get(MIGRATION_REPORT_KEY);const data=IHS2.Export.assembleExport({manifest:chrome.runtime.getManifest(),pageAudit:message.pageAudit||null,pageAuditError:message.pageAuditError||null,telemetry:await IHS2.summary(),settings:await ensureMigrated(),migration:got[MIGRATION_REPORT_KEY]||{ts:0,items:[]},changelog:IHS2.ChangelogStore.buildView(await getChangelogState())});sendResponse({ok:true,data});return;}
    if(message.type==='CLEAR_TELEMETRY'){await IHS2.clearTelemetry();sendResponse({ok:true});return;}
    sendResponse({ok:false,error:'Unsupported background command'});
  })().catch(e=>sendResponse({ok:false,error:String(e.message||e)}));
  return true;
});
