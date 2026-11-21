'use strict';
(function(root,factory){
 const api=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.IHS2=root.IHS2||{};root.IHS2.DriveSync=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const SCOPE='https://www.googleapis.com/auth/drive.file';
 const API='https://www.googleapis.com/drive/v3/files';
 const UPLOAD='https://www.googleapis.com/upload/drive/v3/files';
 const NAME='idle-hacking-suite-state.json';
 const FOLDER_MIME='application/vnd.google-apps.folder';
 const qstr=s=>String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
 async function tokenFor(chromeApi,interactive){
   const auth=chromeApi.runtime?.getManifest?.().oauth2;
   if(!auth?.client_id||!/^\d+-.+\.apps\.googleusercontent\.com$/.test(auth.client_id))
     throw new Error('Google Drive OAuth not configured. Add a Chrome Extension OAuth client ID for this installed extension to manifest.json. See docs/GOOGLE-DRIVE-SYNC.md.');
   if(!chromeApi.identity?.getAuthToken)throw new Error('This Chromium browser does not support chrome.identity.getAuthToken. Use manual save-state files.');
   const r=await chromeApi.identity.getAuthToken({interactive,scopes:[SCOPE]});
   const token=typeof r==='string'?r:r?.token;
   if(!token)throw new Error('Google authorization returned no access token.');
   return token;
 }
 function createClient({chromeApi=globalThis.chrome,fetchImpl=globalThis.fetch}={}){
   async function apiRequest(url,options={},interactive=false){
     let token=await tokenFor(chromeApi,interactive);
     async function request(t){return fetchImpl(url,{...options,headers:{...options.headers,Authorization:'Bearer '+t}});}
     let r=await request(token);
     if(r.status===401&&chromeApi.identity?.removeCachedAuthToken){
       await chromeApi.identity.removeCachedAuthToken({token});
       token=await tokenFor(chromeApi,false);r=await request(token);
     }
     if(!r.ok){let body='';try{body=(await r.text()).slice(0,240);}catch{}throw new Error('Google Drive HTTP '+r.status+(body?': '+body:''));}
     return r;
   }
   async function list(query,interactive=false){
     const url=API+'?'+new URLSearchParams({q:query,fields:'nextPageToken,files(id,name,mimeType,modifiedTime)',pageSize:'100',spaces:'drive'}).toString();
     const r=await apiRequest(url,{},interactive);return (await r.json()).files||[];
   }
   async function folder(config={},interactive=false){
     const explicit=String(config.folderId||'').trim();
     if(explicit){
       const r=await apiRequest(API+'/'+encodeURIComponent(explicit)+'?fields=id,name,mimeType',{},interactive);
       const f=await r.json();
       if(f.mimeType!==FOLDER_MIME)throw new Error('Configured Drive folder ID is not a folder');
       return f;
     }
     const name=String(config.folderName||'Idle Hacking Suite Backups').trim();
     if(!name||name.length>120)throw new Error('Choose a valid Drive folder name');
     const found=await list("name='"+qstr(name)+"' and mimeType='"+FOLDER_MIME+"' and trashed=false",interactive);
     if(found.length)return found[0];
     const r=await apiRequest(API+'?fields=id,name,mimeType',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:FOLDER_MIME})},interactive);
     return r.json();
   }
   async function remoteFile(folderId,interactive=false){
     const rows=await list("'"+qstr(folderId)+"' in parents and name='"+NAME+"' and trashed=false",interactive);
     return rows.find(f=>f.name===NAME)||null;
   }
   async function upload(data,config={},interactive=false){
     const state=globalThis.IHS2?.Snapshot?.validate?.(data)||data;
     const folderInfo=await folder(config,interactive);
     const prior=await remoteFile(folderInfo.id,interactive);
     const body=JSON.stringify(state),bytes=new TextEncoder().encode(body);
     if(bytes.byteLength>24*1024*1024)throw new Error('Save state is larger than 24MB');
     const url=prior?UPLOAD+'/'+encodeURIComponent(prior.id)+'?uploadType=resumable&fields=id,name,modifiedTime':
       UPLOAD+'?uploadType=resumable&fields=id,name,modifiedTime';
     const meta=prior?{}:{name:NAME,mimeType:'application/json',parents:[folderInfo.id]};
     const begin=await apiRequest(url,{method:prior?'PATCH':'POST',headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':'application/json','X-Upload-Content-Length':String(bytes.byteLength)},body:JSON.stringify(meta)},interactive);
     const location=begin.headers.get('Location');
     if(!location||!location.startsWith('https://www.googleapis.com/'))
       throw new Error('Drive upload session returned no trusted resumable URL');
     const finish=await apiRequest(location,{method:'PUT',headers:{'Content-Type':'application/json'},body:bytes},false);
     return{file:await finish.json(),folder:folderInfo,bytes:bytes.byteLength,created:!prior};
   }
   async function download(config={},interactive=false){
     const folderInfo=await folder(config,interactive);
     const file=await remoteFile(folderInfo.id,interactive);
     if(!file)throw new Error('No Idle Hacking Suite save-state file found in this Drive folder');
     const r=await apiRequest(API+'/'+encodeURIComponent(file.id)+'?alt=media',{},interactive);
     const text=await r.text();
     if(text.length>24*1024*1024)throw new Error('Drive backup exceeds 24MB safety limit');
     const data=JSON.parse(text);
     return{data:globalThis.IHS2?.Snapshot?.validate?.(data)||data,file,folder:folderInfo};
   }
   return{folder,upload,download};
 }
 return{SCOPE,NAME,createClient};
});
