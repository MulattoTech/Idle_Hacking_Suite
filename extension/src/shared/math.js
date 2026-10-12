(function(root,factory){const out=factory();if(typeof module!=='undefined'&&module.exports)module.exports=out;root.IHS2=root.IHS2||{};Object.assign(root.IHS2,out);})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number.isFinite(Number(n))?Number(n):min));
  const median=(xs)=>{const a=xs.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
  const pct=(a,b)=>b?((a-b)/Math.abs(b))*100:0;
  const deepMerge=(base,value)=>{if(!value||typeof value!=='object'||Array.isArray(value))return structuredClone(base);const out=structuredClone(base);for(const[k,v]of Object.entries(value)){if(v&&typeof v==='object'&&!Array.isArray(v)&&out[k]&&typeof out[k]==='object'&&!Array.isArray(out[k]))out[k]=deepMerge(out[k],v);else out[k]=structuredClone(v);}return out;};
  return {clamp,median,pct,deepMerge};
});
