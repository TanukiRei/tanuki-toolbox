document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,NS='tanukiSystemSettings';
  function apply(ctx){
    let alive=true,status=null,received=false,opening=false,version=null;
    const listeners=new Set(),requests=new Set(),locale=(__LOCALE_FACTORY__)(ctx,NS,__LOCALES__),t=locale.t;
    let snapshot={status,opening,version};
    const publish=()=>{if(!alive)return;snapshot={status,opening,version};for(const fn of [...listeners])fn();};
    const hasUpdate=()=>!!status&&['available','ready','downloaded','downloading','verifying','installing'].includes(status.phase)||status?.phase==='error'&&typeof status.version==='string';
    function bubbles(){if(alive)window.dispatchEvent(new CustomEvent('tanuki:bubble-state',{detail:{source:'system-updates',items:hasUpdate()?[{id:'dsh-system-update',target:'settings',category:'updates',state:status.phase==='error'?'error':['downloading','verifying','installing'].includes(status.phase)?'running':'action'}]:[]}}));}
    const receive=value=>{if(!alive||!value||typeof value.phase!=='string')return;received=true;status=value;publish();bubbles();};
    const bridge=window.dshDesktop?.updates;
    const off=typeof bridge?.subscribe==='function'?bridge.subscribe(receive):null;
    if(typeof bridge?.status==='function')Promise.resolve(bridge.status()).then(value=>{if(!received)receive(value);}).catch(()=>{});
    window.addEventListener('tanuki:bubble-request',bubbles);
    const useState=()=>{React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());return React.useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn);},()=>snapshot);};
    function Header(){
      const state=useState();
      React.useEffect(()=>{if(version!==null)return;const controller=new AbortController();requests.add(controller);let live=true;const timeout=setTimeout(()=>controller.abort(),10000);
        fetch(new URL('tanuki-toolbox/runtime',document.baseURI),{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)return;const value=await r.json();if(alive&&live&&typeof value.version==='string'){version=value.version;publish();}}).catch(()=>{}).finally(()=>{clearTimeout(timeout);requests.delete(controller);});
        return()=>{live=false;controller.abort();clearTimeout(timeout);requests.delete(controller);};},[]);
      return h('span',{className:'tanuki-system-heading'},h('span',null,t('settings')),state.version?h('small',null,'DSH '+state.version):null);
    }
    function Update(){
      const {status:state,opening:busy}=useState(),available=hasUpdate(),running=!!state&&['checking','downloading','verifying','installing'].includes(state.phase);
      const label=running?t(state.phase==='checking'?'checking':'updating'):available?t('update'):state?.phase==='idle'?t('latest'):t('unavailable');
      async function open(){if(!alive||opening||running||!available||typeof bridge?.open!=='function')return;opening=true;publish();try{await bridge.open();}catch{if(alive)window.dispatchEvent(new CustomEvent('tanuki:notify',{detail:{kind:'error',category:'updates',destination:{page:'updates'},title:{zh:'系统更新',en:'System update'},message:{zh:'无法打开系统更新，请重试。',en:'Could not open the system updater. Please retry.'}}}));}finally{if(alive){opening=false;publish();}}}
      return h('button',{type:'button',className:'tanuki-system-update','data-available':!!available,disabled:busy||running||!available||typeof bridge?.open!=='function',onClick:()=>void open(),title:state?.version?label+' · '+state.version:label},label);
    }
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=__CSS__;document.head.appendChild(style);return()=>style.remove();});
    ctx.slots.inject('settings.header',()=>ctx.slots.register({name:'settings.header',id:'tanuki-settings-version',priority:-1000,locale:NS},Header));
    ctx.slots.inject('settings.action',()=>ctx.slots.register({name:'settings.action',id:'tanuki-system-update',order:-10,locale:NS},Update));
    ctx.effect(()=>()=>{alive=false;off?.();window.removeEventListener('tanuki:bubble-request',bubbles);for(const controller of requests)controller.abort();requests.clear();listeners.clear();window.dispatchEvent(new CustomEvent('tanuki:bubble-state',{detail:{source:'system-updates',items:[]}}));});
  }
  return {name:'tanuki-system-settings',inject:['slots','locale'],apply};
});
