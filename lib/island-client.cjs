'use strict';
function createNotificationIsland({React,createPortal,ctx,read,useLocale,createAudioPreview,onSettings,onBubbleState,acceptTaskNotification,notificationIcon,activateDesktop}){
  const h=React.createElement,STORAGE='tanuki-toolbox:island-v1';
  const state={queue:[],seen:[],epoch:null,cursor:0,launch:null,openedAt:Date.now(),enabled:false,listeners:new Set(),snapshot:[]};
  if(!state.restored){state.restored=true;try{const saved=JSON.parse(sessionStorage.getItem(STORAGE)||'null');if(saved){state.epoch=saved.epoch;state.cursor=Number(saved.cursor)||0;state.launch=saved.launch;}}catch{}}
  let active=false,disposed=false,timer,flight=null,navigating=false,navigationEpoch=0,stopLocate=null,navigationRequest=null;
  let player=null,lastSoundId=null,preferences={volume:100,audio:null,categories:{plugins:true,tasks:true,updates:true},bubbles:true,inApp:true,systemNotifications:false,soundEnabled:true},settingsReady=false,settingsEpoch=0,settingsRequest=null,pollRequest=null;
  const pending=[];const systemNotifications=new Set(),notificationSessions=new Map();
  let workspace=null,layout=null;
  ctx.inject(['uiWorkspace','layout'],host=>{workspace=host.uiWorkspace;layout=host.layout;host.effect(()=>()=>{workspace=null;layout=null;});});
  function closeNotification(note){notificationSessions.delete(note);systemNotifications.delete(note);note.close();}
  const taskRead=event=>{
    const id=event.detail?.sessionId;if(typeof id!=='string')return;
    for(const [note,sessionId] of notificationSessions)if(sessionId===id)closeNotification(note);
    const obsolete=item=>item.sessionId===id&&['task.completed','task.failed','task.input'].includes(item.kind);
    state.queue=state.queue.filter(item=>!obsolete(item));
    for(let i=pending.length-1;i>=0;i--)if(obsolete(pending[i]))pending.splice(i,1);
    change();
  };
  const settingsShell=()=>ctx.slots.entries('sidebar.settings').find(entry=>typeof entry.store?.create==='function');
  const closeSettings=()=>settingsShell()?.store.create().actions.close?.();
  function destination(item){
    if(item.kind==='launch.protected')return {page:'plugins',category:'installed'};
    const supplied=item.destination;
    if(supplied&&['session','plugins','settings','schedules','home','updates'].includes(supplied.page))return supplied;
    if(typeof item.sessionId==='string')return {page:'session',sessionId:item.sessionId};
    if(item.packageName||item.category==='plugins'||String(item.kind).startsWith('plugin.'))return {page:'plugins',category:item.pluginCategory};
    if(String(item.kind).startsWith('task.'))return {page:'schedules',scheduleId:item.scheduleId};
    if(String(item.kind).startsWith('dsh.update'))return {page:'updates'};
    return {page:'settings',section:'tanuki-toolbox',component:'dynamic-island'};
  }
  function locateComponent(component){
    if(!['startup-guard','sidebar','home','composer','dynamic-island','plugin-center'].includes(component))return;
    const selector='[data-shortcut-modal="settings"] [data-tanuki-setting="'+component+'"]';
    let observer,timeout;
    const cleanup=()=>{observer?.disconnect();clearTimeout(timeout);if(stopLocate===cleanup)stopLocate=null;};
    const find=()=>{if(!active||disposed){cleanup();return;}const element=document.querySelector(selector);if(!element)return;element.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});cleanup();};
    stopLocate=cleanup;observer=new MutationObserver(find);observer.observe(document.body,{childList:true,subtree:true});timeout=setTimeout(cleanup,5000);find();
  }
  function locateNative(target,item){
    const name=target.packageName||item.packageName,entryId=target.entryId||item.entryId,scheduleId=target.scheduleId||item.scheduleId;
    if(target.page==='plugins'&&!name&&!entryId||target.page==='schedules'&&!scheduleId)return;
    let observer,timeout;
    const cleanup=()=>{observer?.disconnect();clearTimeout(timeout);if(stopLocate===cleanup)stopLocate=null;};
    const find=()=>{
      if(!active||disposed){cleanup();return;}
      let row;
      if(target.page==='plugins'){
        const page=document.querySelector('[data-plugin-panel]');if(!page)return;
        if(page.hasAttribute('data-tanuki-center')){cleanup();return;}
        row=[...page.querySelectorAll('[data-plugin-package],[data-plugin-item]')].find(node=>node.getAttribute('data-plugin-package')===name||!!entryId&&node.getAttribute('data-plugin-item')===entryId);
      }else row=[...document.querySelectorAll('[data-testid="task-manager-page"] button[aria-describedby]')].find(node=>node.getAttribute('aria-describedby')?.endsWith('-metadata-'+scheduleId));
      if(!row||!row.getClientRects().length)return;
      row.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      if(target.page==='schedules'&&row.getAttribute('aria-expanded')!=='true')row.click();
      row.focus?.({preventScroll:true});cleanup();
    };
    stopLocate?.();stopLocate=cleanup;observer=new MutationObserver(find);observer.observe(document.body,{childList:true,subtree:true});timeout=setTimeout(cleanup,5000);find();
  }
  async function openNotification(item,{system=false}={}){
    if(!active||disposed||navigating)return false;
    const epoch=++navigationEpoch;navigating=true;stopLocate?.();
    try{
      const target=destination(item);window.focus();
      if(system&&location.protocol==='dsh-app:'&&location.hostname==='app'&&typeof activateDesktop==='function'){
        const controller=new AbortController();navigationRequest=controller;
        try{const result=await activateDesktop(controller.signal);if(result?.status!=='requested')console.warn('[Tanuki] Desktop activation unavailable');}
        catch(error){if(!controller.signal.aborted)console.warn('[Tanuki] Desktop activation unavailable',error);}
        finally{if(navigationRequest===controller)navigationRequest=null;}
        if(!active||disposed||epoch!==navigationEpoch)return false;
        window.focus();
      }
      window.dispatchEvent(new CustomEvent('tanuki:clear-handoff'));
      if(target.page==='session'){
        const id=target.sessionId||item.sessionId;if(typeof id!=='string'||!workspace)throw new Error('Conversation navigation unavailable');
        closeSettings();await workspace.openSession(id);
      }else if(target.page==='plugins'){
        if(!layout)throw new Error('Plugin navigation unavailable');
        closeSettings();
        // Reuse the native page store: return from detail to its Installed list
        // without switching away and briefly revealing the conversation.
        const entry=ctx.slots.entries('main').find(row=>row.options?.key==='plugins');
        const actions=entry?.store?.create?.().actions;
        actions?.setView?.({kind:'list'});actions?.setTab?.('installed');
        const detail={list:true,packageName:item.kind==='plugin.removed'?undefined:target.packageName||item.packageName,entryId:target.entryId||item.entryId,category:target.category||item.pluginCategory};
        window.dispatchEvent(new CustomEvent('tanuki:locate-plugin',{detail}));
        layout.selectPanel('plugins');
        locateNative(target,item.kind==='plugin.removed'?{}:item);
      }else if(target.page==='settings'||target.page==='updates'){
        const entry=settingsShell(),actions=entry?.store.create().actions;
        if(!actions?.openSection)throw new Error('Settings navigation unavailable');
        if(target.page==='updates'){
          const open=entry.inject?.()?.openDesktopUpdate;
          if(typeof open==='function')open();else actions.openSection('general');
        }else{
          const section=typeof target.section==='string'&&ctx.slots.entries('settings.section').some(row=>row.options?.id===target.section)?target.section:'tanuki-toolbox';
          actions.openSection(section);locateComponent(target.component);
        }
      }else{
        if(!layout)throw new Error('Page navigation unavailable');
        closeSettings();
        const panel=target.page==='schedules'?'schedules':ctx.slots.entries('main').some(row=>row.options?.key==='tanuki-home')?'tanuki-home':'tanuki-sidebar-home';
        if(!ctx.slots.entries('main').some(row=>row.options?.key===panel))throw new Error('Page unavailable');
        layout.selectPanel(panel);
        if(target.page==='schedules')locateNative(target,item);
      }
      return active&&!disposed&&epoch===navigationEpoch;
    }catch(error){if(active&&!disposed)console.warn('[Tanuki] Could not open notification target',error);return false;}
    finally{if(epoch===navigationEpoch)navigating=false;}
  }
  const activate=(item,options)=>openNotification(item,options).then(opened=>{if(opened&&active&&!disposed)dismiss(item.id);return opened;});
  function cancelNavigation(){++navigationEpoch;navigating=false;navigationRequest?.abort();navigationRequest=null;stopLocate?.();stopLocate=null;}
  const getPlayer=()=>player||(player=createAudioPreview({baseURI:document.baseURI}));
  async function refreshSettings(){
    if(!active||disposed)return;
    const epoch=++settingsEpoch;settingsRequest?.abort();const controller=new AbortController();settingsRequest=controller;
    try{
      const value=await read('/tanuki-toolbox/settings',5000,controller.signal);
      if(!active||disposed||epoch!==settingsEpoch)return;
      const next=value?.island;if(!next)return;
      preferences={volume:Number.isFinite(next.volume)?Math.max(0,Math.min(100,next.volume)):100,audio:next.audio||null,categories:{plugins:true,tasks:true,updates:true,...next.categories},bubbles:next.bubbles!==false,inApp:next.inApp!==false,systemNotifications:next.systemNotifications===true,soundEnabled:next.soundEnabled!==false};
      settingsReady=true;player?.stop();if(!preferences.soundEnabled){player?.dispose();player=null;}if(!preferences.systemNotifications){for(const note of [...systemNotifications])closeNotification(note);systemNotifications.clear();}onSettings?.(preferences);
      state.queue=preferences.inApp?state.queue.filter(item=>allowed(item)):[];change();
      for(const item of pending.splice(0))push(item);
    }catch{}finally{if(settingsRequest===controller)settingsRequest=null;}
  }
  const settingsChanged=()=>{settingsReady=false;player?.stop();for(const note of [...systemNotifications])closeNotification(note);systemNotifications.clear();void refreshSettings();};
  const unlockAudio=()=>{if(active&&!disposed&&settingsReady&&preferences.soundEnabled&&preferences.volume>0)void getPlayer().unlock().catch(()=>{});};
  function soundFor(id){
    if(!active||disposed||lastSoundId===id)return;lastSoundId=id;
    if(settingsReady&&preferences.soundEnabled&&preferences.volume>0)void getPlayer().play(preferences,{gesture:false}).catch(()=>{});
  }
  function category(value){if(['plugins','tasks','updates'].includes(value.category))return value.category;const kind=String(value.kind||'');return kind.startsWith('plugin.')?'plugins':kind.startsWith('task.')?'tasks':kind.startsWith('dsh.update')?'updates':'general';}
  const allowed=value=>preferences.categories[category(value)]!==false;
  const foreground=()=>document.visibilityState==='visible'&&document.hasFocus();
  function systemNotify(item){
    // Standard authorized Web Notification API only. No permission prompt or invented IPC.
    if(!active||disposed||!settingsReady||!preferences.systemNotifications||foreground()||typeof window.Notification!=='function'||window.Notification.permission!=='granted')return;
    try{
      const formatted=format(item,ctx.locale.bind('tanukiIsland'));
      const title=item.kind==='task.completed'?resolveText({zh:'已完成',en:'Completed'}):formatted.title;
      const detail=item.kind==='task.completed'?(resolveText(item.message)||formatted.detail):formatted.detail;
      while(systemNotifications.size>=40)closeNotification(systemNotifications.values().next().value);
      const notification=new window.Notification(title,{body:detail,icon:notificationIcon,tag:'tanuki:'+item.id,silent:true});
      systemNotifications.add(notification);if(item.sessionId)notificationSessions.set(notification,item.sessionId);
      notification.onclose=()=>{systemNotifications.delete(notification);notificationSessions.delete(notification);};
      notification.onerror=()=>{console.warn('[Tanuki] System notification could not be displayed',item.kind);closeNotification(notification);};
      notification.onclick=event=>{event.preventDefault?.();void activate(item,{system:true}).finally(()=>closeNotification(notification));};
    }catch(error){console.warn('[Tanuki] System notification could not be created',error);} 
  }
  const save=()=>{try{sessionStorage.setItem(STORAGE,JSON.stringify({epoch:state.epoch,cursor:state.cursor,launch:state.launch}));}catch{}};
  const change=()=>{state.snapshot=[...state.queue];for(const fn of [...state.listeners])fn();};
  const subscribe=fn=>{state.listeners.add(fn);return()=>state.listeners.delete(fn);};
  const clip=value=>typeof value==='string'?value.slice(0,500):value;
  function push(value){
    if(!active||disposed||!value||typeof value!=='object')return false;
    if(!settingsReady){if(pending.length>=40)pending.shift();pending.push(value);return false;}
    const id=typeof value.id==='string'?value.id:Math.random().toString(36)+Date.now();
    if(state.seen.includes(id))return false;
    state.seen.push(id);state.seen=state.seen.slice(-500);
    // Consult the live turn/read fence before sound, OS notification or queue insertion.
    if(['task.completed','task.failed'].includes(value.kind)&&acceptTaskNotification?.(value)===false)return false;
    if(!allowed(value))return false;
    const message={...value,id,category:category(value),at:Date.now(),title:clip(value.title),message:typeof value.message==='string'?value.message.slice(0,8000):value.message};
    systemNotify(message);
    window.dispatchEvent(new CustomEvent('tanuki:notification-delivered',{detail:{...message,bubbles:preferences.bubbles,foreground:foreground()}}));
    if(!preferences.inApp){soundFor(message.id);return true;}
    if(state.queue.length>=40)state.queue.shift();
    state.queue.push(message);change();return true;
  }
  const dismiss=id=>{state.queue=state.queue.filter(item=>item.id!==id);change();};
  async function poll(){
    if(!active||disposed||flight)return;
    flight=(async()=>{
      const controller=new AbortController();pollRequest=controller;
      const batch=await read('/tanuki-toolbox/notifications',5000,controller.signal);
      if(disposed||!active||batch?.schema!==1||!Array.isArray(batch.events)||typeof batch.epoch!=='string')return;
      onBubbleState?.(Array.isArray(batch.bubbles)?batch.bubbles:[]);
      const resumed=state.epoch===batch.epoch;
      if(!resumed){state.epoch=batch.epoch;state.cursor=0;}
      if(batch.enabled){
        for(const event of batch.events)if(event.seq>state.cursor&&(resumed||event.at>=state.openedAt-1500))push({...event,id:batch.epoch+':'+event.seq});
        const launch=batch.launch;
        if(launch?.status==='protected'&&typeof launch.at==='string'&&state.launch!==launch.at){
          if(push({id:'launch:'+launch.at,kind:'launch.protected',checked:Number(launch.checked)||0,disabled:Number(launch.disabled)||0}))state.launch=launch.at;
        }
      }
      state.cursor=Math.max(state.cursor,Number(batch.cursor)||0);save();
    })().catch(()=>{}).finally(()=>{flight=null;pollRequest=null;});
    return flight;
  }
  function sync(enabled){
    if(disposed)return;
    if(enabled===active)return;
    active=enabled;state.enabled=enabled;if(!enabled)cancelNavigation();
    clearInterval(timer);
    if(enabled){window.addEventListener('tanuki:notify',onMessage);void refreshSettings();window.addEventListener('tanuki:settings-changed',settingsChanged);window.addEventListener('tanuki:task-read',taskRead);window.addEventListener('focus',onFocus);window.addEventListener('pointerdown',unlockAudio,true);window.addEventListener('keydown',unlockAudio,true);state.queue=state.queue.filter(item=>Date.now()-item.at<120000);change();void poll();timer=setInterval(poll,1600);}
    else{window.removeEventListener('tanuki:notify',onMessage);window.removeEventListener('pointerdown',unlockAudio,true);window.removeEventListener('keydown',unlockAudio,true);player?.dispose();player=null;pending.length=0;pollRequest?.abort();onBubbleState?.([]);for(const note of [...systemNotifications])closeNotification(note);systemNotifications.clear();settingsReady=false;++settingsEpoch;settingsRequest?.abort();settingsRequest=null;window.removeEventListener('tanuki:settings-changed',settingsChanged);window.removeEventListener('tanuki:task-read',taskRead);window.removeEventListener('focus',onFocus);lastSoundId=null;state.queue=[];change();}
  }
  const onMessage=event=>push(event.detail);
  const onFocus=()=>{void refreshSettings();};
  function resolveText(value){
    if(typeof value==='string')return value;
    const locale=/^zh(?:[-_]|$)/i.test(ctx.locale.getSnapshot()?.active||'')?'zh':'en';
    if(!value||typeof value!=='object')return '';
    const result=locale==='zh'?(value.zh||value['zh-CN']||value['zh-TW']||value.en):value.en;
    return typeof result==='string'?result:'';
  }
  function format(item,tr){
    const names={'task.completed':'islandTask','plugin.enabled':'islandEnabled','plugin.disabled':'islandDisabled','plugin.removed':'islandRemoved','plugin.installed':'islandInstalled','plugin.updated':'islandUpdated','launch.protected':'launchProtected'};
    const extra={'task.failed':{zh:'任务失败',en:'Task failed'},'task.input':{zh:'任务需要你的处理',en:'Task needs your attention'},'plugin.available':{zh:'插件更新可用',en:'Plugin update available'},'dsh.update.available':{zh:'DeepSeek Harness 更新可用',en:'DeepSeek Harness update available'},'dsh.update.downloaded':{zh:'DeepSeek Harness 更新已就绪',en:'DeepSeek Harness update ready'}};
    const title=resolveText(item.title)||resolveText(extra[item.kind])||tr(names[item.kind]||'islandGlobal');
    let detail=resolveText(item.message)||resolveText(item.name);
    if(item.kind==='task.completed'&&!detail)detail=tr('islandTaskDetail');
    if(item.kind==='launch.protected')detail=tr('islandLaunchDetail',{n:String(item.checked),disabled:String(item.disabled)});
    return {title,detail};
  }
  function Island(){
    const tr=useLocale(),queue=React.useSyncExternalStore(subscribe,()=>state.snapshot),item=queue[0];
    const [paused,setPaused]=React.useState(false);
    React.useEffect(()=>{if(item)soundFor(item.id);},[item?.id]);
    React.useEffect(()=>{if(!item||paused)return;const clock=setTimeout(()=>dismiss(item.id),6500);return()=>clearTimeout(clock);},[item?.id,paused]);
    if(!preferences.inApp||!item)return null;
    const {title,detail}=format(item,tr);
    const glyph=(item.kind==='error'||item.kind==='task.failed')?'error':item.kind==='launch.protected'?'shield':item.kind==='task.completed'?'check':item.kind==='plugin.disabled'?'pause':item.kind==='plugin.removed'?'remove':'check';
    const paths={error:'M12 8v5m0 3h.01M12 3 2 21h20L12 3Z',shield:'M12 3 4.5 6v5.5c0 4 3 7.3 7.5 9.5 4.5-2.2 7.5-5.5 7.5-9.5V6L12 3Zm-4 9 2.5 2.5L16 9',check:'m6 12 4 4 8-8',pause:'M9 6v12M15 6v12',remove:'M7 12h10'};
    return createPortal(h('div',{className:'tanuki-island-position','data-tanuki-island':'',onMouseEnter:()=>setPaused(true),onMouseLeave:()=>setPaused(false),onFocus:()=>setPaused(true),onBlur:event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false);}},
      h('div',{className:'tanuki-island',key:item.id},
        h('button',{type:'button',className:'tanuki-island-open','aria-label':tr('openTarget')+' · '+title,title:tr('openTarget'),onClick:()=>activate(item)},
          h('span',{className:'tanuki-island-symbol','data-tone':glyph==='error'?'error':undefined,'aria-hidden':true},h('svg',{viewBox:'0 0 24 24',width:23,height:23,fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round'},h('path',{d:paths[glyph]}))),
          h('span',{className:'tanuki-island-copy',role:'status','aria-live':'polite','aria-atomic':true},h('strong',null,title),detail?h('span',{title:detail},detail):null),
          queue.length>1?h('span',{className:'tanuki-island-count',title:tr('islandQueued',{n:String(queue.length-1)})},'+'+(queue.length-1)):null),
        h('button',{type:'button',className:'tanuki-island-close','aria-label':tr('dismiss'),title:tr('dismiss'),onClick:()=>dismiss(item.id)},'×'))),document.body);
  }
  return {Island,sync,push,poll,dispose(){disposed=true;active=false;cancelNavigation();window.removeEventListener('pointerdown',unlockAudio,true);window.removeEventListener('keydown',unlockAudio,true);player?.dispose();player=null;pending.length=0;pollRequest?.abort();onBubbleState?.([]);for(const note of [...systemNotifications])closeNotification(note);systemNotifications.clear();settingsReady=false;++settingsEpoch;settingsRequest?.abort();settingsRequest=null;window.removeEventListener('tanuki:settings-changed',settingsChanged);window.removeEventListener('tanuki:task-read',taskRead);window.removeEventListener('focus',onFocus);lastSoundId=null;clearInterval(timer);window.removeEventListener('tanuki:notify',onMessage);state.enabled=false;state.queue=[];state.seen=[];state.snapshot=[];state.listeners.clear();}};
}
module.exports={createNotificationIsland};
