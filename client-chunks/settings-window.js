document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,{createPortal}=require('react-dom'),{useModalLayer}=require('@deepseek-ai/dsh-client-ui-primitives'),NS='tanukiSettingsWindow';
  function apply(ctx){
    let alive=true,visible=false;const listeners=new Set(),decorations=new Set(),locale=(function createToolboxLocale(ctx, namespace, dictionaries) {
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
})(ctx,NS,{"zh":{"close":"关闭设置"},"en":{"close":"Hide settings"}});
    const publish=value=>{if(!alive||visible===value)return;visible=value;for(const fn of [...listeners])fn();window.dispatchEvent(new CustomEvent('tanuki:settings-visibility',{detail:{visible}}));};
    // Decorate the existing owner; its child-slot declarations and authorized
    // renderSlot face remain native. Never declare the same child slots twice.
    function decorate(slot,predicate,create,extendInject){
      let stopped=false,current=null,original=null,wrapper=null,descriptor=null,injectDescriptor=null,injectWrapper=null,scanning=false;
      const restore=()=>{if(current?.component===wrapper)Object.defineProperty(current,'component',descriptor);if(injectWrapper&&current?.inject===injectWrapper)Object.defineProperty(current,'inject',injectDescriptor);current=null;original=null;wrapper=null;injectWrapper=null;injectDescriptor=null;};
      const ping=entry=>{const options={name:slot,priority:1000000};if(entry.options.id!==undefined)options.id=entry.options.id;const dispose=ctx.slots.register(options,()=>null);dispose();};
      function scan(){if(stopped||!alive||scanning)return;scanning=true;try{const entry=ctx.slots.entries(slot).find(predicate);if(entry===current&&entry.component===wrapper)return;restore();if(!entry||typeof entry.component!=='function')return;const property=Object.getOwnPropertyDescriptor(entry,'component');if(!property?.writable)throw new Error('Settings entry is not decoratable');current=entry;descriptor=property;original=entry.component;wrapper=create(original,entry);if(extendInject){injectDescriptor=Object.getOwnPropertyDescriptor(entry,'inject');if(!injectDescriptor?.writable||typeof entry.inject!=='function')throw new Error('Entry injection is not decoratable');const originalInject=entry.inject;injectWrapper=function(...args){return {...originalInject.apply(this,args),...extendInject(...args)};};Object.defineProperty(entry,'inject',{...injectDescriptor,value:injectWrapper});}Object.defineProperty(entry,'component',{...property,value:wrapper});ping(entry);}catch(error){restore();console.warn('[Tanuki] Settings integration unavailable',error);}finally{scanning=false;}}
      const off=ctx.slots.subscribe(slot,scan);scan();const stop=()=>{if(stopped)return;stopped=true;off();const entry=current;restore();if(entry&&alive)ping(entry);decorations.delete(stop);};decorations.add(stop);return stop;
    }
    const bridge={subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},getSnapshot:()=>visible,decorate};ctx.provide('tanukiSettingsWindow',bridge);
    function Glyph({id}){const icons=require('@deepseek-ai/dsh-client-ui-primitives'),Icon=({account:icons.IconUserOutlineMedium,models:icons.IconDataOutlineMedium,'agent-presets':icons.IconAgentPresetOutlineMedium,plugins:icons.IconPersonalizationOutlineMedium,'archived-sessions':icons.IconArchiveOutlineMedium}[id]||icons.IconSettingsOutlineMedium);return h(Icon,{size:16});}
    function Panel({open,rows,active,renderSlot,select,close}){
      const panel=React.useRef(null),title=React.useId();useModalLayer(panel,open,close);
      return createPortal(h('div',{className:'tanuki-settings-window','data-open':open,'aria-hidden':!open,inert:!open},h('div',{className:'tanuki-settings-window-mask','aria-hidden':true,onClick:close}),h('div',{ref:panel,tabIndex:-1,role:'dialog','aria-modal':open?'true':undefined,'aria-labelledby':title,'data-shortcut-modal':'settings',className:'tanuki-settings-window-panel'},
        h('nav',null,h('div',{id:title,className:'tanuki-settings-window-title'},renderSlot('settings.header',{})),h('div',{className:'tanuki-settings-window-navigation'},...rows.map(row=>h('button',{key:row.id,type:'button','aria-current':row.id===active?'true':undefined,'data-modal-autofocus':row.id===active?'':undefined,onClick:()=>select(row.id)},h(Glyph,{id:row.id}),h('span',null,row.label))))),
        h('div',{className:'tanuki-settings-window-content'},h('header',null,h('div',null,renderSlot('settings.action',{})),h('button',{type:'button',className:'tanuki-settings-window-close',onClick:close,'aria-label':locale.t('close')},'×')),h('div',{className:'tanuki-settings-window-options'},active?renderSlot('settings.section',{close},{only:active}):null)))),document.body);
    }
    ctx.slots.inject('sidebar.settings',()=>decorate('sidebar.settings',entry=>entry.store&&entry.children?.['settings.section'],Original=>{
      return function PersistentSettings(props){
        const state=props.useStore(s=>s),rows=props.useSections(s=>s),[visited,setVisited]=React.useState(!!state.open),last=React.useRef(state.activeId),activeRef=React.useRef(null);
        if(state.open&&!visited)setVisited(true);if(state.activeId!==undefined)last.current=state.activeId;
        const active=rows.find(row=>row.id===last.current)?.id||rows[0]?.id;
        activeRef.current=active;
        React.useLayoutEffect(()=>{
          const actions=props.actions,held=[];
          for(const name of ['close','select','openSection']){const descriptor=Object.getOwnPropertyDescriptor(actions,name),original=actions[name];if(!descriptor?.writable||typeof original!=='function')continue;
            const wrapped=(...args)=>{const proceed=()=>original.apply(actions,args);if(name!=='close'&&args[0]===activeRef.current)return proceed();const event=new CustomEvent('tanuki:settings-before-hide',{cancelable:true,detail:{proceed}});if(window.dispatchEvent(event))return proceed();return false;};
            Object.defineProperty(actions,name,{...descriptor,value:wrapped});held.push({name,descriptor,wrapped});
          }
          return()=>{for(const item of held)if(actions[item.name]===item.wrapped)Object.defineProperty(actions,item.name,item.descriptor);};
        },[props.actions]);
        React.useLayoutEffect(()=>{publish(!!state.open);return()=>publish(false);},[state.open]);
        function close(){props.actions.close();}
        function useLauncherStore(selector){const value=props.useStore(s=>s),projected=React.useMemo(()=>({...value,open:false}),[value]);return selector(projected);}
        return h(React.Fragment,null,h(Original,{...props,useStore:useLauncherStore}),visited?h(Panel,{open:!!state.open,rows,active,renderSlot:props.renderSlot,select:props.actions.select,close}):null);
      };
    }));
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=".tanuki-settings-window{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .18s ease,visibility 0s linear .18s}\n.tanuki-settings-window[data-open=true]{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .18s ease,visibility 0s}\n.tanuki-settings-window-mask{position:absolute;inset:var(--dsh-frame-chrome-top,0px) 0 0;background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur)}\n.tanuki-settings-window-panel{position:relative;z-index:1;display:flex;width:800px;max-width:calc(100vw - 48px);height:min(800px,calc(100dvh - 2 * max(24px,var(--dsh-frame-overlay-top,24px))));background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:var(--dsw-radius-panel);box-shadow:var(--dsw-elevation-prominent);overflow:hidden;outline:none;transform:translateY(8px) scale(.985);transition:transform .18s ease;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}\n.tanuki-settings-window[data-open=true] .tanuki-settings-window-panel{transform:none}\n.tanuki-settings-window-panel>nav{box-sizing:border-box;width:188px;flex:none;display:flex;flex-direction:column;gap:18px;padding:22px 12px 0}\n.tanuki-settings-window-title{padding:0 12px;font-size:16px;font-weight:500;line-height:24px}.tanuki-settings-window-navigation{display:flex;flex-direction:column;gap:4px;overflow-y:auto}\n.tanuki-settings-window-navigation>button{display:flex;align-items:center;gap:8px;min-height:40px;padding:9px 16px 9px 12px;border:0;border-radius:var(--dsw-radius-md);background:transparent;color:inherit;text-align:left;font:inherit;font-size:14px;cursor:pointer}.tanuki-settings-window-navigation>button>svg{flex:none}.tanuki-settings-window-navigation>button>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tanuki-settings-window-navigation>button:hover{background:var(--dsw-specific-sidebar-nav-item-hover)}.tanuki-settings-window-navigation>button[aria-current=true]{background:var(--dsw-specific-sidebar-nav-item-active)}\n.tanuki-settings-window-content{display:flex;flex-direction:column;flex:1;min-width:0}.tanuki-settings-window-content>header{box-sizing:border-box;display:flex;justify-content:flex-end;align-items:flex-start;gap:8px;height:54px;flex:none;padding:20px 14px 8px 10px}.tanuki-settings-window-content>header>div{display:flex;align-items:center;justify-content:flex-end;gap:8px}.tanuki-settings-window-close{width:28px;height:28px;border:0;border-radius:var(--dsw-radius-sm);font-size:24px;line-height:24px;background:transparent;color:inherit;cursor:pointer}.tanuki-settings-window-close:hover{background:var(--dsw-alias-interactive-bg-hover)}.tanuki-settings-window-options{flex:1;min-height:0;padding:0 24px 24px;overflow:auto}\n@media(prefers-reduced-motion:reduce){.tanuki-settings-window,.tanuki-settings-window-panel{transition:none}}\n@media(max-width:620px){.tanuki-settings-window-panel>nav{width:145px;padding-left:8px;padding-right:8px}.tanuki-settings-window-options{padding:0 14px 20px}.tanuki-settings-window-panel{max-width:calc(100vw - 20px)}}\n";document.head.appendChild(style);return()=>style.remove();});
    ctx.effect(()=>()=>{for(const stop of [...decorations])stop();publish(false);alive=false;listeners.clear();});
  }
  return {name:'tanuki-settings-window',inject:['slots','locale'],apply};
});
