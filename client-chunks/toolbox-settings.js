document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,NS='tanukiSettings';
  const {Switch}=require('@deepseek-ai/dsh-client-ui-primitives');
  const createAudioPreview=function createAudioPreview({baseURI} = {}) {
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
};
  // Static component artwork only; never load component business modules for settings icons.
  const componentIcons={"plugin-center":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiByeD0iMiIgZmlsbD0iIzg2QjNFRSIvPjxyZWN0IHg9IjEzIiB5PSIzIiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiByeD0iMiIgZmlsbD0iIzc4QjVBNyIvPjxyZWN0IHg9IjMiIHk9IjEzIiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiByeD0iMiIgZmlsbD0iIzc4QjVBNyIvPjxyZWN0IHg9IjEzIiB5PSIxMyIgd2lkdGg9IjgiIGhlaWdodD0iOCIgcng9IjIiIGZpbGw9IiM4NkIzRUUiLz48L3N2Zz4NCg==","home":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBkPSJNMyAxMC41IDExIDMuOGExLjYgMS42IDAgMCAxIDIgMGw4IDYuN2ExIDEgMCAwIDEtLjY1IDEuOEgxOVYxOWEyIDIgMCAwIDEtMiAySDdhMiAyIDAgMCAxLTItMnYtNi43SDMuNjVBMSAxIDAgMCAxIDMgMTAuNVoiIGZpbGw9IiM4NkIzRUUiLz48cGF0aCBkPSJNOSAyMXYtN2ExIDEgMCAwIDEgMS0xaDRhMSAxIDAgMCAxIDEgMXY3WiIgZmlsbD0iIzI0MzQ0NyIvPjxyZWN0IHg9IjEwIiB5PSIxNCIgd2lkdGg9IjQiIGhlaWdodD0iNyIgcng9IjEiIGZpbGw9IiM3OEI1QTciLz48L3N2Zz4NCg==","dynamic-island":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cmVjdCB4PSIyIiB5PSI1IiB3aWR0aD0iMjAiIGhlaWdodD0iMTQiIHJ4PSI3IiBmaWxsPSIjODZCM0VFIi8+PGNpcmNsZSBjeD0iNy41IiBjeT0iMTIiIHI9IjIuNSIgZmlsbD0iIzI0MzQ0NyIvPjxjaXJjbGUgY3g9IjcuNSIgY3k9IjEyIiByPSIxLjUiIGZpbGw9IiM3OEI1QTciLz48cmVjdCB4PSIxMiIgeT0iOSIgd2lkdGg9IjciIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiMyNDM0NDciLz48cmVjdCB4PSIxMiIgeT0iMTMiIHdpZHRoPSI1IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjMjQzNDQ3Ii8+PC9zdmc+DQo=","startup-guard":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBkPSJtMTIgMiA4IDN2NmMwIDUtMy41IDguNS04IDExLTQuNS0yLjUtOC02LTgtMTFWNVoiIGZpbGw9IiM4NkIzRUUiLz48cGF0aCBkPSJtOCAxMSAzIDMgNS02IiBmaWxsPSJub25lIiBzdHJva2U9IiMyNDM0NDciIHN0cm9rZS13aWR0aD0iMy41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cGF0aCBkPSJtOCAxMSAzIDMgNS02IiBmaWxsPSJub25lIiBzdHJva2U9IiM3OEI1QTciIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+DQo=","sidebar":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cmVjdCB4PSIyIiB5PSIzIiB3aWR0aD0iMjAiIGhlaWdodD0iMTgiIHJ4PSIzIiBmaWxsPSIjODZCM0VFIi8+PHJlY3QgeD0iNCIgeT0iNSIgd2lkdGg9IjUiIGhlaWdodD0iMTQiIHJ4PSIxLjUiIGZpbGw9IiM3OEI1QTciLz48cmVjdCB4PSIxMSIgeT0iNSIgd2lkdGg9IjkiIGhlaWdodD0iMTQiIHJ4PSIxLjUiIGZpbGw9IiMyNDM0NDciLz48Y2lyY2xlIGN4PSI2LjUiIGN5PSI4IiByPSIuOCIgZmlsbD0iIzI0MzQ0NyIvPjxjaXJjbGUgY3g9IjYuNSIgY3k9IjEyIiByPSIuOCIgZmlsbD0iIzI0MzQ0NyIvPjxjaXJjbGUgY3g9IjYuNSIgY3k9IjE2IiByPSIuOCIgZmlsbD0iIzI0MzQ0NyIvPjwvc3ZnPg0K","composer":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjODZiM2VlIiBzdHJva2Utd2lkdGg9IjEuNyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNNSA0aDE0YTIgMiAwIDAgMSAyIDJ2MTBhMiAyIDAgMCAxLTIgMkg5bC01IDN2LTNINWEyIDIgMCAwIDEtMi0yVjZhMiAyIDAgMCAxIDItMnpNNyA5aDEwTTcgMTNoMTAiLz48Y2lyY2xlIGN4PSIxMCIgY3k9IjkiIHI9IjEuNSIgZmlsbD0iIzI1MjUyNSIvPjxjaXJjbGUgY3g9IjE1IiBjeT0iMTMiIHI9IjEuNSIgZmlsbD0iIzI1MjUyNSIvPjwvc3ZnPgo="};
  function ComponentIcon({name}){
    return h('img',{className:'tanuki-settings-component-icon',src:componentIcons[name],width:24,height:24,alt:'','aria-hidden':true});
  }
  const divider=short=>h('hr',{className:'tanuki-settings-divider'+(short?' tanuki-settings-divider-short':''),'aria-hidden':true});
  function SettingsCard({name,title,description,control,children,t,onCollapse,enabled}){
    const [expanded,setExpanded]=React.useState(false),[mounted,setMounted]=React.useState(false),button=React.useRef(null),id=React.useId();
    const hasDetails=React.Children.toArray(children).length>0;
    function collapse(fromBottom=false){
      setExpanded(false);onCollapse?.();
      if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)setMounted(false);
      if(fromBottom)button.current?.focus({preventScroll:true});
    }
    React.useLayoutEffect(()=>{if(!enabled){setExpanded(false);onCollapse?.();if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)setMounted(false);}},[enabled]);
    const chevron=h('svg',{viewBox:'0 0 24 24',width:16,height:16,fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'m6 9 6 6 6-6'}));
    return h('section',{className:'tanuki-settings-card','data-tanuki-setting':name},
      h('header',{className:'tanuki-settings-header'},h('h3',null,
        hasDetails?h('button',{ref:button,type:'button',className:'tanuki-settings-expand','aria-expanded':expanded,'aria-controls':id,'aria-label':t(expanded?'collapseSettings':'expandSettings')+' · '+title,title:t(expanded?'collapseSettings':'expandSettings'),onClick:()=>{if(expanded)collapse();else{setMounted(true);setExpanded(true);}}},h(ComponentIcon,{name}),h('span',{className:'tanuki-settings-header-label'},title),chevron):h(React.Fragment,null,h(ComponentIcon,{name}),h('span',null,title))),h('div',{className:'tanuki-settings-header-actions'},control)),
      description?h('p',{className:'tanuki-settings-description'},description):null,
      hasDetails?h('div',{id,className:'tanuki-settings-fold','data-expanded':expanded,'aria-hidden':!expanded,inert:!expanded,onTransitionEnd:event=>{if(event.target===event.currentTarget&&event.propertyName==='grid-template-rows'&&!expanded)setMounted(false);}},
        h('div',{className:'tanuki-settings-fold-inner'},mounted?h(React.Fragment,null,h('fieldset',{className:'tanuki-component-options','data-disabled':!enabled,disabled:!enabled},children),h('button',{type:'button',className:'tanuki-settings-collapse','aria-label':t('collapseSettings'),onClick:()=>collapse(true)},chevron)):null)):null);
  }
  function apply(ctx,{ready}){
    let alive=true;const requests=new Set(),decoders=new Set(),previews=new Set();
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
})(ctx,NS,{"zh":{"title":"黎猫工具箱 · 基础设置","plugin-center":"插件中心","home":"起始页","dynamic-island":"消息中心","startup-guard":"启动保护","sidebar":"快捷栏","enabled":"已启用","disabled":"未启用","volume":"音量","save":"保存","choose":"选择文件","restore":"恢复默认","defaultSound":"默认提示音","audioLimit":"支持 MP3、WAV、OGG，最大 5 MiB。","error":"操作未完成，请检查连接或所选文件后重试。","guardBehavior":"启动保护开启时接管现有 DSH 快捷方式，关闭时按备份还原。","guardScope":"保留手动改动；不保证覆盖 Windows 11 缓存的固定项或直接启动原始 exe。","guardStatus":"快捷方式状态","status_pending":"等待状态","status_enabling":"正在启用","status_restoring":"正在还原","status_enabled":"已保护","status_restored":"已还原","status_none":"无可管理入口","status_partial":"部分完成","status_error":"处理失败","toggle":"启用或停用","permission_default":"尚未授权","permission_granted":"已授权","permission_denied":"已被阻止，请在浏览器或系统设置中修改","permission_pending":"等待授权…","permission_unsupported":"当前环境不支持","categories":"允许通知","category_plugins":"插件","category_tasks":"任务","category_updates":"更新","bubbles":"全局气泡","systemNotifications":"系统通知","sound":"提示音","fileName":"文件名","composer":"对话框优化","timeStats":"时间统计","timeStatsHint":"在对话框下方显示当前任务的进行时间与完成耗时。","modelSelection":"模型选择","modelSelectionHint":"使用卡片选择模型、推理等级、速度与输出详略。","expandSettings":"展开细分设置","collapseSettings":"收拢设置","fileMenu":"文件右键","fileMenuHint":"任务中的文件增加右键操作。","autostart":"开机自动启动DeepSeek Harness","autostartHint":"登录 Windows 后通过保护入口启动，关闭启动保护时同步关闭。","autostartUnsupported":"此项目前支持 Windows 登录后自动启动。","autostartChanged":"自启动入口已被手动修改，请先手动处理该入口后重试。","category_pluginsHint":"包含插件的待更新，更新错误，更新中等。","category_tasksHint":"包含任务的进行中、已完成、待补充、错误等。","category_updatesHint":"DeepSeek Harness本体更新通知。","inApp":"灵动岛","inAppHint":"应用内顶部消息提示。","systemNotificationsHint":"当应用未聚焦/最小化/收起的时候会发送系统消息。","bubblesHint":"对应的消息会以气泡形式持久提示。","soundHint":"消息提示伴随提示音。"},"en":{"title":"Tanuki Toolbox · Basic settings","plugin-center":"Plugin Center","home":"Start Page","dynamic-island":"Message Center","startup-guard":"Startup Guard","sidebar":"Quick Bar","enabled":"Enabled","disabled":"Disabled","volume":"Volume","save":"Save","choose":"Choose file","restore":"Restore default","defaultSound":"Default notification sound","audioLimit":"MP3, WAV and OGG only, up to 5 MiB.","error":"The action failed. Check the connection or selected file and retry.","guardBehavior":"Enabling startup guard takes over existing DSH shortcuts; disabling restores their backups.","guardScope":"Manual changes are preserved. Cached Windows 11 pins or launching the original exe directly may not be covered.","guardStatus":"Shortcut status","status_pending":"Pending","status_enabling":"Enabling","status_restoring":"Restoring","status_enabled":"Protected","status_restored":"Restored","status_none":"No managed entries","status_partial":"Partially completed","status_error":"Failed","toggle":"Enable or disable","permission_default":"Not granted","permission_granted":"Granted","permission_denied":"Blocked; change browser or system settings","permission_pending":"Waiting for permission…","permission_unsupported":"Unavailable in this environment","categories":"Allow notifications","category_plugins":"Plugins","category_tasks":"Tasks","category_updates":"Updates","bubbles":"Global bubbles","systemNotifications":"System notifications","sound":"Notification sound","fileName":"File name","composer":"Composer Enhancements","timeStats":"Time statistics","timeStatsHint":"Show running and completed turn durations below the composer.","modelSelection":"Model selection","modelSelectionHint":"Use compact controls for model, effort, speed, and output detail.","expandSettings":"Expand settings","collapseSettings":"Collapse settings","fileMenu":"File right-click","fileMenuHint":"Add right-click actions to files in tasks.","autostart":"Start DeepSeek Harness automatically at login","autostartHint":"Use Protected Launch after Windows sign-in. Disabling Startup Guard also removes this startup entry.","autostartUnsupported":"Automatic startup currently supports Windows sign-in.","autostartChanged":"The startup entry was manually changed. Resolve it manually before retrying.","category_pluginsHint":"Plugin updates available, update errors, updates in progress, and more.","category_tasksHint":"Tasks in progress, completed, awaiting input, failed, and more.","category_updatesHint":"DeepSeek Harness application update notifications.","inApp":"Dynamic Island","inAppHint":"Message banners at the top of the application.","systemNotificationsHint":"Send system notifications when the app is unfocused, minimized, or hidden.","bubblesHint":"Show persistent notification badges beside the relevant items.","soundHint":"Play a sound with message notifications."}}),t=toolboxLocale.t;
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=".tanuki-settings-subheader{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}.tanuki-base-settings h4{font-size:13px;font-weight:400;margin:0}.tanuki-base-settings h5{font-size:13px;font-weight:500;margin:14px 0 6px}.tanuki-sound-file{margin:16px 0}.tanuki-settings-card .tanuki-settings-description:last-child{margin-bottom:0}.tanuki-base-settings{padding:20px;max-width:850px;color:inherit}.tanuki-base-settings h2{font-size:20px}.tanuki-base-settings .tanuki-settings-card{padding:20px;margin:18px 0;border:1px solid var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 14%,transparent));border-radius:16px;background:var(--dsw-alias-bg-layer-1,color-mix(in srgb,currentColor 4%,transparent));box-shadow:0 4px 16px rgb(0 0 0 / 6%);box-sizing:border-box;min-width:0}.tanuki-settings-component-icon{width:24px;height:24px;flex:0 0 24px;display:block}.tanuki-base-settings .tanuki-settings-header h3{display:flex;align-items:center;gap:10px;min-width:0;overflow-wrap:anywhere}.tanuki-base-settings .tanuki-settings-divider{display:block;height:0;padding:0;border:0;border-top:1px solid var(--dsw-alias-border-l2,color-mix(in srgb,currentColor 14%,transparent));margin:18px 0;width:auto;opacity:1}.tanuki-base-settings .tanuki-settings-divider-short{margin:18px 12px}.tanuki-settings-header{display:flex;align-items:center;justify-content:space-between;gap:16px}.tanuki-base-settings h3{font-size:15px;margin:0}.tanuki-base-settings p{font-size:13px;line-height:1.6}.tanuki-settings-description{color:var(--dsw-alias-label-tertiary);margin:7px 0 18px}.tanuki-base-settings label{display:flex;gap:10px;align-items:center;font-size:13px;margin:12px 0}.tanuki-base-settings input[type=range]{width:100%;accent-color:var(--dsw-alias-state-business-primary,#cf944c)}.tanuki-base-settings button:not([role=switch]){font:inherit;color:inherit;padding:8px 12px;border:1px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:7px;background:transparent;cursor:pointer}.tanuki-base-settings button:disabled{opacity:.45;cursor:default}.tanuki-base-settings button:focus-visible,.tanuki-base-settings input:focus-visible{outline:2px solid var(--dsw-focus-ring-color,#cf944c);outline-offset:3px}.tanuki-settings-note{color:var(--dsw-alias-label-tertiary);font-size:12px!important}.tanuki-base-settings [role=alert]{color:var(--dsw-alias-state-error-primary)}.tanuki-base-settings li{font-size:12px;overflow-wrap:anywhere}.tanuki-notification-categories{border:0;padding:0;margin:16px 0;display:flex;gap:20px;flex-wrap:wrap}.tanuki-notification-categories legend{font-size:13px;margin-bottom:4px}.tanuki-notification-categories label{margin:4px 0}.tanuki-notification-categories input{accent-color:var(--dsw-alias-state-business-primary,#cf944c)}.tanuki-bubble-setting{display:flex;justify-content:space-between;align-items:center;gap:20px;margin:18px 0;font-size:13px}.tanuki-bubble-setting p{margin:5px 0 0}.tanuki-sound-setting{margin-top:22px}.tanuki-sound-name{margin:0 0 8px;overflow-wrap:anywhere}.tanuki-base-settings .tanuki-volume{display:grid;grid-template-columns:1fr auto;gap:8px;margin:8px 0}.tanuki-volume input{grid-column:1/-1}.tanuki-volume output{font-variant-numeric:tabular-nums}.tanuki-audio-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.tanuki-audio-actions button{min-width:0;min-height:36px;overflow-wrap:anywhere;font-size:13px!important}.tanuki-base-settings input[hidden]{display:none}.tanuki-system-permission{font-size:12px;margin:14px 0}.tanuki-system-permission>span{margin-left:12px;color:var(--dsw-alias-label-tertiary)}\n.tanuki-base-settings .tanuki-settings-title{display:flex;align-items:baseline;flex-wrap:wrap;column-gap:9px;row-gap:3px;}\n.tanuki-base-settings .tanuki-settings-version{font-size:12px;line-height:18px;font-weight:400;white-space:nowrap;color:var(--dsw-alias-label-secondary,#aaa);font-variant-numeric:tabular-nums;}\n.tanuki-settings-header-actions{display:flex;align-items:center;gap:10px;flex:none;}\n.tanuki-base-settings .tanuki-settings-header h3{flex:1;}\n.tanuki-base-settings button.tanuki-settings-expand{display:flex;align-items:center;gap:10px;flex:1;width:100%;min-width:0;min-height:30px;padding:3px 5px 3px 0;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-weight:inherit;text-align:left;}\n.tanuki-settings-header-label{flex:1;min-width:0;overflow-wrap:anywhere;}\n.tanuki-settings-expand>svg{flex:none;}\n.tanuki-settings-expand svg{transition:transform .24s ease;}\n.tanuki-settings-expand[aria-expanded=true] svg{transform:rotate(180deg);}\n.tanuki-base-settings .tanuki-settings-card>.tanuki-settings-description{margin-bottom:0;}\n.tanuki-settings-fold{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .26s ease,opacity .18s ease;}\n.tanuki-settings-fold[data-expanded=true]{grid-template-rows:1fr;opacity:1;}\n.tanuki-settings-fold-inner{min-height:0;overflow:hidden;}\n.tanuki-base-settings button.tanuki-settings-collapse{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-height:calc(max(1lh,16px) + 16px);margin-top:16px;padding:8px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,#aaa);font-size:12px;}\n.tanuki-settings-collapse svg{transform:rotate(180deg);}\n@media(prefers-reduced-motion:reduce){.tanuki-settings-fold,.tanuki-settings-expand svg{transition:none;}}\n.tanuki-component-options{border:0;margin:0;padding:0;min-width:0;color:inherit;transition:opacity .18s ease}\n.tanuki-component-options[data-disabled=true]{opacity:.45;filter:grayscale(1)}\n.tanuki-notification-categories{gap:8px;margin:18px 0}\n.tanuki-notification-categories legend{margin-bottom:10px}\n.tanuki-base-settings button.tanuki-category-button{min-width:66px;min-height:32px;border:1px solid #58585b;background:#58585b;color:#fff;border-radius:8px;padding:6px 15px;font-size:13px;transition:background-color .15s,border-color .15s,filter .15s}\n.tanuki-base-settings button.tanuki-category-button[aria-pressed=true]{background:#34c759;border-color:#34c759}\n.tanuki-base-settings button.tanuki-category-button:hover:not(:disabled){filter:brightness(1.08)}\n.tanuki-system-permission>.tanuki-bubble-setting{margin-bottom:0}\n@media(prefers-reduced-motion:reduce){.tanuki-component-options,.tanuki-base-settings button.tanuki-category-button{transition:none}}\n";document.head.appendChild(style);return()=>style.remove();});
    async function request(path,options={}){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);requests.add(controller);
      try{const r=await fetch(new URL('tanuki-toolbox/'+path,document.baseURI),{...options,credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'X-Tanuki-Settings':'1',...options.headers}});if(!r.ok)throw new Error(String(r.status));return await r.json();}
      finally{clearTimeout(timer);requests.delete(controller);}
    }
    function Settings({view}={}){
      React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
      const [settings,setSettings]=React.useState(null),[rows,setRows]=React.useState([]),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(false),[volume,setVolume]=React.useState(100),[switchBusy,setSwitchBusy]=React.useState(false),[permission,setPermission]=React.useState(()=>typeof window.Notification==='function'?window.Notification.permission:'unsupported');
      const [autostart,setAutostart]=React.useState(null),[autostartBusy,setAutostartBusy]=React.useState(false);
      const generation=React.useRef(0),operation=React.useRef(false),switchLock=React.useRef(false),autostartLock=React.useRef(false),preview=React.useRef(null),fileInput=React.useRef(null),refreshRows=React.useRef(null);
      const cancel=()=>{for(const controller of requests)controller.abort();for(const decoder of decoders)void decoder.close().catch(()=>{});decoders.clear();};
      React.useEffect(()=>{++generation.current;let mounted=true,read=0;const player=createAudioPreview({baseURI:document.baseURI});preview.current=player;previews.add(player);
        const refresh=async()=>{const token=++read;try{const r=await ctx.remote.pluginManager.listPlugins();if(alive&&mounted&&token===read&&r.ok)setRows(r.value);}catch{}try{const value=await request('autostart');if(alive&&mounted&&token===read)setAutostart(value);}catch{if(alive&&mounted&&token===read)setAutostart(null);}};refreshRows.current=refresh;void refresh();const off=ctx.remote.$on('plugin-manager/changed',refresh);const syncPermission=()=>{if(alive&&mounted)setPermission(typeof window.Notification==='function'?window.Notification.permission:'unsupported');};window.addEventListener('focus',syncPermission);
        request('settings').then(s=>{if(alive&&mounted){setSettings(s);setVolume(s.island.volume);}}).catch(()=>{if(alive&&mounted)setError(true);});
        return()=>{mounted=false;++generation.current;operation.current=false;switchLock.current=false;refreshRows.current=null;cancel();off();window.removeEventListener('focus',syncPermission);player.dispose();previews.delete(player);if(preview.current){preview.current.dispose();previews.delete(preview.current);preview.current=null;}};
      },[]);
      async function run(action){
        if(operation.current||!alive)return;operation.current=true;const epoch=generation.current,valid=()=>alive&&epoch===generation.current;setBusy(true);setError(false);preview.current?.stop();
        try{const value=await action(valid);if(!valid()||!value)return;setSettings(value);setVolume(value.island.volume);if(value.island.soundEnabled===false&&preview.current){preview.current.dispose();previews.delete(preview.current);preview.current=null;}window.dispatchEvent(new CustomEvent('tanuki:settings-changed'));}
        catch{if(valid())setError(true);}finally{if(valid()){operation.current=false;setBusy(false);}}
      }
      const change=(path,options)=>run(()=>request(path,options));
      const patch=island=>change('settings',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({island})});
      async function toggleAutostart(enabled){
        if(autostartLock.current||!alive)return;autostartLock.current=true;setAutostartBusy(true);setError(false);const epoch=generation.current,valid=()=>alive&&epoch===generation.current;
        try{const value=await request('autostart',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({enabled})});if(valid())setAutostart(value);}
        catch{if(valid())setError(true);}finally{if(valid()){autostartLock.current=false;setAutostartBusy(false);}}
      }
      async function toggle(row,enabled){
        if(switchLock.current||!alive||!row||row.entryId===undefined||row.readOnlyReason!==undefined)return;
        switchLock.current=true;setSwitchBusy(true);setError(false);const epoch=generation.current,valid=()=>alive&&epoch===generation.current;
        try{const r=await ctx.remote.pluginManager.setPluginEnabled(row.entryId,enabled);if(!valid())return;if(!r.ok)throw new Error('Toggle failed');await refreshRows.current?.();}
        catch{if(valid())setError(true);}finally{if(valid()){switchLock.current=false;setSwitchBusy(false);}}
      }
      function audition(value){
        if(busy||!settings)return;if(settings.island.soundEnabled===false||value===0){preview.current?.stop();return;}if(!preview.current){preview.current=createAudioPreview({baseURI:document.baseURI});previews.add(preview.current);}const epoch=generation.current;
        // Invoke synchronously in the input gesture; the shared module unlocks audio before awaiting I/O.
        try{Promise.resolve(preview.current.play({volume:value,audio:settings.island.audio})).then(ok=>{if(ok===false&&alive&&generation.current===epoch)setError(true);}).catch(()=>{if(alive&&generation.current===epoch)setError(true);});}catch{setError(true);}
      }
      function toggleSystemNotifications(enabled){
        if(!enabled){void patch({systemNotifications:false});return;}
        void run(async valid=>{
          if(typeof window.Notification!=='function'){setPermission('unsupported');return;}
          let permission=window.Notification.permission;
          if(permission==='default'){
            setPermission('pending');
            try{permission=await window.Notification.requestPermission();}
            catch{if(valid())setPermission(window.Notification.permission);throw new Error('Permission request failed');}
          }
          if(!valid())return;
          setPermission(permission);
          return request('settings',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({island:{systemNotifications:permission==='granted'}})});
        });
      }
      async function upload(event){
        const file=event.target.files?.[0];event.target.value='';if(!file)return;
        const ext=file.name.split('.').pop().toLowerCase(),type={mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg'}[ext];
        if(!type||file.size>5*1024*1024||!file.size){setError(true);return;}
        await run(async valid=>{let decoder;try{
          const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('Audio decoding unavailable');decoder=new Audio();decoders.add(decoder);
          const bytes=await file.arrayBuffer();if(!valid())return;await decoder.decodeAudioData(bytes);
        }finally{if(decoder&&decoders.delete(decoder))void decoder.close().catch(()=>{});}
        if(!valid())return;return request('settings/audio',{method:'PUT',headers:{'content-type':type,'x-audio-name':encodeURIComponent(file.name)},body:file});});
      }
      const names=view==='composer'?['composer']:['startup-guard','sidebar','home','composer','dynamic-island','plugin-center'];
      const localized=text=>text===undefined?'':toolboxLocale.text(text);
      return h('div',{className:'tanuki-base-settings'},h('h2',{className:'tanuki-settings-title'},h('span',null,t('title')),h('small',{className:'tanuki-settings-version'},'v'+"0.6.20")),error?h('p',{role:'alert'},t('error')):null,
        ...names.map(key=>{const row=rows.find(r=>r.moduleName==='dsh-local-plugin-center/'+key),title=localized(row?.meta?.title)||t(key),description=localized(row?.meta?.description);return h(SettingsCard,{key,name:key,title,description,t,enabled:!!row?.enabled,onCollapse:()=>preview.current?.stop(),control:h(Switch,{checked:!!row?.enabled,label:t('toggle')+' '+title,disabled:switchBusy||!row||row.entryId===undefined||row.readOnlyReason!==undefined,onChange:enabled=>void toggle(row,enabled)})},
          key==='startup-guard'?h(React.Fragment,null,divider(false),h('div',{className:'tanuki-bubble-setting'},h('div',null,h('span',null,t('autostart')),h('p',{className:'tanuki-settings-note'},t(autostart?.supported===false?'autostartUnsupported':autostart?.status==='changed'?'autostartChanged':'autostartHint'))),h(Switch,{checked:autostart?.enabled===true,label:t('autostart'),disabled:autostartBusy||switchBusy||!autostart?.supported||!row?.enabled,onChange:enabled=>void toggleAutostart(enabled)}))):null,
          key==='composer'?h('div',{className:'tanuki-composer-settings'},divider(false),...['timeStats','modelSelection','fileMenu'].map((flag,index)=>h(React.Fragment,{key:flag},index>0?divider(true):null,h('div',{className:'tanuki-bubble-setting'},h('div',null,h('span',null,t(flag)),h('p',{className:'tanuki-settings-note'},t(flag+'Hint'))),h(Switch,{checked:settings?.composer?.[flag]===true,label:t(flag),disabled:busy||!settings,onChange:enabled=>change('settings',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({composer:{[flag]:enabled}})})}))))):null,
          key==='dynamic-island'?divider(false):null,
          key==='dynamic-island'?h(React.Fragment,null,
            h('fieldset',{className:'tanuki-notification-categories',disabled:busy||!settings},h('legend',null,t('categories')),...['plugins','tasks','updates'].map(category=>h('button',{key:category,type:'button',className:'tanuki-category-button','aria-pressed':settings?.island.categories?.[category]!==false,title:t('category_'+category+'Hint'),onClick:()=>patch({categories:{[category]:settings?.island.categories?.[category]===false}})},t('category_'+category)))),
            divider(true),
            h('div',{className:'tanuki-bubble-setting'},h('div',null,h('span',null,t('inApp')),h('p',{className:'tanuki-settings-note'},t('inAppHint'))),h(Switch,{checked:settings?.island.inApp!==false,label:t('inApp'),disabled:busy||!settings,onChange:inApp=>patch({inApp})})),
            divider(true),
            h('div',{className:'tanuki-system-permission'},h('div',{className:'tanuki-bubble-setting'},h('div',null,h('span',null,t('systemNotifications')),h('p',{className:'tanuki-settings-note'},t('systemNotificationsHint'))),h(Switch,{checked:settings?.island.systemNotifications===true&&permission==='granted',label:t('systemNotifications'),disabled:busy||!settings||permission==='pending'||permission==='unsupported',onChange:toggleSystemNotifications})),['denied','pending','unsupported'].includes(permission)?h('p',{className:'tanuki-settings-note',role:'status'},t('permission_'+permission)):null),
            divider(true),
            h('div',{className:'tanuki-bubble-setting'},h('div',null,h('span',null,t('bubbles')),h('p',{className:'tanuki-settings-note'},t('bubblesHint'))),h(Switch,{checked:settings?.island.bubbles!==false,label:t('bubbles'),disabled:busy||!settings,onChange:bubbles=>patch({bubbles})})),
            divider(true),
            h('div',{className:'tanuki-sound-setting'},h('div',{className:'tanuki-bubble-setting'},h('div',null,h('span',null,t('sound')),h('p',{className:'tanuki-settings-note'},t('soundHint'))),h(Switch,{checked:settings?.island.soundEnabled!==false,label:t('sound'),disabled:busy||!settings,onChange:soundEnabled=>patch({soundEnabled})})),h('fieldset',{className:'tanuki-component-options','data-disabled':settings?.island.soundEnabled===false,disabled:settings?.island.soundEnabled===false},h('label',{className:'tanuki-volume'},h('span',null,t('volume')),h('output',null,volume+'%'),h('input',{type:'range',min:0,max:100,step:1,value:volume,disabled:busy||!settings,'aria-label':t('volume'),onChange:e=>setVolume(Number(e.target.value)),onPointerUp:e=>audition(Number(e.currentTarget.value)),onPointerCancel:()=>preview.current?.stop(),onKeyUp:e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))audition(Number(e.currentTarget.value));}})),
            h('div',{className:'tanuki-sound-file'},h('h5',{className:'tanuki-sound-name'},settings?.island.audio?.name||t('defaultSound'))),h('input',{ref:fileInput,type:'file',hidden:true,accept:'.mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg',disabled:busy||!settings,onChange:upload}),
            h('div',{className:'tanuki-audio-actions'},h('button',{type:'button',disabled:busy||!settings||volume===settings.island.volume,onClick:()=>patch({volume})},t('save')),h('button',{type:'button',disabled:busy||!settings,onClick:()=>fileInput.current?.click()},t('choose')),h('button',{type:'button',disabled:busy||!settings,onClick:()=>change('settings/audio',{method:'DELETE'})},t('restore'))),h('p',{className:'tanuki-settings-note'},t('audioLimit'))))):
          null); }));
    }
    ctx.effect(()=>()=>{alive=false;for(const request of requests)request.abort();requests.clear();for(const decoder of decoders)void decoder.close().catch(()=>{});decoders.clear();for(const preview of previews)preview.dispose();previews.clear();});ready(Settings);
  }
  return {name:'tanuki-base-settings',inject:['locale','remote','remote.pluginManager'],apply};
});
