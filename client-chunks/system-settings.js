document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,NS='tanukiSystemSettings';
  function apply(ctx){
    let alive=true,status=null,received=false,opening=false,version=null;
    const listeners=new Set(),requests=new Set(),locale=(function createToolboxLocale(ctx, namespace, dictionaries) {
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
})(ctx,NS,{"zh":{"settings":"设置","update":"更新系统","latest":"已是最新","checking":"正在检查…","updating":"正在更新…","unavailable":"暂无法检查更新"},"en":{"settings":"Settings","update":"Update system","latest":"Up to date","checking":"Checking…","updating":"Updating…","unavailable":"Updates unavailable"}}),t=locale.t;
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
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=".tanuki-system-heading{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;line-height:1.5}.tanuki-system-heading small{color:var(--dsw-alias-label-tertiary);font-size:10px;font-weight:400;overflow-wrap:anywhere}.tanuki-system-update{box-sizing:border-box;min-height:28px;padding:3px 10px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm,6px);color:var(--dsw-alias-label-tertiary);background:transparent;font:inherit;font-size:12px;white-space:nowrap;cursor:default}.tanuki-system-update[data-available=true]{background:#5686fe;border-color:#5686fe;color:#fff}.tanuki-system-update:enabled{cursor:pointer}.tanuki-system-update:enabled:hover{filter:brightness(1.08)}.tanuki-system-update:focus-visible{outline:2px solid var(--dsw-focus-ring-color,#5686fe);outline-offset:2px}.tanuki-system-update:disabled{opacity:.55}.tanuki-system-update[data-available=true]:disabled{opacity:.7}\n/* The toolbox uses the category-aware global badge on the Settings entry. */\n[data-slot=\"sidebar.toggle.badge\"] [role=\"img\"][class$=\"_badge\"]{display:none!important}\n";document.head.appendChild(style);return()=>style.remove();});
    ctx.slots.inject('settings.header',()=>ctx.slots.register({name:'settings.header',id:'tanuki-settings-version',priority:-1000,locale:NS},Header));
    ctx.slots.inject('settings.action',()=>ctx.slots.register({name:'settings.action',id:'tanuki-system-update',order:-10,locale:NS},Update));
    ctx.effect(()=>()=>{alive=false;off?.();window.removeEventListener('tanuki:bubble-request',bubbles);for(const controller of requests)controller.abort();requests.clear();listeners.clear();window.dispatchEvent(new CustomEvent('tanuki:bubble-state',{detail:{source:'system-updates',items:[]}}));});
  }
  return {name:'tanuki-system-settings',inject:['slots','locale'],apply};
});
