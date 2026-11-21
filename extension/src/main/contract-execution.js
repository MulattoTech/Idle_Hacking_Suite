'use strict';
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;root.IHS2=root.IHS2||{};root.IHS2.ContractExecution=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const MUTATIONS=new Set(['CONTRACT_CLAIM','CONTRACT_SET_ACTIVE']);
 function pendingFor(intent,now=Date.now(),boardKey=''){
   if(!MUTATIONS.has(intent?.type))return null;
   const id=String(intent.payload?.contract_id||'');
   if(!id)return null;
   return{type:intent.type,id,startedAt:now,boardKey:String(boardKey||'')};
 }
 function verify(state,pending){
   if(!pending)return{verified:false,reason:'no pending mutation'};
   if(!state||!Array.isArray(state.contracts))return{verified:false,reason:'awaiting authoritative contract board'};
   if(pending.boardKey&&state.board_key&&state.board_key!==pending.boardKey)return{verified:false,reason:'contract board changed; re-evaluate'};
   const contract=state.contracts.find(c=>String(c?.id||'')===pending.id);
   if(pending.type==='CONTRACT_CLAIM'){
     return{verified:Boolean(contract?.claimed),reason:contract?.claimed?'server state confirms claimed':'claim not confirmed in server state'};
   }
   if(pending.type==='CONTRACT_SET_ACTIVE'){
     const verified=String(state.active_contract_id||'')===pending.id;
     return{verified,reason:verified?'server state confirms active contract':'active contract not yet confirmed'};
   }
   return{verified:false,reason:'unsupported mutation'};
 }
 function mergeClaimPayload(previous,payload){
   const c=payload?.contracts;
   if(c&&typeof c==='object'&&!Array.isArray(c)&&Array.isArray(c.contracts))return c;
   if(Array.isArray(c))return{...(previous||{}),contracts:c};
   if(Array.isArray(payload?.state?.contracts))return payload.state;
   return previous;
 }
 return{pendingFor,verify,mergeClaimPayload};
});
