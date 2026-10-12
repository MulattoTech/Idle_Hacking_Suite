(function(root,factory){const out=factory();if(typeof module!=='undefined'&&module.exports)module.exports=out;root.IHS2=root.IHS2||{};root.IHS2.MarketGoverned=out;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function shouldYield(snapshot={},ownPriority=10){return(Array.isArray(snapshot.queue)?snapshot.queue:[]).some(x=>Number(x.priority||0)>Number(ownPriority));}
  function pauseScan(state={},now=Date.now(),backoffMs=5000,error='rate limited'){return{...state,active:false,resumePage:Number(state.resumePage||state.page||1),backoffMs:Number(backoffMs)||5000,nextRetryAt:Number(now)+(Number(backoffMs)||5000),lastError:String(error||'rate limited')};}
  function canArbitrage({freeSlots=Infinity,reserveSlots=0}={}){return Number(freeSlots)>Math.max(0,Number(reserveSlots)||0);}
  function chooseAnchor({sold=null,ask=null,live=null,mode='balanced'}={}){
    let price=NaN,source='',samples=0;
    if(sold&&Number(sold.price)>0){price=Number(mode==='fast'?(sold.p25||sold.price):mode==='max'?(sold.p75||sold.price):sold.price);source='sold';samples=Number(sold.samples||0);}
    if(live){const lp=Number(mode==='fast'?(live.lowest||live.p20||live.median):mode==='max'?(live.p75||live.median||live.lowest):(live.p20||live.median||live.lowest));if(lp>0&&(live.kind==='exact'||!Number.isFinite(price)||mode==='fast')){price=Number.isFinite(price)?Math.min(price,lp):lp;source=source?`${source}+live`:'live';samples=Math.max(samples,Number(live.samples||0));}}
    if(!Number.isFinite(price)&&ask&&Number(ask.price)>0){price=Number(mode==='fast'?(ask.p25||ask.price):mode==='max'?(ask.p75||ask.price):ask.price);source='ask';samples=Number(ask.samples||0);}
    return Number.isFinite(price)?{price,source,samples}:null;
  }
  return{shouldYield,pauseScan,canArbitrage,chooseAnchor};
});
