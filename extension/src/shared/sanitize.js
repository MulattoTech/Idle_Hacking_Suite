(function(root,factory){const out=factory();if(typeof module!=='undefined'&&module.exports)module.exports=out;root.IHS2=root.IHS2||{};Object.assign(root.IHS2,out);})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const secretRx=/(authorization|cookie|token|password|passwd|secret|session[_-]?id|auth[_-]?key|csrf)/i;
  function sanitize(value,depth=0){
    if(depth>8)return '[max-depth]';
    if(Array.isArray(value))return value.slice(0,500).map(v=>sanitize(v,depth+1));
    if(value&&typeof value==='object'){const out={};for(const[k,v]of Object.entries(value)){out[k]=secretRx.test(k)?'[redacted]':sanitize(v,depth+1);}return out;}
    if(typeof value==='string'&&/(Bearer\s+[A-Za-z0-9._-]{12,}|eyJ[A-Za-z0-9_-]{12,}\.|session=|auth=)/i.test(value))return '[redacted]';
    return value;
  }
  return {sanitize,secretRx};
});
