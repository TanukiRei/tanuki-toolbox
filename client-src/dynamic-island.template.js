document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),{createPortal}=require('react-dom'),NS='tanukiIsland';
  const createNotificationIsland=__ISLAND_FUNCTION__;
  // Shared only inside this renderer: disable/re-enable or a fresh chunk must not
  // let an older bridge promise finish after the next owner's count.
  const badgeKey=Symbol.for('tanuki.completed-taskbar-writer');
  const badgeChannel=window[badgeKey]||(window[badgeKey]={owner:null,wanted:0,attempted:null,writing:false,bridge:null});
  function drainBadge(){
    if(badgeChannel.writing||typeof badgeChannel.bridge?.setCompletedCount!=='function')return;
    badgeChannel.writing=true;
    void (async()=>{
      try{while(badgeChannel.wanted!==badgeChannel.attempted){const next=badgeChannel.wanted;badgeChannel.attempted=next;try{await badgeChannel.bridge.setCompletedCount(next);}catch{}}}
      finally{badgeChannel.writing=false;}
    })();
  }
  function apply(ctx,{load}={}){
    ctx.effect(()=>ctx.locale.register(NS,__LOCALES__));const t=ctx.locale.bind(NS);
    function useLocale(){React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());return t;}
    const requests=new Set();let alive=true;
    async function read(path,ms,signal,binary=false){
      if(!alive)throw new Error('Component stopped');
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);requests.add(controller);
      const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      try{const response=await fetch(new URL(path.replace(/^\//,''),document.baseURI),{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('Notifications unavailable');return binary?await response.blob():await response.json();}
      finally{clearTimeout(timer);requests.delete(controller);signal?.removeEventListener('abort',abort);}
    }
    let bubbleFiber=null,bubbleRequest=null,bubbleEpoch=0,bubbleEnabled=false,bubbleItems=[],offUpdates=null,nativeStatus=null,hostErrors=new Set(),hostPluginItems=[];
    const interactionKeys=new Map();let interactionSequence=0;
    // Native completionUnread ignores window focus and has no public mark-read action.
    // Keep only observed completions locally; never infer success from an idle baseline.
    const completions=new Set(),acknowledged=new Set();
    let currentSession=null,panelIsConversation=false,sessionRows=null;
    // sessionStatus includes retained subagents; workspace rows explicitly exclude them.
    const workspaceSession=id=>!!sessionRows?.[id]&&sessionRows[id].origin!=='subagent';
    const viewing=id=>panelIsConversation&&currentSession===id&&document.visibilityState!=='hidden'&&document.hasFocus();
    // Taskbar has its own positive-success ledger: never count inferred completions,
    // plugin/errors, category preferences, or the optional global-bubbles switch.
    const taskbar=window.dshDesktop?.taskbar,confirmedTurns=new Map(),runningSince=new Map(),readThrough=new Map(),retiredEpochs=new Set(),badgeOwner=Symbol('taskbar-owner');
    let badgeClosed=false,evidenceEpoch=null;
    badgeChannel.owner=badgeOwner;badgeChannel.bridge=taskbar;
    function writeBadge(count){
      if(badgeChannel.owner!==badgeOwner||typeof taskbar?.setCompletedCount!=='function')return;
      badgeChannel.wanted=badgeClosed?0:count;drainBadge();
    }
    function observeConfirmed(sessionId,evidence,state){
      if(!evidence||typeof evidence.epoch!=='string'||!Number.isSafeInteger(evidence.turnStartSeq)||!Number.isSafeInteger(evidence.revision)||evidence.revision<evidence.turnStartSeq)return;
      if(retiredEpochs.has(evidence.epoch))return;
      if(evidenceEpoch!==evidence.epoch){if(evidenceEpoch){retiredEpochs.add(evidenceEpoch);confirmedTurns.clear();}evidenceEpoch=evidence.epoch;}
      const old=confirmedTurns.get(sessionId),same=old?.epoch===evidence.epoch;
      if(same&&(evidence.turnStartSeq<old.turnStartSeq||(evidence.turnStartSeq===old.turnStartSeq&&evidence.revision<old.revision)))return;
      const sameTurn=same&&evidence.turnStartSeq===old.turnStartSeq;
      if(same&&evidence.turnStartSeq>old.turnStartSeq){
        completions.delete(sessionId);acknowledged.delete(sessionId);hostErrors.delete(sessionId);clearTaskNotice(sessionId);
      }
      // A native new-round transition fences late terminal events even before the
      // next Host snapshot arrives. Original event time, not delivery time, is used.
      const terminal=evidence.terminal;
      const stale=terminal&&runningSince.has(sessionId)&&(!Number.isFinite(evidence.completedAt)||evidence.completedAt<runningSince.get(sessionId));
      confirmedTurns.set(sessionId,{...evidence,state,acknowledged:(sameTurn&&old.acknowledged)||(Number.isFinite(evidence.completedAt)&&evidence.completedAt<=readThrough.get(sessionId)),invalidated:(sameTurn&&old.invalidated)||!!stale});
    }
    function reconcileTaskbar(){
      let count=0;
      for(const [id,turn] of confirmedTurns){
        const status=nativeStatus?.get(id);
        const success=turn.terminal==='completed'&&turn.state==='done'&&!turn.pendingInteraction&&!turn.invalidated;
        if(!success||!workspaceSession(id)||!status||status.running!==false||status.pendingInteraction)continue;
        if(viewing(id))turn.acknowledged=true;
        if(!turn.acknowledged)count++;
      }
      writeBadge(count);
    }
    function terminalCurrent(id,evidence){
      const turn=confirmedTurns.get(id);
      return workspaceSession(id)&&!!evidence&&!!turn&&turn.epoch===evidence.epoch&&turn.turnStartSeq===evidence.turnStartSeq&&turn.revision===evidence.revision&&!turn.invalidated&&!turn.acknowledged&&!acknowledged.has(id)&&nativeStatus?.get(id)?.running===false;
    }
    function clearTaskNotice(id){window.dispatchEvent(new CustomEvent('tanuki:task-read',{detail:{sessionId:id}}));}
    function acknowledgeCurrent(){
      if(!currentSession||!viewing(currentSession)||nativeStatus?.get(currentSession)?.running!==false||!completions.has(currentSession))return;
      readThrough.set(currentSession,Date.now());
      completions.delete(currentSession);acknowledged.add(currentSession);hostErrors.delete(currentSession);
      const turn=confirmedTurns.get(currentSession);if(turn)turn.acknowledged=true;
      clearTaskNotice(currentSession);
    }
    function observeStatus(next){
      for(const [id,value] of next){
        const previous=nativeStatus?.get(id);
        if(value.running){
          if(previous?.running!==true){runningSince.set(id,Date.now());const turn=confirmedTurns.get(id);if(turn?.terminal)turn.invalidated=true;hostErrors.delete(id);clearTaskNotice(id);}
          completions.delete(id);acknowledged.delete(id);
        }
        else if(value.running===false&&(previous?.running===true||value.completionUnread===true)&&!acknowledged.has(id))completions.add(id);
      }
      for(const ids of [completions,acknowledged,hostErrors])for(const id of ids)if(!next.has(id))ids.delete(id);
      for(const [id,turn] of confirmedTurns)if(!next.has(id))turn.acknowledged=true;
      nativeStatus=next;acknowledgeCurrent();
    }
    const emitBubbles=()=>{if(alive)window.dispatchEvent(new CustomEvent('tanuki:bubble-state',{detail:{source:'notifications',taskReadAware:bubbleEnabled&&nativeStatus instanceof Map,items:bubbleEnabled?bubbleItems:[]}}));};
    function reconcileBubbles(){
      if(!alive)return;
      acknowledgeCurrent();reconcileTaskbar();
      const items=[...hostPluginItems];
      if(nativeStatus)for(const [sessionId,value] of nativeStatus){
        if(!workspaceSession(sessionId))continue;
        // Running is independent of attention/read state (also while offline).
        if(value.running)items.push({id:'task:running:'+sessionId,target:'workspace',sessionId,state:'running'});
        else if(value.pendingInteraction)items.push({id:'task:action:'+sessionId,target:'workspace',sessionId,state:'action'});
        else if(!value.running&&completions.has(sessionId)&&!viewing(sessionId))items.push({id:'task:completion:'+sessionId,target:'workspace',sessionId,state:hostErrors.has(sessionId)?'error':'done'});
      }
      if(window.navigator.onLine===false)items.push({id:'network:offline',target:'workspace',state:'error'});
      bubbleItems=items;emitBubbles();
    }
    function syncBubbles(settings){
      const enabled=settings.bubbles!==false;if(enabled===bubbleEnabled)return; bubbleEnabled=enabled;const epoch=++bubbleEpoch;
      bubbleRequest?.abort();bubbleRequest=null;emitBubbles();
      if(!enabled){bubbleFiber?.dispose();bubbleFiber=null;return;}
      if(typeof load!=='function')return;
      const controller=new AbortController();bubbleRequest=controller;
      void load('global-bubbles',controller.signal).then(module=>{if(!alive||!bubbleEnabled||epoch!==bubbleEpoch)return;bubbleFiber=ctx.plugin(module);emitBubbles();}).catch(error=>{if(alive&&epoch===bubbleEpoch&&!controller.signal.aborted)console.warn('[Tanuki] Global bubbles could not load',error);}).finally(()=>{if(bubbleRequest===controller)bubbleRequest=null;});
    }
    const island=createNotificationIsland({React,createPortal,ctx,read,useLocale,notificationIcon:__DSH_NOTIFICATION_ICON__,createAudioPreview:__AUDIO_PREVIEW_FACTORY__,onSettings:syncBubbles,acceptTaskNotification:message=>{
      const id=message.sessionId;
      observeConfirmed(id,message.taskEvidence,message.kind==='task.completed'?'done':'error');
      if(!terminalCurrent(id,message.taskEvidence)){reconcileTaskbar();return false;}
      completions.add(id);
      if(message.kind==='task.failed')hostErrors.add(id);else hostErrors.delete(id);
      reconcileBubbles();
      return !viewing(id)&&!acknowledged.has(id);
    },onBubbleState:items=>{
      if(!alive)return;
      for(const item of items)if(item.target==='workspace'&&typeof item.sessionId==='string')observeConfirmed(item.sessionId,item.taskEvidence,item.state);
      // Snapshot and event paths share the same turn/read fence; neither can revive an old failure.
      for(const item of items)if(item.target==='workspace'&&['done','error'].includes(item.state)&&terminalCurrent(item.sessionId,item.taskEvidence)){
        completions.add(item.sessionId);
        if(item.state==='error')hostErrors.add(item.sessionId);else hostErrors.delete(item.sessionId);
      }
      hostPluginItems=items.filter(item=>item.target==='plugins');reconcileBubbles();
    }});
    // Official root snapshot owns running and pending interaction. The local read
    // overlay adds focus awareness without mutating native service internals.
    ctx.inject(['uiSession','layout'],host=>{
      const current=host.uiSession.adapter?.current,panel=host.layout.panelInfo;
      if(typeof current?.getSnapshot!=='function'||typeof current?.subscribe!=='function'||typeof panel?.getSnapshot!=='function'||typeof panel?.subscribe!=='function')return;
      const refresh=()=>{if(!alive)return;currentSession=current.getSnapshot()?.key??null;panelIsConversation=panel.getSnapshot()?.activePanelId===null;reconcileBubbles();};
      const offCurrent=current.subscribe(refresh),offPanel=panel.subscribe(refresh);refresh();
      host.effect(()=>()=>{offCurrent();offPanel();currentSession=null;panelIsConversation=false;});
    });
    ctx.inject(['sessions'],host=>{
      const list=host.sessions.list;
      const refresh=()=>{if(!alive)return;const snapshot=list.getSnapshot();if(!snapshot?.byId)return;
        // Retain the last known membership through a pending/reconnecting baseline.
        sessionRows=snapshot.phase==='ready'?snapshot.byId:{...sessionRows,...snapshot.byId};reconcileBubbles();
      };
      const off=list.subscribe(refresh);refresh();host.effect(()=>()=>{off();});
    });
    island.sync(true);
    ctx.inject(['uiSession'],host=>{
      const store=host.uiSession.sessionStatus;
      if(typeof store?.getSnapshot!=='function'||typeof store?.subscribe!=='function')return;
      const refresh=()=>{
        if(!alive)return;const next=store.getSnapshot();
        if(!(next instanceof Map))return; // Transient unavailable/offline state is not a read or failure.
        observeStatus(next);
        const present=new Set();
        for(const [sessionId,value] of nativeStatus){
          const interaction=value.pendingInteraction;if(!interaction)continue;present.add(sessionId);
          const key=JSON.stringify(interaction);
          if(interactionKeys.get(sessionId)!==key){interactionKeys.set(sessionId,key);island.push({id:'interaction:'+sessionId+':'+(++interactionSequence),sessionId,kind:'task.input',category:'tasks',title:{zh:'任务需要你的处理',en:'Task needs your attention'},message:{zh:interaction.kind==='approval'?'请批准或拒绝操作':interaction.kind==='plan-review'?'请审核计划':'请回答问题或选择选项',en:interaction.kind==='approval'?'Approve or deny the operation':interaction.kind==='plan-review'?'Review the plan':'Answer the question or choose an option'}});}
        }
        for(const id of interactionKeys.keys())if(!present.has(id))interactionKeys.delete(id);
        reconcileBubbles();
      };
      const off=store.subscribe(refresh);refresh();host.effect(()=>()=>{off();nativeStatus=null;interactionKeys.clear();completions.clear();acknowledged.clear();hostErrors.clear();reconcileBubbles();});
    });
    const delivered=event=>{
      if(!alive)return;const message=event.detail,id=message?.sessionId;
      if(typeof id!=='string'||!['task.completed','task.failed'].includes(message.kind))return;
      observeConfirmed(id,message.taskEvidence,message.kind==='task.completed'?'done':'error');reconcileTaskbar();
      if(!terminalCurrent(id,message.taskEvidence))return;
      if(message.kind==='task.failed')hostErrors.add(id);
      if(nativeStatus.get(id).running===false)completions.add(id);
      reconcileBubbles();
    };
    window.addEventListener('tanuki:notification-delivered',delivered);
    window.addEventListener('focus',reconcileBubbles);window.addEventListener('blur',reconcileBubbles);document.addEventListener('visibilitychange',reconcileBubbles);
    window.addEventListener('tanuki:bubble-request',emitBubbles);
    window.addEventListener('offline',reconcileBubbles);window.addEventListener('online',reconcileBubbles);
    reconcileBubbles();
    const updateState=value=>{if(!alive||!value||!['available','downloaded'].includes(value.phase)||typeof value.version!=='string')return;island.push({id:'dsh-update:'+value.phase+':'+value.version,kind:'dsh.update.'+value.phase,category:'updates',title:{zh:'DeepSeek Harness 更新',en:'DeepSeek Harness update'},message:{zh:(value.phase==='downloaded'?'更新已准备就绪：':'发现新版本：')+value.version,en:(value.phase==='downloaded'?'Ready to install: ':'New version: ')+value.version}});};
    // Public origin-scoped desktop bridge, no guessed RPC and no background update polling.
    const updates=window.dshDesktop?.updates;
    if(typeof updates?.subscribe==='function')offUpdates=updates.subscribe(updateState);
    if(typeof updates?.status==='function')Promise.resolve(updates.status()).then(updateState).catch(()=>{});
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=__CSS__;style.dataset.tanukiStyle='island';document.head.appendChild(style);return()=>style.remove();});
    ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'tanuki-dynamic-island',locale:NS},island.Island));
    ctx.effect(()=>()=>{badgeClosed=true;writeBadge(0);confirmedTurns.clear();runningSince.clear();readThrough.clear();retiredEpochs.clear();bubbleEnabled=false;emitBubbles();alive=false;++bubbleEpoch;bubbleRequest?.abort();bubbleFiber?.dispose();offUpdates?.();window.removeEventListener('focus',reconcileBubbles);window.removeEventListener('blur',reconcileBubbles);document.removeEventListener('visibilitychange',reconcileBubbles);window.removeEventListener('tanuki:notification-delivered',delivered);completions.clear();acknowledged.clear();hostErrors.clear();interactionKeys.clear();sessionRows=null;hostPluginItems=[];bubbleItems=[];nativeStatus=null;window.removeEventListener('offline',reconcileBubbles);window.removeEventListener('online',reconcileBubbles);window.removeEventListener('tanuki:bubble-request',emitBubbles);for(const controller of requests)controller.abort();requests.clear();island.dispose();});
  }
  return {name:'tanuki-island-runtime',inject:['slots','locale'],apply};
});
