'use strict';
// Serializable client factory. No requests, global subscriptions or timers.
function createBubbleModel(initialCategories={}){
  const sources=new Map(),listeners=new Set();let snapshot=[],categories=initialCategories;
  const states=['done','action','error','running'];
  const emit=()=>{
    const native=sources.get('notifications')||[],center=sources.get('plugin-center')||[];
    // A package is one unit, even when both the native installer and the center
    // describe it. An explicit center operation wins; otherwise native progress
    // wins over the center's merely available-update marker. Sessions keep IDs.
    const packages=new Map(),other=[];
    for(const item of center)if(item.target==='plugins'&&item.packageName)packages.set(item.packageName,item);else other.push(item);
    for(const item of native)if(item.target==='plugins'&&item.packageName){if(!packages.get(item.packageName)?.operation)packages.set(item.packageName,item);}else other.push(item);
    // Keep authoritative source snapshots intact while hidden. Re-enabling a
    // category projects its latest live state, never a cached notification queue.
    snapshot=[...other,...packages.values()].filter(item=>categories[item.category]!==false);for(const fn of [...listeners])fn();
  };
  function replace(detail){
    if(!detail||!['notifications','plugin-center'].includes(detail.source)||!Array.isArray(detail.items))return;
    if(detail.source==='notifications'&&detail.categories)categories={plugins:detail.categories.plugins!==false,tasks:detail.categories.tasks!==false,updates:detail.categories.updates!==false};
    const items=new Map();
    for(const value of detail.items.slice(0,1024)){
      if(!value||typeof value.id!=='string'||!value.id||value.id.length>512||!states.includes(value.state)||!['plugins','plugin-updates','workspace'].includes(value.target))continue;
      const count=value.count===undefined?1:value.count;if(!Number.isSafeInteger(count)||count<1||count>1000000)continue;
      const category=detail.source==='notifications'&&['plugins','tasks','updates','general'].includes(value.category)?value.category:value.target==='workspace'?'tasks':'plugins';
      const item={id:value.id,state:value.state,target:value.target,count,category};
      if(typeof value.sessionId==='string')item.sessionId=value.sessionId;
      if(typeof value.packageName==='string')item.packageName=value.packageName;
      if(detail.source==='plugin-center'&&value.operation===true)item.operation=true;
      items.set(value.id,item);
    }
    sources.set(detail.source,[...items.values()]);emit();
  }
  function aggregate(items,target,sessionId,packageName){
    const candidates=items.filter(item=>item.target===target&&(sessionId===undefined||item.sessionId===sessionId)&&(packageName===undefined||item.packageName===packageName));
    // One conversation, one state. Running always suppresses stale terminal/action facts.
    const sessions=new Map(),selected=[],priority=['running','action','error','done'];
    for(const item of candidates){
      if(item.target!=='workspace'||!item.sessionId){selected.push(item);continue;}
      const old=sessions.get(item.sessionId);
      if(!old||priority.indexOf(item.state)<priority.indexOf(old.state))sessions.set(item.sessionId,{...item,count:1});
    }
    selected.push(...sessions.values());
    const colors=states.filter(state=>selected.some(item=>item.state===state));
    if(!colors.length)return null;
    // Workspace segments combine different conversations, never competing states
    // of the same conversation. Each conversation contributes exactly one unit.
    const units=new Map();
    for(const item of selected){const key=item.sessionId?'session:'+item.sessionId:item.id;units.set(key,Math.max(units.get(key)||0,item.count));}
    return {states:colors,total:[...units.values()].reduce((sum,count)=>sum+count,0)};
  }
  return {replace,aggregate,getSnapshot:()=>snapshot,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},dispose(){sources.clear();snapshot=[];listeners.clear();}};
}
module.exports={createBubbleModel};
