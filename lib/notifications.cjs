'use strict';
const {randomUUID}=require('node:crypto');
const {resolve}=require('node:path');
const {readLaunchSession}=require('./launch-session.cjs');
const SELF='dsh-local-plugin-center',KEY=Symbol.for('tanuki.notifications.v1');
function stateFor(profile){
  const states=globalThis[KEY]||(globalThis[KEY]=new Map()),key=resolve(profile.dir);
  if(!states.has(key))states.set(key,{epoch:randomUUID(),seq:0,events:[],enabled:false,bundles:null,rows:null,titles:new Map(),seen:new Set()});
  const state=states.get(key);state.tasks ||= new Map();state.pluginErrors ||= [];return state;
}
function publish(profile,message){
  const state=stateFor(profile);
  if(!state.enabled||!message||typeof message!=='object')return false;
  const key=typeof message.id==='string'?message.id.slice(0,250):null;
  if(key&&state.seen.has(key))return false;
  if(key){state.seen.add(key);if(state.seen.size>500)state.seen.delete(state.seen.values().next().value);}
  const text=(value,limit=500)=>typeof value==='string'?value.slice(0,limit):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k,v])=>['en','zh','zh-CN'].includes(k)&&typeof v==='string').map(([k,v])=>[k,v.slice(0,limit)])):undefined;
  const target=message.destination;
  const destination=target&&['session','plugins','settings','schedules','home','updates'].includes(target.page)?{page:target.page,...Object.fromEntries(['sessionId','section','component'].filter(key=>typeof target[key]==='string'&&target[key].length<=250).map(key=>[key,target[key]])),...(['official','installed'].includes(target.category)?{category:target.category}:{})}:undefined;
  state.events.push({seq:++state.seq,at:Date.now(),kind:typeof message.kind==='string'?message.kind:'global',name:text(message.name),title:text(message.title),message:text(message.message,8000),version:text(message.version),sessionId:typeof message.sessionId==='string'?message.sessionId.slice(0,250):undefined,packageName:typeof message.packageName==='string'?message.packageName.slice(0,250):undefined,category:['plugins','tasks','updates'].includes(message.category)?message.category:undefined,pluginCategory:['official','installed'].includes(message.pluginCategory)?message.pluginCategory:undefined,destination,taskEvidence:message.taskEvidence});
  state.events=state.events.filter(item=>Date.now()-item.at<300000).slice(-80);
  return true;
}
// Session event seq identifies a turn; the host epoch prevents seq reuse after restart.
// No start/terminal proof means no taskbar success, even if legacy bubble state says done.
function taskEvidence(state,item){
  return {epoch:state.epoch,turnStartSeq:item.turnStartSeq,turnStartedAt:item.turnStartedAt,revision:item.lastEventSeq,terminal:item.terminalReason,completedAt:item.completedAt,pendingInteraction:!!(item.approvals.size||item.questions.size)};
}
function read(profile){
  const state=stateFor(profile);
  if(!state.launch||state.launch.status==='unconfirmed')state.launch=readLaunchSession(profile.dir);
  for(const [id,item] of state.tasks)if(['done','error','cancelled'].includes(item.state)&&Date.now()-item.at>120000)state.tasks.delete(id);
  const bubbles=[...[...state.tasks].map(([sessionId,item])=>({id:'task:'+sessionId,target:'workspace',sessionId,state:item.state,taskEvidence:taskEvidence(state,item)})),...state.pluginErrors];
  return {schema:1,bubbles,epoch:state.epoch,cursor:state.seq,enabled:state.enabled,events:state.events.filter(item=>Date.now()-item.at<120000),launch:state.launch};
}
function watch(ctx,profile){
  const state=stateFor(profile),owner=Symbol('island');let stopped=false;
  state.owner=owner;state.enabled=true;
  // Observe committed public session events; do not scan or replay historic session logs.
  const pendingResult=content=>{try{return JSON.parse(content?.find(block=>block.type==='text')?.text||'null')?.pending===true;}catch{return false;}};
  const offSession=ctx.on('session/event',(session,event)=>{
    if(stopped||!session?.id)return;
    if(event?.type==='session/title'&&typeof event.data?.title==='string'){
      state.titles.set(session.id,event.data.title.slice(0,180));
      if(state.titles.size>300)state.titles.delete(state.titles.keys().next().value);
    }
    const agents=ctx.get('agents');
    if(typeof agents?.get==='function'&&typeof agents?.roots==='function'&&agents.get(session.id)&&!agents.roots().some(agent=>agent.id===session.id))return;
    const type=event?.type,data=event?.data||{};
    const known=['turn/start','turn/end','assistant/message','approval/asked','approval/decided','tool/call','tool/result','tool/ptc-dispatch','user/message'];
    if(!known.includes(type))return;
    let item=state.tasks.get(session.id);
    const ensure=()=>{if(!item){item={state:'running',running:true,approvals:new Set(),questions:new Set(),at:Date.now(),lastEventSeq:event.seq};state.tasks.set(session.id,item);}return item;};
    // Ignore delayed events from a previous turn before they mutate its successor.
    if(Number.isSafeInteger(event.seq)&&Number.isSafeInteger(item?.lastEventSeq)&&event.seq<=item.lastEventSeq)return;
    if(item)item.lastEventSeq=event.seq;
    const refresh=()=>{if(!item)return;item.state=item.approvals.size||item.questions.size?'action':item.running?'running':item.terminal||'running';item.at=Date.now();};
    const notify=(kind,title,message)=>publish(profile,{id:'task:'+session.id+':'+event.seq+':'+kind,kind,category:'tasks',sessionId:session.id,name:state.titles.get(session.id),title,message,taskEvidence:taskEvidence(state,item)});
    if(type==='turn/start'){
      // Retained notification history is not a second terminal ledger for this conversation.
      state.events=state.events.filter(note=>note.sessionId!==session.id||!['task.completed','task.failed','task.input'].includes(note.kind));
      ensure();item.turnStartSeq=event.seq;item.turnStartedAt=event.time;item.lastReply='';item.running=true;item.terminal=null;item.terminalReason=null;item.completedAt=null;item.approvals.clear();refresh();}
    else if(type==='assistant/message'){
      const content=data.message?.content;
      if(Array.isArray(content)){
        const reply=content.filter(block=>block?.type==='text'&&typeof block.text==='string').map(block=>block.text).join('\n').trim();
        if(reply){ensure();item.lastReply=reply.slice(0,8000);}
      }
    }
    else if(type==='approval/asked'){ensure();item.approvals.add(data.id);refresh();}
    else if(type==='approval/decided'){if(item){item.approvals.delete(data.id);refresh();}}
    else if(type==='tool/call'&&data.name==='ask_user_question'){ensure();item.questions.add(data.callId);refresh();}
    else if(type==='tool/ptc-dispatch'&&data.name==='ask_user_question'&&pendingResult(data.content)){ensure();item.questions.add(data.subCallId);refresh();}
    else if(type==='tool/result'&&item?.questions.has(data.message?.toolCallId)){
      if(!pendingResult(data.message?.content)&&data.error?.code!=='TOOL_OUTCOME_UNKNOWN')item.questions.delete(data.message.toolCallId);refresh();
    }
    else if(type==='user/message'&&data.source?.kind==='user-question-reply'&&item){item.questions.delete(data.source.callId);refresh();}
    else if(type==='turn/end'){
      ensure();item.running=false;item.approvals.clear();item.terminalReason=data.reason?.kind||'unknown';item.completedAt=event.time;
      if(data.reason?.kind==='error'){item.terminal='error';refresh();notify('task.failed',{zh:'任务失败',en:'Task failed'});}
      else if(data.reason?.kind==='completed'){item.terminal='done';refresh();if(!item.questions.size)notify('task.completed',{zh:'已完成',en:'Completed'},item.lastReply);}
      else{item.terminal='cancelled';refresh();}
    }
    if(state.tasks.size>300){for(const [id,value] of state.tasks){if(['done','error'].includes(value.state)){state.tasks.delete(id);if(state.tasks.size<=300)break;}}}
    while(state.tasks.size>500)state.tasks.delete(state.tasks.keys().next().value);
  });
  const offGlobal=ctx.on('tanuki/global-message',message=>{if(!stopped)publish(profile,message);});
  ctx.inject(['pluginManager'],host=>{
    let disposed=false,flight=null,again=false,timer,attempt=0;
    const stable=row=>!['loading','pending','unloading','failed'].includes(row?.fiberPhase);
    const title=item=>item?.meta?.title||item?.name||item?.moduleName;
    const pluginCategory=(bundle,row)=>bundle?(bundle.official===true||(bundle.official===undefined&&bundle.optional===true)?'official':'installed'):row?.moduleName?.startsWith('@deepseek-ai/')?'official':undefined;
    async function scan(){
      if(stopped||disposed)return;
      if(flight){again=true;return flight;}
      flight=(async()=>{
        const manager=host.pluginManager;
        const [bundles,rows]=await Promise.all([manager.listBundles(),manager.listPlugins()]);
        if(stopped||disposed||!Array.isArray(bundles)||!Array.isArray(rows))return;
        const settling=rows.some(row=>['loading','pending','unloading'].includes(row.fiberPhase));
        if(settling&&attempt++<8){clearTimeout(timer);timer=setTimeout(scan,Math.min(2500,500*attempt));}
        const pluginErrors=new Map();
        for(const bundle of bundles)if(bundle.error)pluginErrors.set(bundle.name,{id:'plugin-error:'+bundle.name,target:'plugins',packageName:bundle.name,state:'error'});
        for(const row of rows)if(row.fiberPhase==='failed'){
          const owner=bundles.find(bundle=>bundle.rows?.some(item=>item.entryId===row.entryId));
          const name=owner?.name||row.moduleName||row.entryId;
          if(typeof name==='string')pluginErrors.set(name,{id:'plugin-error:'+name,target:'plugins',packageName:name,state:'error'});
        }
        state.pluginErrors=[...pluginErrors.values()].slice(0,300);
        const nextBundles=new Map(bundles.map(item=>[item.name,item]));
        const nextRows=new Map(rows.filter(item=>!item.readOnlyReason).map(item=>[item.entryId,item]));
        const enabled=rows.some(row=>row.moduleName===SELF+'/dynamic-island'&&row.enabled);
        const previousEnabled=state.enabled;state.enabled=enabled;
        const changedBundles=new Set();
        if(state.bundles){
          for(const item of bundles){
            const old=state.bundles.get(item.name);
            const memberRows=(item.rows||[]).map(row=>rows.find(candidate=>candidate.entryId===row.entryId)).filter(Boolean);
            if(item.error||(item.enabled&&memberRows.some(row=>row.enabled&&!stable(row)))){
              if(old)nextBundles.set(item.name,old);else nextBundles.delete(item.name);
              changedBundles.add(item.name);continue;
            }
            const notify=kind=>{changedBundles.add(item.name);if(previousEnabled&&enabled)publish(profile,{kind,category:'plugins',pluginCategory:pluginCategory(item),packageName:item.name,name:title(item),version:item.version});};
            if(item.installed&&!old?.installed)notify('plugin.installed');
            else if(old&&old.enabled!==item.enabled)notify(item.enabled?'plugin.enabled':'plugin.disabled');
            else if(item.installed&&old?.version&&item.version!==old.version)notify('plugin.updated');
          }
          for(const old of state.bundles.values())if(old.installed&&!nextBundles.get(old.name)?.installed){
            changedBundles.add(old.name);
            if(previousEnabled&&enabled)publish(profile,{kind:'plugin.removed',category:'plugins',pluginCategory:pluginCategory(old),packageName:old.name,name:title(old)});
          }
        }
        if(state.rows&&previousEnabled&&enabled){
          for(const row of nextRows.values()){
            const old=state.rows.get(row.entryId);
            if(!stable(row)){if(old)nextRows.set(row.entryId,old);continue;}
            if(!old||old.enabled===row.enabled)continue;
            const owner=bundles.find(bundle=>bundle.rows?.some(item=>item.entryId===row.entryId));
            if(owner&&changedBundles.has(owner.name))continue;
            publish(profile,{kind:row.enabled?'plugin.enabled':'plugin.disabled',category:'plugins',pluginCategory:pluginCategory(owner,row),packageName:owner?.name,name:title(row)});
          }
        }
        if(!enabled)state.events=[];
        state.bundles=nextBundles;state.rows=nextRows;
      })().catch(error=>{if(!stopped&&!disposed)ctx.logger.warn('[Tanuki] Notification inventory unavailable',error?.message);}).finally(()=>{flight=null;if(again&&!stopped&&!disposed){again=false;schedule();}});
      return flight;
    }
    function schedule(){if(stopped||disposed)return;attempt=0;clearTimeout(timer);timer=setTimeout(scan,350);}
    const off=host.on('plugin-manager/changed',schedule);
    schedule();
    host.effect(()=>()=>{disposed=true;clearTimeout(timer);off();});
  });
  return async()=>{
    stopped=true;offSession();offGlobal();
    if(state.owner!==owner)return;
    state.enabled=false;state.tasks.clear();state.pluginErrors=[];
    let keep=false;try{keep=await require('./component-state.cjs').enabled(profile,'tanuki-dynamic-island')===true;}catch{}
    if(state.owner!==owner)return;
    if(!keep){
      state.events=[];state.bundles=null;state.rows=null;state.titles.clear();state.seen.clear();
      const states=globalThis[KEY];states?.delete(resolve(profile.dir));if(states&&!states.size)delete globalThis[KEY];
    }
  };
}
module.exports={watch,read,publish};
