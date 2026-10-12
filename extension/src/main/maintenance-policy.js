'use strict';
(function(root,factory){
 const out=factory();
 if(typeof module!=='undefined'&&module.exports)module.exports=out;
 root.IHS2=root.IHS2||{};
 Object.assign(root.IHS2,out);
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 function planMaintenance(settings={}){
  if(settings.masterEnabled)return{contracts:false,events:false};
  return{
   contracts:settings.contracts?.enabled===true,
   events:settings.events?.enabled===true
  };
 }
 return{planMaintenance};
});
