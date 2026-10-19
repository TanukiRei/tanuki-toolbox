document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,{createPortal}=require('react-dom'),{useModalLayer}=require('@deepseek-ai/dsh-client-ui-primitives'),NS='tanukiSettingsWindow';
  function apply(ctx){
    let alive=true,visible=false;const listeners=new Set(),decorations=new Set(),locale=(__LOCALE_FACTORY__)(ctx,NS,__LOCALES__);
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
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=__CSS__;document.head.appendChild(style);return()=>style.remove();});
    ctx.effect(()=>()=>{for(const stop of [...decorations])stop();publish(false);alive=false;listeners.clear();});
  }
  return {name:'tanuki-settings-window',inject:['slots','locale'],apply};
});
