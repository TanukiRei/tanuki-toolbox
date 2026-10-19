document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,{createPortal}=require('react-dom'),NS='tanukiComposerModel',SEAT='conversation.input.model';
  const emptyPreferences=Object.freeze({}),emptyStore={subscribe:()=>()=>{},getSnapshot:()=>emptyPreferences};
  function Icon({name}){return h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:{bolt:'M13 2 4 14h7l-1 8 10-13h-7l1-7z',detail:'M5 6h14M5 12h10M5 18h14',reset:'M4 4v6h6M4 10a8 8 0 1 1 0 6',chevron:'m9 5 7 7-7 7'}[name]}));}
  function apply(ctx){
    let alive=true;
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
})(ctx,NS,{"zh":{"detail_low":"简洁","search":"搜索模型","effort_ultra":"超高","effort_xhigh":"极高","detail_high":"详细","default":"默认","speed":"高速模式","detail_default":"模型默认","detail":"输出详略","noModels":"没有可选模型","title":"模型选择","detail_medium":"均衡","chooseModel":"选择模型","standardHint":"标准速度，点击启用高速；高速可能消耗更多额度。","effort_high":"高","effort_none":"无","effort_minimal":"最低","fastHint":"高速已开启，点击切换到标准速度；高速可能消耗更多额度。","effort_max":"最高","effort_low":"低","reset":"恢复设置中的默认模型和推理等级，重置速度及输出详略","effort":"推理等级","effort_medium":"中","modelDisabled":"该模型已禁用"},"en":{"detail_low":"Concise","search":"Search models","effort_ultra":"Ultra","effort_xhigh":"Extra high","detail_high":"Detailed","default":"Default","speed":"Fast mode","detail_default":"Model default","detail":"Output detail","noModels":"No models available","title":"Model selection","detail_medium":"Balanced","chooseModel":"Select model","standardHint":"Standard speed. Click for fast mode, which may use more credits.","effort_high":"High","effort_none":"None","effort_minimal":"Minimal","fastHint":"Fast mode is on. Click for standard speed. Fast mode may use more credits.","effort_max":"Max","effort_low":"Low","reset":"Restore the model and reasoning defaults from Settings, standard speed and default output detail","effort":"Reasoning effort","effort_medium":"Medium","modelDisabled":"This model is disabled"}}),t=toolboxLocale.t;
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=".tanuki-model-controls{display:inline-flex;align-items:center;gap:2px;min-width:0;max-width:100%;-webkit-app-region:no-drag;}\n.tanuki-model-trigger{display:inline-flex;align-items:center;gap:5px;max-width:240px;height:28px;padding:3px 6px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,#aaa);font:inherit;font-size:13px;cursor:pointer;min-width:0;}\n.tanuki-model-trigger>span:first-child{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;}\n.tanuki-model-trigger-effort{flex:none;opacity:.7;}\n.tanuki-model-trigger svg{width:12px;height:12px;flex:none;}\n.tanuki-model-popup{position:fixed;z-index:1200;display:flex;align-items:flex-start;gap:6px;width:260px;max-width:calc(100vw - 16px);color:var(--dsw-alias-label-primary,#ddd);font-family:inherit;-webkit-app-region:no-drag;}\n.tanuki-model-card{display:grid;grid-template-columns:28px minmax(0,1fr) 28px;grid-template-rows:66px 26px;gap:10px 3px;width:260px;min-width:0;height:126px;box-sizing:border-box;flex:1;padding:11px 10px;border:1px solid var(--dsw-alias-border-l2,#ffffff20);border-radius:17px;background:var(--dsw-alias-bg-layer-2,#292929);box-shadow:0 8px 26px #0003;}\n.tanuki-model-hit{display:flex;align-items:center;justify-content:center;border:0;border-radius:10px;background:transparent;color:var(--dsw-alias-label-secondary,#aaa);padding:6px;font:inherit;cursor:pointer;min-width:0;transition:background-color .12s,color .12s;}\n.tanuki-model-hit svg{width:18px;height:18px;flex:none;}\n.tanuki-model-hit:hover:not(:disabled),.tanuki-model-trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.2));color:var(--dsw-alias-label-primary,#eee);}\n.tanuki-model-hit:focus-visible,.tanuki-model-trigger:focus-visible,.tanuki-model-options :is(button,input):focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px;}\n.tanuki-model-hit:disabled,.tanuki-model-trigger:disabled{opacity:.4;cursor:default;}\n.tanuki-model-main{flex-direction:column;gap:4px;min-height:60px;}\n.tanuki-model-effort{flex:none;color:var(--dsw-alias-state-business-primary);font-size:15px;line-height:22px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;}\n.tanuki-model-name{flex:none;display:flex;align-items:center;justify-content:center;gap:4px;max-width:100%;font-size:13px;line-height:20px;}\n.tanuki-model-name>span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\n.tanuki-model-name svg{width:11px;height:11px;}\n.tanuki-model-speed,.tanuki-model-detail{height:28px;align-self:start;}\n.tanuki-model-speed[data-fast=\"true\"]{color:var(--dsw-alias-state-business-primary);}\n.tanuki-model-speed[data-fast=\"true\"] svg{fill:currentColor;}\n.tanuki-model-reset{flex:0 0 28px;width:28px;height:28px;padding:5px;border-radius:7px;background:transparent;}.tanuki-model-controls[aria-busy=true] .tanuki-model-reset:disabled{opacity:1}\n.tanuki-model-slider{grid-column:1/-1;position:relative;height:26px;border-radius:99px;background:linear-gradient(to right,var(--dsw-alias-state-business-primary) var(--tanuki-progress),var(--dsw-alias-interactive-bg-hover-solid,#454545) var(--tanuki-progress));}\n.tanuki-model-slider input{position:relative;display:block;width:100%;height:26px;margin:0;background:transparent;appearance:none;-webkit-appearance:none;cursor:pointer;outline:none;}\n.tanuki-model-slider input::-webkit-slider-runnable-track{height:26px;background:transparent;}\n.tanuki-model-slider input::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:26px;height:26px;border-radius:50%;border:0;background:#fff;box-shadow:0 1px 4px #0002;}\n.tanuki-model-slider input::-moz-range-track{height:26px;background:transparent;border:0;}\n.tanuki-model-slider input::-moz-range-thumb{width:26px;height:26px;border-radius:50%;border:0;background:#fff;box-shadow:0 1px 4px #0002;}\n.tanuki-model-slider input:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:3px;border-radius:99px;}\n.tanuki-model-slider input:disabled{cursor:default;opacity:.5;}\n.tanuki-model-ticks{position:absolute;inset:0 13px;pointer-events:none;}\n.tanuki-model-ticks i{position:absolute;top:11px;width:4px;height:4px;border-radius:50%;background:color-mix(in srgb,var(--dsw-alias-label-secondary) 55%,transparent);transform:translateX(-50%);}\n.tanuki-model-options{position:fixed;width:260px;max-width:calc(100vw - 16px);max-height:min(280px,calc(100vh - 160px));overflow:auto;overscroll-behavior:contain;box-sizing:border-box;padding:6px;border:1px solid var(--dsw-alias-border-l2,#ffffff20);border-radius:12px;background:var(--dsw-alias-bg-layer-2,#292929);box-shadow:0 8px 26px #0004;}\n.tanuki-model-options input{box-sizing:border-box;width:100%;padding:7px 8px;border:1px solid var(--dsw-alias-border-l2,#ffffff20);border-radius:7px;background:var(--dsw-alias-bg-base,#181818);color:inherit;font:inherit;font-size:13px;}\n.tanuki-model-options button{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;border:0;border-radius:7px;background:transparent;color:inherit;text-align:left;padding:8px;font:inherit;font-size:13px;cursor:pointer;}\n.tanuki-model-options button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,#ffffff14);}\n.tanuki-model-options button:disabled{opacity:.4;cursor:default;}\n.tanuki-model-group,.tanuki-model-options p{padding:6px 8px;margin:0;font-size:11px;color:var(--dsw-alias-label-secondary,#aaa);}\n@media(prefers-reduced-motion:reduce){.tanuki-model-hit{transition:none;}}\n\n/* Saving should not flash the whole card between normal and dimmed states. */\n.tanuki-model-popup[aria-busy=true] .tanuki-model-hit:disabled,.tanuki-model-popup[aria-busy=true] .tanuki-model-slider input:disabled,.tanuki-model-popup[aria-busy=true] .tanuki-model-options button:disabled{opacity:1}\n\nhtml[data-platform=darwin]:not([data-fullscreen]) .tanuki-model-options{max-height:min(280px,calc(100vh - var(--dsh-frame-top-clearance,48px) - 160px));}\n";document.head.appendChild(style);return()=>style.remove();});
    const notify=()=>{if(alive)window.dispatchEvent(new CustomEvent('tanuki:notify',{detail:{kind:'error',destination:{page:'settings',section:'tanuki-toolbox',component:'composer'},title:{zh:'模型选择',en:'Model selection'},message:{zh:'设置未能完成，请稍后重试。',en:'Could not apply the selection. Please retry.'}}}));};
    // Model policy arrives in its own lazy chunk. Do not leave the model seat
    // unregistered while that optional UI bridge is starting or being replaced.
    // Host-side model enforcement remains authoritative throughout the transition.
    const noPolicy={subscribe:emptyStore.subscribe,getSnapshot:emptyStore.getSnapshot,isDisabled:()=>false,retain:()=>()=>{}};
    const policyListeners=new Set();let policySnapshot={policy:noPolicy};
    const policyStore={subscribe:fn=>{policyListeners.add(fn);return()=>policyListeners.delete(fn);},getSnapshot:()=>policySnapshot};
    const publishPolicy=policy=>{if(!alive||policySnapshot.policy===policy)return;policySnapshot={policy};for(const fn of [...policyListeners])fn();};
    ctx.inject(['tanukiModels'],scope=>{const policy=scope.get('tanukiModels');publishPolicy(policy);scope.effect(()=>()=>{if(policySnapshot.policy===policy)publishPolicy(noPolicy);});});
    let gatewaySnapshot=null;const gatewayListeners=new Set(),gatewayStore={subscribe:fn=>{gatewayListeners.add(fn);return()=>gatewayListeners.delete(fn);},getSnapshot:()=>gatewaySnapshot};
    const publishGateway=value=>{gatewaySnapshot=value;for(const fn of gatewayListeners)fn();};
    ctx.inject(['tanukiGatewaySpeed'],scope=>{const gateway=scope.get('tanukiGatewaySpeed');publishGateway(gateway);scope.effect(()=>()=>{if(gatewaySnapshot===gateway)publishGateway(null);});});
    ctx.inject(['modelDirectories','sessions','remote','remote.session'],scope=>{
      const models=scope.get('modelDirectories'),sessions=scope.get('sessions');
      function ModelControl({sessionId,directory,available,locked}){
        React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
        const {policy}=React.useSyncExternalStore(policyStore.subscribe,policyStore.getSnapshot);
        const gateway=React.useSyncExternalStore(gatewayStore.subscribe,gatewayStore.getSnapshot);
        const modelPolicy=React.useSyncExternalStore(policy.subscribe,policy.getSnapshot);
        const state=React.useSyncExternalStore(fn=>directory.store.subscribe(fn),()=>directory.store.getSnapshot());
        React.useLayoutEffect(()=>policy.retain(directory),[directory,policy]);
        const catalogStore=models.catalog?.store||emptyStore;
        const catalog=React.useSyncExternalStore(fn=>catalogStore.subscribe(fn),()=>catalogStore.getSnapshot());
        const entries=React.useSyncExternalStore(fn=>scope.slots.subscribe(SEAT,fn),()=>scope.slots.entries(SEAT));
        // Reuse the installed provider's actual preference controller; no duplicate RPC schema.
        const preference=React.useMemo(()=>{
          // Current DSH keeps locale/inject on the entry and priority in options.
          // Preserve the entry fields while accepting older metadata wrappers.
          const entry=entries.map(item=>({...item.options,...item})).find(item=>item.locale==='settings.codexSubscription'&&typeof item.inject==='function');
          if(!available||!entry)return null;
          try{const value=entry.inject(sessionId)?.preference;return typeof value?.subscribe==='function'&&typeof value?.getSnapshot==='function'&&typeof value?.set==='function'?value:null;}catch{return null;}
        },[entries,sessionId,available]);
        const preferenceStore=preference||emptyStore,prefs=React.useSyncExternalStore(fn=>preferenceStore.subscribe(fn),()=>preferenceStore.getSnapshot());
        const [open,setOpen]=React.useState(false),[pane,setPane]=React.useState(null),[query,setQuery]=React.useState(''),[draft,setDraft]=React.useState(null),[busy,setBusy]=React.useState(false),[position,setPosition]=React.useState({left:0,top:0}),[optionPosition,setOptionPosition]=React.useState({left:0,top:0});
        const controls=React.useRef(null),trigger=React.useRef(null),popup=React.useRef(null),options=React.useRef(null),mounted=React.useRef(false),operation=React.useRef(false),gesture=React.useRef(null),id=React.useId();
        const groups=state.groups||[],current=state.current,choice=groups.find(group=>group.id===current?.provider)?.models.find(model=>model.id===current?.model),modelBlocked=policy.isDisabled(current);
        const visibleGroups=React.useMemo(()=>groups.map(group=>group.id==='openai-codex'?{...group,models:group.models.filter(model=>model.tanukiDisabled||!prefs.disabledModels?.includes(model.id))}:group),[groups,prefs.disabledModels]);
        const modelLabel=choice?.name||current?.model||t('chooseModel');
        const reasoning=choice?.reasoning,efforts=reasoning&&Array.isArray(reasoning.efforts)?[...(reasoning.defaultEffort===undefined?[{id:undefined,name:t('default')}]:[]),...reasoning.efforts]:[];
        const effortName=level=>!level?t('default'):['none','minimal','low','medium','high','xhigh','max','ultra'].includes(level.id)?t('effort_'+level.id):level.name;
        const effective=current?.reasoningEffort??reasoning?.defaultEffort,index=efforts.findIndex(item=>item.id===effective),displayIndex=draft??Math.max(0,index),effortLabel=index>=0?effortName(efforts[displayIndex]):state.retainedEffort;
        const codex=current?.provider==='openai-codex';
        // Match Codex Subscription's fallback only when its advertised list is absent.
        const fastSupported=codex&&(Array.isArray(prefs.fastModels)?prefs.fastModels.includes(current?.model):typeof current?.model==='string'&&(/^gpt-5\.(?:5|6)(?:$|-)/u.test(current.model)||['gpt-5.4','gpt-6-astra'].includes(current.model)));
        const ultraSupported=codex&&prefs.ultrafastModels?.includes(current?.model),speedSupported=!!preference&&(fastSupported||ultraSupported),fast=speedSupported&&['fast','ultrafast'].includes(prefs.speedMode);
        const detailSupported=!!preference&&codex&&prefs.verbosityModels?.includes(current?.model);
        const detailChoices=['default','low','medium','high'],detailValue=detailChoices.includes(prefs.outputVerbosity)?prefs.outputVerbosity:'default';
        const disabled=!!locked||!available||busy||state.status==='selecting',preferenceDisabled=disabled||modelBlocked||prefs.status!=='ready'||prefs.writable!==true;
        const defaultSelection=modelPolicy.defaultSelection||catalog.value?.default;
        const resetAvailable=defaultSelection&&groups.some(group=>group.id===defaultSelection.provider&&group.models.some(model=>model.id===defaultSelection.model&&!model.tanukiDisabled));
        React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;operation.current=false;};},[]);
        React.useEffect(()=>{if(available)void directory.load().catch(()=>{});},[directory,available]);
        React.useEffect(()=>{gesture.current=null;setDraft(null);},[current?.provider,current?.model,effective]);
        // A transient host lock prevents writes; it is not a request to dismiss the UI.
        React.useEffect(()=>{if(!available){setOpen(false);setPane(null);setDraft(null);}},[available]);
        React.useEffect(()=>{setOpen(false);setPane(null);setDraft(null);},[sessionId]);
        React.useEffect(()=>{if(pane==='detail'&&!detailSupported)setPane(null);},[pane,detailSupported]);
        function close(){setOpen(false);setPane(null);setDraft(null);trigger.current?.focus({preventScroll:true});}
        React.useLayoutEffect(()=>{
          if(!open)return;
          const place=()=>{
            const anchor=trigger.current?.getBoundingClientRect(),box=popup.current;if(!anchor||!box)return;
            // Include Reset in the anchor: shift right by its fixed width while
            // keeping the popup before the native voice/send controls.
            const right=controls.current?.getBoundingClientRect().right??anchor.right;
            const left=Math.max(8,Math.min(right-box.offsetWidth,window.innerWidth-box.offsetWidth-8));
            const safeTop=document.documentElement.hasAttribute('data-fullscreen')?8:8+(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dsh-frame-top-clearance'))||(document.documentElement.dataset.platform==='darwin'?48:0));
            const top=Math.max(safeTop,Math.min(anchor.top-box.offsetHeight-8,window.innerHeight-box.offsetHeight-8));
            setPosition(old=>old.left===left&&old.top===top?old:{left,top});
            const list=options.current;if(list){
              const height=list.offsetHeight,width=list.offsetWidth;
              const y=top-height-6>=safeTop?top-height-6:Math.min(window.innerHeight-height-8,top+box.offsetHeight+6);
              const next={left:Math.max(8,Math.min(left,window.innerWidth-width-8)),top:Math.max(safeTop,y)};
              setOptionPosition(old=>old.left===next.left&&old.top===next.top?old:next);
            }
          };
          const outside=event=>{if(!controls.current?.contains(event.target)&&!popup.current?.contains(event.target))close();};
          const blur=()=>{setOpen(false);setPane(null);setDraft(null);};
          // Saving temporarily disables the focused control; Escape must still work
          // when the browser transfers focus to body during that interval.
          const escape=event=>{if(event.key==='Escape')keydown(event);};
          place();window.addEventListener('resize',place);document.addEventListener('scroll',place,true);document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape,true);window.addEventListener('blur',blur);
          return()=>{window.removeEventListener('resize',place);document.removeEventListener('scroll',place,true);document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);window.removeEventListener('blur',blur);};
        },[open,pane,query,groups]);
        React.useLayoutEffect(()=>{if(open)(options.current?.querySelector('input,button:not(:disabled)')||popup.current?.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});},[open,pane]);
        async function run(action){
          if(!alive||!mounted.current||operation.current||disabled)return;
          operation.current=true;setBusy(true);
          try{await action();}catch{if(alive&&mounted.current)notify();}
          finally{if(alive&&mounted.current){operation.current=false;setBusy(false);setDraft(null);}}
        }
        async function select(selection){
          const before=directory.store.getSnapshot().current;
          if(before?.provider===selection.provider&&before?.model===selection.model&&before?.reasoningEffort===selection.reasoningEffort)return;
          const result=await directory.select(selection);if(!result?.ok)throw new Error('Selection rejected');
        }
        async function setPreferences(patch){
          if(!preference||preference.getSnapshot().writable!==true)throw new Error('Preferences unavailable');
          if(Object.entries(patch).every(([key,value])=>preference.getSnapshot()[key]===value))return;
          await preference.set(patch);if(preference.getSnapshot().error)throw new Error('Preferences rejected');
        }
        function chooseModel(provider,model){if(model.tanukiDisabled)return;void run(()=>select({provider,model:model.id,...(model.reasoning?.defaultEffort===undefined?{}:{reasoningEffort:model.reasoning.defaultEffort})}));}
        function commitEffort(value){
          const level=efforts[Number(value)];if(!level||!current||index===Number(value)||disabled||modelBlocked){setDraft(null);return;}
          void run(()=>select({provider:current.provider,model:current.model,...(level.id===undefined?{}:{reasoningEffort:level.id})}));
        }
        function reset(){void run(async()=>{
          if(!resetAvailable)throw new Error('Default model unavailable');
          await select({...defaultSelection});
          if(!alive||!mounted.current)return;
          if(preference){const latest=preference.getSnapshot();if(latest.speedMode!=='standard'||latest.outputVerbosity!=='default')await setPreferences({speedMode:'standard',outputVerbosity:'default'});}
          if(gateway)await gateway.set(sessionId,defaultSelection.provider,defaultSelection.model,'inherit');
        });}
        function keydown(event){
          if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(pane)setPane(null);else close();return;}
          if(options.current?.contains(event.target)&&event.target.tagName!=='INPUT'&&['ArrowUp','ArrowDown','Home','End'].includes(event.key)){
            const items=[...options.current.querySelectorAll('button:not(:disabled)')],at=items.indexOf(document.activeElement);
            if(items.length){event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:(at+(event.key==='ArrowDown'?1:items.length-1))%items.length].focus();}return;
          }
          if(event.key==='Tab'){
            const nodes=[...popup.current.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(node=>getComputedStyle(node).visibility!=='hidden');
            const at=nodes.indexOf(document.activeElement),next=event.shiftKey?at-1:at+1;
            if(next<0||next>=nodes.length){event.preventDefault();nodes[event.shiftKey?nodes.length-1:0]?.focus();}
          }
        }
        if(!available)return null;
        const buttonProps={type:'button',disabled,className:'tanuki-model-hit'};
        return h(React.Fragment,null,
          h('span',{ref:controls,className:'tanuki-model-controls','aria-busy':busy||state.status==='selecting'},
          h('button',{ref:trigger,type:'button',className:'tanuki-model-trigger','data-tanuki-model-disabled':modelBlocked,title:modelBlocked?t('modelDisabled'):undefined,disabled:!!locked,'aria-haspopup':'dialog','aria-expanded':open,'aria-controls':open?id:undefined,onClick:()=>{if(open)close();else{setOpen(true);void directory.load().catch(notify);}}},h('span',null,modelLabel),effortLabel?h('span',{className:'tanuki-model-trigger-effort'},effortLabel):null,h(Icon,{name:'chevron'})),
          h('button',{...buttonProps,className:'tanuki-model-hit tanuki-model-reset',disabled:disabled||!resetAvailable||(!!preference&&(prefs.status!=='ready'||prefs.writable!==true)),title:t('reset'),'aria-label':t('reset'),onClick:reset},h(Icon,{name:'reset'}))),
          open?createPortal(h('div',{ref:popup,id,role:'dialog','aria-label':t('title'),'aria-busy':busy||state.status==='selecting',className:'tanuki-model-popup',style:position,onKeyDown:keydown},
            h('div',{className:'tanuki-model-card'},
              gateway?h(gateway.Control,{sessionId,current,locked:disabled||modelBlocked,variant:'card',fallback:h('button',{...buttonProps,className:'tanuki-model-hit tanuki-model-speed','data-fast':fast,style:{visibility:speedSupported?'visible':'hidden'},disabled:preferenceDisabled||!speedSupported,title:t(fast?'fastHint':'standardHint'),'aria-label':t('speed'),'aria-pressed':fast,onClick:()=>void run(()=>setPreferences({speedMode:fast?'standard':fastSupported?'fast':'ultrafast'}))},h(Icon,{name:'bolt'}))}):h('button',{...buttonProps,className:'tanuki-model-hit tanuki-model-speed','data-fast':fast,style:{visibility:speedSupported?'visible':'hidden'},disabled:preferenceDisabled||!speedSupported,title:t(fast?'fastHint':'standardHint'),'aria-label':t('speed'),'aria-pressed':fast,onClick:()=>void run(()=>setPreferences({speedMode:fast?'standard':fastSupported?'fast':'ultrafast'}))},h(Icon,{name:'bolt'})),
              h('button',{...buttonProps,className:'tanuki-model-hit tanuki-model-main','data-tanuki-model-disabled':modelBlocked,title:modelBlocked?t('modelDisabled'):undefined,'aria-haspopup':'menu','aria-expanded':pane==='models',onClick:()=>{setQuery('');setPane(value=>value==='models'?null:'models');}},h('span',{className:'tanuki-model-name'},h('span',null,modelLabel),h(Icon,{name:'chevron'})),h('span',{className:'tanuki-model-effort',style:{visibility:efforts.length?'visible':'hidden'}},effortLabel||t('default'))),
              h('button',{...buttonProps,className:'tanuki-model-hit tanuki-model-detail',style:{visibility:detailSupported?'visible':'hidden'},disabled:preferenceDisabled||!detailSupported,title:t('detail')+' · '+t('detail_'+detailValue),'aria-label':t('detail')+' · '+t('detail_'+detailValue),'aria-haspopup':'menu','aria-expanded':pane==='detail',onClick:()=>setPane(value=>value==='detail'?null:'detail')},h(Icon,{name:'detail'})),
              h('div',{className:'tanuki-model-slider',style:{visibility:efforts.length?'visible':'hidden','--tanuki-progress':(efforts.length>1?displayIndex/(efforts.length-1)*100:0)+'%'}},
                h('div',{className:'tanuki-model-ticks','aria-hidden':true},...efforts.map((level,i)=>h('i',{key:level.id??'default',style:{left:(efforts.length>1?i/(efforts.length-1)*100:0)+'%'}}))),
                h('input',{type:'range',min:0,max:Math.max(0,efforts.length-1),step:1,value:displayIndex,disabled:disabled||modelBlocked||efforts.length<2,'aria-label':t('effort'),'aria-valuetext':effortName(efforts[displayIndex]),title:effortName(efforts[displayIndex]),onChange:event=>setDraft(Number(event.target.value)),onPointerDown:event=>{if(event.button===0){gesture.current=JSON.stringify([current?.provider,current?.model,effective]);event.currentTarget.setPointerCapture(event.pointerId);}},onPointerUp:event=>{const valid=gesture.current===JSON.stringify([current?.provider,current?.model,effective]);gesture.current=null;if(valid)commitEffort(event.currentTarget.value);else setDraft(null);},onPointerCancel:()=>{gesture.current=null;setDraft(null);},onLostPointerCapture:()=>{if(gesture.current!==null){gesture.current=null;setDraft(null);}},onKeyUp:event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))commitEffort(event.currentTarget.value);},onBlur:()=>{gesture.current=null;if(!operation.current)setDraft(null);}}))),
            pane?h('div',{ref:options,role:'menu','aria-label':t(pane==='models'?'chooseModel':'detail'),className:'tanuki-model-options',style:optionPosition},
              pane==='models'?h(React.Fragment,null,h('input',{type:'search',value:query,placeholder:t('search'),'aria-label':t('search'),onChange:event=>setQuery(event.target.value)}),
                ...visibleGroups.map(group=>{const matches=group.models.filter(model=>(model.name+' '+model.id).toLowerCase().includes(query.toLowerCase()));return matches.length?h('div',{key:group.id,role:'group','aria-label':group.name},h('div',{className:'tanuki-model-group'},group.name),...matches.map(model=>h('button',{key:model.id,type:'button',role:'menuitemradio','aria-checked':current?.provider===group.id&&current?.model===model.id,'data-tanuki-model-disabled':!!model.tanukiDisabled,title:model.tanukiDisabled?t('modelDisabled'):undefined,disabled:disabled||!!model.tanukiDisabled,onClick:()=>chooseModel(group.id,model)},h('span',null,model.name,model.tanukiDisabled?h('small',null,t('modelDisabled')):null),current?.provider===group.id&&current?.model===model.id?'✓':null))):null;}),
                !visibleGroups.some(group=>group.models.some(model=>(model.name+' '+model.id).toLowerCase().includes(query.toLowerCase())))?h('p',null,t('noModels')):null):
              detailChoices.map(value=>h('button',{key:value,type:'button',role:'menuitemradio','aria-checked':detailValue===value,disabled:preferenceDisabled,onClick:()=>{void run(()=>setPreferences({outputVerbosity:value}));}},h('span',null,t('detail_'+value)),detailValue===value?'✓':null))):null),document.body):null);
      }
      // The native entry owns the shared label slot. This replacement renders
      // its own label and must not redeclare that already-owned child slot.
      scope.slots.inject(SEAT,()=>scope.slots.register({name:SEAT,id:'tanuki-composer-model',priority:-1000,locale:NS,inject:sessionId=>({sessionId,directory:models.directoryFor(sessionId),available:sessions.subagentAddress(sessionId)===undefined})},ModelControl));
    });
    ctx.effect(()=>()=>{alive=false;policyListeners.clear();policySnapshot={policy:noPolicy};});
  }
  return {name:'tanuki-composer-model',inject:['slots','locale'],apply};
});
