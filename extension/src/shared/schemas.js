(function(root,factory){const out=factory();if(typeof module!=='undefined'&&module.exports)module.exports=out;root.IHS2=root.IHS2||{};Object.assign(root.IHS2,out);})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const TELEMETRY_STORES=['metrics_snapshots','combat_events','automation_actions','decision_records','equipment_changes','enhancement_spend','breach_runs','contract_events','event_participation','market_sales','market_asks_summary','economy_purchases','changelog_entries'];
  const STATUS_STATES=['Running','Waiting','Cooldown','Rate Limited','Blocked','Disabled','Needs Input','Error'];
  return {TELEMETRY_STORES,STATUS_STATES};
});
