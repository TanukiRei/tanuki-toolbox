document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),{createPortal}=require('react-dom'),NS='tanukiIsland';
  const createNotificationIsland=function createNotificationIsland({React,createPortal,ctx,read,useLocale,createAudioPreview,onSettings,onBubbleState,acceptTaskNotification,notificationIcon,activateDesktop}){
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
};
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
    const toolboxLocale=(function createToolboxLocale(ctx, namespace, dictionaries) {
  const language = () => /^zh(?:[-_]|$)/i.test(ctx.locale.getSnapshot()?.active || '') ? 'zh' : 'en';
  const text = value => {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    const result = language() === 'zh' ? value.zh ?? value['zh-CN'] ?? value['zh-cn'] ?? value['zh-TW'] ?? value['zh-tw'] ?? value.en : value.en;
    return typeof result === 'string' ? result : '';
  };
  const t = (key, params) => {
    const template = dictionaries[language()]?.[key] ?? dictionaries.en?.[key] ?? key;
    return params ? template.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(params, name) ? String(params[name]) : match) : template;
  };
  ctx.effect(() => {
    const known = new Set(), disposers = [];
    function registerLanguages() {
      const entries = { en: dictionaries.en || {}, zh: dictionaries.zh || {} };
      for (const locale of ctx.locale.getSnapshot()?.locales || []) {
        const id = typeof locale === 'string' ? locale : locale.id;
        if (typeof id === 'string') entries[id] = /^zh(?:[-_]|$)/i.test(id) ? dictionaries.zh || dictionaries.en : dictionaries.en;
      }
      const pending = Object.fromEntries(Object.entries(entries).filter(([id]) => !known.has(id.toLowerCase())));
      if (!Object.keys(pending).length) return;
      for (const id of Object.keys(pending)) known.add(id.toLowerCase());
      disposers.push(ctx.locale.register(namespace, pending));
    }
    registerLanguages();
    const off = ctx.locale.subscribe(registerLanguages);
    return () => { off(); for (const dispose of disposers.reverse()) dispose(); };
  });
  return { t, text, language };
})(ctx,NS,{"zh":{"dismiss":"关闭提示","islandGlobal":"全局消息","islandTask":"任务已完成","islandTaskDetail":"本次任务已完成，可以查看结果了。","islandEnabled":"插件已开启","islandDisabled":"插件已关闭","islandRemoved":"插件已卸载","islandInstalled":"插件安装成功","islandUpdated":"插件已更新","islandLaunchDetail":"启动前已检查 {n} 个第三方插件，停用 {disabled} 个不兼容插件。","islandQueued":"还有 {n} 条消息","launchProtected":"本次已通过保护启动","openTarget":"打开相关页面"},"en":{"dismiss":"Dismiss","islandGlobal":"Notification","islandTask":"Task completed","islandTaskDetail":"Your task is complete. The result is ready to view.","islandEnabled":"Plugin enabled","islandDisabled":"Plugin disabled","islandRemoved":"Plugin uninstalled","islandInstalled":"Plugin installed","islandUpdated":"Plugin updated","islandLaunchDetail":"Checked {n} third-party plugins before launch; disabled {disabled} incompatible plugins.","islandQueued":"{n} more notifications","launchProtected":"This session used Protected Launch","openTarget":"Open related page"}}),t=toolboxLocale.t;
    function useLocale(){React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());return t;}
    const requests=new Set();let alive=true;
    async function read(path,ms,signal,binary=false,options={}){
      if(!alive)throw new Error('Component stopped');
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);requests.add(controller);
      const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      try{const response=await fetch(new URL(path.replace(/^\//,''),document.baseURI),{...options,credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('Notifications unavailable');return binary?await response.blob():await response.json();}
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
    const island=createNotificationIsland({React,createPortal,ctx,read,useLocale,activateDesktop:signal=>read('/tanuki-toolbox/notifications/activate',9000,signal,false,{method:'POST',headers:{'X-Tanuki-Notification-Click':'1'}}),notificationIcon:"data:image/png;base64,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",createAudioPreview:function createAudioPreview({baseURI} = {}) {
  let context=null,disposed=false,epoch=0,request=null,timer=null,cachedRevision=null,cachedBuffer=null;
  const nodes=new Set();
  function stop(){++epoch;request?.abort();request=null;clearTimeout(timer);timer=null;for(const node of nodes){try{node.stop?.();node.disconnect();}catch{}}nodes.clear();}
  function getContext(){if(disposed)throw new Error('Audio preview closed');if(!context){const Constructor=window.AudioContext||window.webkitAudioContext;if(!Constructor)throw new Error('Audio unavailable');context=new Constructor();}return context;}
  async function unlock(){const sound=getContext();if(sound.state==='suspended')await sound.resume();return sound;}
  async function play({volume=100,audio=null,soundEnabled=true}={}, {gesture=true}={}){
    stop();const generation=epoch;
    const level=Math.max(0,Math.min(100,Number.isFinite(Number(volume))?Number(volume):100))/100;
    if(disposed||!soundEnabled||level===0)return false;
    // Resume synchronously within the caller's user gesture, before any fetch/decode.
    const sound=getContext();if(gesture&&sound.state==='suspended')await sound.resume();
    if(disposed||generation!==epoch)return false;
    if(sound.state!=='running')return false; // Never replay autoplay-blocked notifications later.
    let buffer=null;
    try{
      if(audio?.revision){
        if(cachedRevision===audio.revision)buffer=cachedBuffer;
        else{
          const controller=new AbortController();request=controller;timer=setTimeout(()=>controller.abort(),15000);
          const response=await fetch(new URL('tanuki-toolbox/settings/audio',baseURI||document.baseURI),{credentials:'same-origin',cache:'no-store',signal:controller.signal});
          if(!response.ok)throw new Error('Audio unavailable');
          const bytes=await response.arrayBuffer();if(bytes.byteLength>5*1024*1024)throw new Error('Audio too large');
          if(disposed||generation!==epoch)return false;
          buffer=await sound.decodeAudioData(bytes);
          if(disposed||generation!==epoch)return false;
          cachedRevision=audio.revision;cachedBuffer=buffer;
        }
      }else{cachedRevision=null;cachedBuffer=null;}
      if(disposed||generation!==epoch)return false;
      const master=sound.createGain(),limiter=sound.createDynamicsCompressor();
      master.gain.value=level;limiter.threshold.value=-6;limiter.knee.value=6;limiter.ratio.value=12;limiter.attack.value=0.003;limiter.release.value=0.15;
      master.connect(limiter);limiter.connect(sound.destination);nodes.add(master);nodes.add(limiter);
      const cleanup=()=>{for(const node of [master,limiter]){node.disconnect();nodes.delete(node);}};
      const start=sound.currentTime+0.005;
      if(buffer){
        const source=sound.createBufferSource(),envelope=sound.createGain();source.buffer=buffer;
        const duration=Math.min(buffer.duration,30);if(duration<=0){cleanup();return false;}
        envelope.gain.setValueAtTime(0,start);envelope.gain.linearRampToValueAtTime(1,start+Math.min(0.012,duration/3));envelope.gain.setValueAtTime(1,start+Math.max(duration-0.03,duration/3));envelope.gain.linearRampToValueAtTime(0,start+duration);
        source.connect(envelope);envelope.connect(master);nodes.add(source);nodes.add(envelope);
        source.onended=()=>{source.disconnect();envelope.disconnect();nodes.delete(source);nodes.delete(envelope);cleanup();};source.start(start);source.stop(start+duration);
      }else{
        let pending=2;
        for(const [offset,frequency,peak] of [[0,660,0.16],[0.09,880,0.14]]){
          const oscillator=sound.createOscillator(),gain=sound.createGain(),at=start+offset;
          oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,at);
          gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(peak,at+0.018);gain.gain.exponentialRampToValueAtTime(0.0001,at+0.30);gain.gain.linearRampToValueAtTime(0,at+0.32);
          oscillator.connect(gain);gain.connect(master);nodes.add(oscillator);nodes.add(gain);
          oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();nodes.delete(oscillator);nodes.delete(gain);if(--pending===0)cleanup();};oscillator.start(at);oscillator.stop(at+0.33);
        }
      }
      return true;
    }catch(error){if(disposed||generation!==epoch||error?.name==='AbortError')return false;throw error;}
    finally{if(generation===epoch){clearTimeout(timer);timer=null;request=null;}}
  }
  function dispose(){if(disposed)return;disposed=true;stop();cachedBuffer=null;cachedRevision=null;const old=context;context=null;if(old)void old.close().catch(()=>{});}
  return {play,stop,dispose,unlock};
},onSettings:syncBubbles,acceptTaskNotification:message=>{
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
    ctx.effect(()=>{const style=document.createElement('style');style.textContent="/* Native dock's slot anchor uses display:contents; order places only our label\n   after the context meter, without moving or replacing native React children. */\n/* One global surface, with native light/dark neutral colors. */\n.tanuki-island-position{position:fixed;top:calc(var(--dsh-frame-top-clearance,0px) + 12px);left:50%;transform:translateX(-50%);z-index:12000;width:max-content;max-width:calc(100vw - 32px);pointer-events:none;-webkit-app-region:no-drag;}\n.tanuki-island{display:flex;align-items:center;gap:12px;box-sizing:border-box;width:460px;max-width:calc(100vw - 32px);min-height:68px;padding:12px 12px 12px 18px;border:1px solid var(--dsw-alias-border-l2);border-radius:30px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);box-shadow:0 10px 32px #0003,0 2px 8px #0002;pointer-events:auto;font-family:inherit;animation:tanuki-island-enter .32s cubic-bezier(.2,.8,.2,1);}\n.tanuki-island-symbol{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:50%;background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 12%,transparent);color:var(--dsw-alias-state-success-primary);}\n.tanuki-island-symbol[data-tone=\"error\"]{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);color:var(--dsw-alias-state-error-primary);}\n.tanuki-island-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px;}\n.tanuki-island-open{display:flex;flex:1;min-width:0;align-items:center;gap:12px;margin:0;padding:0;border:0;border-radius:18px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background-color .16s;}\n.tanuki-island-open:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:4px;}\n.tanuki-island-copy strong{font-size:14px;font-weight:600;line-height:20px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}\n.tanuki-island-copy>span{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden;overflow-wrap:anywhere;}\n.tanuki-island-count{flex:none;font-size:11px;line-height:20px;padding:0 6px;border-radius:10px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;}\n.tanuki-island-close{flex:none;display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:21px;line-height:1;cursor:pointer;transition:background .16s,color .16s;}\n.tanuki-island-close:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px;}\n@keyframes tanuki-island-enter{from{opacity:0;transform:translateY(-12px) scale(.92);}to{opacity:1;transform:translateY(0) scale(1);}}\n@media(prefers-reduced-motion:reduce){.tanuki-island{animation:none}.tanuki-island-close,.tanuki-island-open{transition:none}}\n";style.dataset.tanukiStyle='island';document.head.appendChild(style);return()=>style.remove();});
    ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'tanuki-dynamic-island',locale:NS},island.Island));
    ctx.effect(()=>()=>{badgeClosed=true;writeBadge(0);confirmedTurns.clear();runningSince.clear();readThrough.clear();retiredEpochs.clear();bubbleEnabled=false;emitBubbles();alive=false;++bubbleEpoch;bubbleRequest?.abort();bubbleFiber?.dispose();offUpdates?.();window.removeEventListener('focus',reconcileBubbles);window.removeEventListener('blur',reconcileBubbles);document.removeEventListener('visibilitychange',reconcileBubbles);window.removeEventListener('tanuki:notification-delivered',delivered);completions.clear();acknowledged.clear();hostErrors.clear();interactionKeys.clear();sessionRows=null;hostPluginItems=[];bubbleItems=[];nativeStatus=null;window.removeEventListener('offline',reconcileBubbles);window.removeEventListener('online',reconcileBubbles);window.removeEventListener('tanuki:bubble-request',emitBubbles);for(const controller of requests)controller.abort();requests.clear();island.dispose();});
  }
  return {name:'tanuki-island-runtime',inject:['slots','locale'],apply};
});
