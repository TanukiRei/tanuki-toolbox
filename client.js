window.__ModuleLoader__.load({id:'dsh-local-plugin-center',factory(require){
  'use strict';
  const React=require('react'),h=React.createElement,VERSION="0.5.25";
  const SELF='dsh-local-plugin-center',NS='tanukiCore';
  function apply(ctx){
    let disposed=false,flight=null,again=false,timer;
    const entries=new Map(),loads=new Set();
    ctx.effect(()=>ctx.locale.register(NS,{
      zh:{loading:'正在加载…',failed:'加载失败，请重试',retry:'重试',startFailed:'组件未能启动',description:'集成了各种小组件，让DeepSeek Harness更好用。持续扩展中。',guardSummary:'开启时接管 DSH 快捷方式，关闭时还原。'},
      en:{loading:'Loading…',failed:'Could not load. Please retry.',retry:'Retry',startFailed:'Component could not start',description:'A growing collection of small components that make DeepSeek Harness easier to use.',guardSummary:'Enabling protects DSH shortcuts; disabling restores them.'}
    }));
    const t=ctx.locale.bind(NS);
    // Global switch palette only: preserve native geometry, motion and disabled/focus states.
    ctx.effect(()=>{
      const style=document.createElement('style');style.dataset.tanukiSwitchPalette='ios';
      style.textContent='button[role="switch"][aria-checked="false"]{background-color:#58585b!important;border-color:#58585b!important}button[role="switch"][aria-checked="true"]{background-color:#34c759!important;border-color:#34c759!important}button[role="switch"]>span:only-child{background-color:#fff!important}input[type="checkbox"][role="switch"]{accent-color:#34c759}';
      document.head.appendChild(style);return()=>style.remove();
    });
    function useLocale(){React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());return t;}
    // Source is fetched only after activation. No import() cache or dormant factory registry.
    async function load(name,signal){
      const controller=new AbortController();loads.add(controller);
      const cancel=()=>controller.abort();signal?.addEventListener('abort',cancel,{once:true});
      if(signal?.aborted)controller.abort();
      const timeout=setTimeout(cancel,20000);
      try{
        const url=new URL('tanuki-toolbox/assets/'+name+'.js?v='+VERSION,document.baseURI);
        const answer=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
        if(!answer.ok||answer.headers.get('x-tanuki-version')!==VERSION)throw new Error('Component version unavailable');
        const source=await answer.text();
        if(disposed||controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
        const script=document.createElement('script');let module;
        script.__tanukiRegister=factory=>{module=factory(require);};
        script.textContent=source;
        try{document.head.appendChild(script);}finally{script.remove();delete script.__tanukiRegister;}
        if(!module||typeof module.apply!=='function')throw new Error('Invalid component');
        return module;
      }finally{clearTimeout(timeout);loads.delete(controller);signal?.removeEventListener('abort',cancel);}
    }
    function stop(key,disabled=true){
      const entry=entries.get(key);if(!entry)return;
      entries.delete(key);entry.lifecycle.disabled=disabled;entry.controller.abort();clearTimeout(entry.retry);
      entry.fiber?.dispose();entry.fiber=null;
    }
    function start(key){
      if(disposed||entries.has(key))return;
      const entry={controller:new AbortController(),attempt:0,fiber:null,retry:null,lifecycle:{disabled:false}};entries.set(key,entry);
      const run=async()=>{
        try{
          const module=await load(key,entry.controller.signal);
          if(disposed||entries.get(key)!==entry||entry.controller.signal.aborted)return;
          entry.fiber=ctx.plugin(module,{lifecycle:entry.lifecycle,load});
        }catch(error){
          if(disposed||entries.get(key)!==entry||entry.controller.signal.aborted)return;
          if(++entry.attempt<3)entry.retry=setTimeout(run,entry.attempt*2000);
          else{
            console.error('[Tanuki] Component load failed:',key,error);
            window.dispatchEvent(new CustomEvent('tanuki:notify',{detail:{id:'load:'+key+':'+Date.now(),title:{zh:'组件未能启动',en:'Component could not start'},message:key}}));
          }
        }
      };void run();
    }
    async function refresh(){
      if(disposed)return;
      if(flight){again=true;return flight;}
      flight=(async()=>{
        const result=await ctx.remote.pluginManager.listPlugins();
        if(disposed||!result.ok)return;
        for(const key of ['plugin-center','home','dynamic-island','sidebar']){
          const enabled=result.value.some(row=>row.moduleName===SELF+'/'+key&&row.enabled);
          if(enabled)start(key);else stop(key);
        }
      })().catch(error=>{if(!disposed)console.warn('[Tanuki] Component state unavailable',error);}).finally(()=>{flight=null;if(again&&!disposed){again=false;schedule();}});
      return flight;
    }
    function schedule(){clearTimeout(timer);if(!disposed)timer=setTimeout(()=>void refresh(),100);}
    const off=ctx.remote.$on('plugin-manager/changed',schedule),offReset=ctx.on('connection/reset',schedule);
    // A foreground check recovers missed connection events without an idle polling loop.
    const focus=()=>{if(document.visibilityState==='visible'){for(const [key,entry] of entries)if(!entry.fiber&&entry.attempt>=3)stop(key);schedule();}};
    window.addEventListener('focus',focus);void refresh();
    function LazyView({moduleName,view}){
      const tr=useLocale(),[Component,setComponent]=React.useState(null),[error,setError]=React.useState(false),[retry,setRetry]=React.useState(0);
      React.useEffect(()=>{
        if(view==='summary')return;
        let active=true,fiber;const controller=new AbortController();setComponent(null);setError(false);
        load(moduleName,controller.signal).then(module=>{
          if(!active||disposed)return;
          fiber=ctx.plugin(module,{ready:component=>{if(active)setComponent(()=>component);}});
        }).catch(()=>{if(active&&!controller.signal.aborted)setError(true);});
        return()=>{active=false;controller.abort();fiber?.dispose();};
      },[moduleName,view,retry]);
      if(view==='summary')return tr(moduleName==='guard-settings'?'guardSummary':'description');
      if(Component)return h(Component,{view});
      return h('div',{role:'status',style:{padding:'12px 0',fontSize:13}},tr(error?'failed':'loading'),error?h('button',{type:'button',onClick:()=>setRetry(n=>n+1),style:{marginLeft:12}},tr('retry')):null);
    }
    // Native settings currently hardcodes a gear for custom sections; replace only
    // our strictly matched nav SVG through a removable mask, preserving React ownership.
    ctx.effect(()=>{
      const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 11.5l8 2a4 4 0 0 0 2 0l8-2M10 12.5v3h4v-3"/><rect x="3" y="7" width="18" height="13" rx="2"/></svg>';
      const style=document.createElement('style');style.textContent='[data-tanuki-settings-icon]>svg{background:currentColor;mask:url("data:image/svg+xml,'+encodeURIComponent(svg)+'") center/contain no-repeat;-webkit-mask:url("data:image/svg+xml,'+encodeURIComponent(svg)+'") center/contain no-repeat}[data-tanuki-settings-icon]>svg>*{visibility:hidden}';document.head.appendChild(style);
      const marked=new Set();let frame,observedModal;
      const scan=()=>{frame=undefined;if(disposed)return;const label=ctx.locale.getSnapshot()?.active?.startsWith('en')?'Tanuki Toolbox':'黎猫工具箱';const keep=new Set();
        const modal=document.querySelector('[data-shortcut-modal="settings"][role="dialog"]');if(modal!==observedModal){modalObserver.disconnect();observedModal=modal;if(modal)modalObserver.observe(modal,{childList:true,subtree:true,characterData:true});}
        if(modal)for(const button of modal.querySelectorAll(':scope > nav > div > button')){
          const text=button.querySelector(':scope > span'),icon=button.querySelector(':scope > svg');if(text?.textContent?.trim()===label&&icon){keep.add(button);if(!marked.has(button)){button.setAttribute('data-tanuki-settings-icon','');marked.add(button);}}
        }
        for(const button of marked)if(!keep.has(button)){button.removeAttribute('data-tanuki-settings-icon');marked.delete(button);}
      };
      const schedule=()=>{if(frame===undefined)frame=requestAnimationFrame(scan);};
      const modalObserver=new MutationObserver(schedule),observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true});const off=ctx.locale.subscribe(schedule);schedule();
      return()=>{observer.disconnect();modalObserver.disconnect();off();if(frame!==undefined)cancelAnimationFrame(frame);for(const button of marked)button.removeAttribute('data-tanuki-settings-icon');marked.clear();style.remove();};
    });
    ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'tanuki-toolbox',order:80,label:()=>ctx.locale.getSnapshot()?.active?.startsWith('en')?'Tanuki Toolbox':'黎猫工具箱',locale:NS},()=>h(LazyView,{moduleName:'toolbox-settings'})));
    ctx.slots.inject('plugins.bundle.config',()=>ctx.slots.register({name:'plugins.bundle.config',key:SELF,locale:NS},props=>h(LazyView,{...props,moduleName:'toolbox-details'})));
    ctx.slots.inject('plugins.row.config',()=>ctx.slots.register({name:'plugins.row.config',key:SELF+'#tanuki-startup-guard',locale:NS},props=>h(LazyView,{...props,moduleName:'guard-settings'})));
    ctx.effect(()=>()=>{disposed=true;clearTimeout(timer);off();offReset();window.removeEventListener('focus',focus);for(const key of [...entries.keys()])stop(key,false);for(const controller of loads)controller.abort();loads.clear();});
  }
  return {name:'tanuki-toolbox',inject:['slots','locale','remote','remote.pluginManager'],apply};
}});
