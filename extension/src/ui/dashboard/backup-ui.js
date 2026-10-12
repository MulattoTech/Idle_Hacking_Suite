'use strict';
(()=>{
  const el=id=>document.getElementById(id);
  const status=(msg,error=false)=>{const node=el('checkpointStatus');if(node){node.textContent=msg;node.style.color=error?'#ff9c9c':'';}};
  async function request(type,extra={}){
    const response=await chrome.runtime.sendMessage({type,...extra});
    if(!response?.ok)throw new Error(response?.error||'Background operation failed');
    return response;
  }
  function showSummary(s){status(s?'Latest local checkpoint: '+(s.generatedAt||'unknown')+' · '+s.telemetryRows+' telemetry rows':'No local checkpoint saved yet');}
  async function loadStatus(){try{showSummary((await request('GET_LOCAL_CHECKPOINT_STATUS')).summary);}catch(e){status('Checkpoint status: '+e.message,true);}}
  async function restore(response){
    if(response.settings&&typeof bindSettings==='function'){
      bindSettings(response.settings);
      try{await activeTabMessage({type:'SETTINGS_UPDATED',settings:response.settings});}catch{}
    }
    status('Restored Suite settings and '+Object.values(response.imported||{}).reduce((n,v)=>n+Number(v||0),0)+' telemetry records. Existing history was preserved.');
  }
  el('saveCheckpoint').onclick=async()=>{try{const r=await request('SAVE_LOCAL_CHECKPOINT');showSummary(r.summary);}catch(e){status(e.message,true);}};
  el('restoreCheckpoint').onclick=async()=>{
    if(!confirm('Restore the latest local Suite settings and merge any missing telemetry?'))return;
    try{await restore(await request('RESTORE_LOCAL_CHECKPOINT'));}catch(e){status(e.message,true);}
  };
  el('downloadSnapshot').onclick=async()=>{
    try{
      status('Preparing a sanitized portable save state…');
      const result=await request('EXPORT_SAVE_STATE');
      const blob=new Blob([JSON.stringify(result.data)],{type:'application/json'});
      const url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download='idle-hacking-suite-save-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),4000);
      status('Exported '+result.summary.telemetryRows+' history records and current settings.');
    }catch(e){status('Export failed: '+e.message,true);}
  };
  el('uploadSnapshot').onclick=()=>el('snapshotFile').click();
  el('snapshotFile').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    if(!confirm('Import "'+file.name+'"? Settings will be restored and telemetry merged (no game account credentials).')){e.target.value='';return;}
    try{
      if(file.size>24*1024*1024)throw new Error('File too large (limit 24 MB)');
      const data=JSON.parse(await file.text());
      await restore(await request('IMPORT_SAVE_STATE',{data}));
    }catch(err){status('Import failed: '+err.message,true);}
    e.target.value='';loadStatus();
  });
  async function cloudConfiguration(){
    const state=collect();
    const configured=await request('SAVE_V2_SETTINGS',{settings:state});
    settings=configured.settings;
    try{await activeTabMessage({type:'SETTINGS_UPDATED',settings});}catch{}
    return configured.settings.cloud||{};
  }
  const driveStatus=message=>{el('driveStatus').textContent=message;};
  el('driveConnect').onclick=async()=>{
    try{
      driveStatus('Opening Google account consent, if OAuth is configured…');
      await cloudConfiguration();
      const r=await request('DRIVE_CONNECT');
      driveStatus('Google Drive authorized; folder: '+r.folder.name+' ('+r.folder.id+'). Choose Back Up to Drive for the first upload.');
    }catch(e){driveStatus('Connect failed: '+e.message);}
  };
  el('driveSyncNow').onclick=async()=>{
    try{
      driveStatus('Uploading a sanitized Suite save to the selected Google Drive folder…');
      await cloudConfiguration();
      const r=await request('DRIVE_SYNC_NOW');
      driveStatus('Drive backup uploaded: '+r.status.bytes+' bytes · '+r.status.folderName+' · '+new Date(r.status.at).toLocaleString());
    }catch(e){driveStatus('Drive backup failed: '+e.message);}
  };
  el('driveRestore').onclick=async()=>{
    if(!confirm('Restore Suite settings and merge combat/decision history from Google Drive?'))return;
    try{
      driveStatus('Loading Google Drive save state…');
      await cloudConfiguration();
      const r=await request('DRIVE_RESTORE');
      await restore(r);
      driveStatus('Drive save restored: '+r.file.name+' · settings updated and history merged.');
    }catch(e){driveStatus('Drive restore failed: '+e.message);}
  };
  request('DRIVE_SYNC_STATUS').then(r=>{
    if(r.status?.ok)driveStatus('Latest Drive backup: '+new Date(r.status.at).toLocaleString()+' in '+r.status.folderName);
    else if(r.status?.error)driveStatus('Last Drive sync error: '+r.status.error);
  }).catch(()=>{});
  loadStatus();
})();
