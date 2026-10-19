document.currentScript.__tanukiRegister(function(require){
  'use strict';
  const React=require('react'),{createPortal}=require('react-dom'),h=React.createElement;
  const createBubbleModel=function createBubbleModel(initialCategories={}){
  const sources=new Map(),listeners=new Set();let snapshot=[],categories=initialCategories;
  const states=['done','action','error','running'];
  const emit=()=>{
    const native=sources.get('notifications')||[],center=sources.get('plugin-center')||[];
    // A package is one unit, even when both the native installer and the center
    // describe it. An explicit center operation wins; otherwise native progress
    // wins over the center's merely available-update marker. Sessions keep IDs.
    const packages=new Map(),other=[];
    for(const item of center)if(item.target==='plugins'&&item.packageName)packages.set(item.packageName,item);else other.push(item);
    for(const item of native)if(item.target==='plugins'&&item.packageName){if(!packages.get(item.packageName)?.operation)packages.set(item.packageName,item);}else other.push(item);
    // Keep authoritative source snapshots intact while hidden. Re-enabling a
    // category projects its latest live state, never a cached notification queue.
    snapshot=[...other,...packages.values()].filter(item=>categories[item.category]!==false);for(const fn of [...listeners])fn();
  };
  function replace(detail){
    if(!detail||!['notifications','plugin-center'].includes(detail.source)||!Array.isArray(detail.items))return;
    if(detail.source==='notifications'&&detail.categories)categories={plugins:detail.categories.plugins!==false,tasks:detail.categories.tasks!==false,updates:detail.categories.updates!==false};
    const items=new Map();
    for(const value of detail.items.slice(0,1024)){
      if(!value||typeof value.id!=='string'||!value.id||value.id.length>512||!states.includes(value.state)||!['plugins','plugin-updates','workspace'].includes(value.target))continue;
      const count=value.count===undefined?1:value.count;if(!Number.isSafeInteger(count)||count<1||count>1000000)continue;
      const category=detail.source==='notifications'&&['plugins','tasks','updates','general'].includes(value.category)?value.category:value.target==='workspace'?'tasks':'plugins';
      const item={id:value.id,state:value.state,target:value.target,count,category};
      if(typeof value.sessionId==='string')item.sessionId=value.sessionId;
      if(typeof value.packageName==='string')item.packageName=value.packageName;
      if(detail.source==='plugin-center'&&value.operation===true)item.operation=true;
      items.set(value.id,item);
    }
    sources.set(detail.source,[...items.values()]);emit();
  }
  function aggregate(items,target,sessionId,packageName){
    const candidates=items.filter(item=>item.target===target&&(sessionId===undefined||item.sessionId===sessionId)&&(packageName===undefined||item.packageName===packageName));
    // One conversation, one state. Running always suppresses stale terminal/action facts.
    const sessions=new Map(),selected=[],priority=['running','action','error','done'];
    for(const item of candidates){
      if(item.target!=='workspace'||!item.sessionId){selected.push(item);continue;}
      const old=sessions.get(item.sessionId);
      if(!old||priority.indexOf(item.state)<priority.indexOf(old.state))sessions.set(item.sessionId,{...item,count:1});
    }
    selected.push(...sessions.values());
    const colors=states.filter(state=>selected.some(item=>item.state===state));
    if(!colors.length)return null;
    // Workspace segments combine different conversations, never competing states
    // of the same conversation. Each conversation contributes exactly one unit.
    const units=new Map();
    for(const item of selected){const key=item.sessionId?'session:'+item.sessionId:item.id;units.set(key,Math.max(units.get(key)||0,item.count));}
    return {states:colors,total:[...units.values()].reduce((sum,count)=>sum+count,0)};
  }
  return {replace,aggregate,getSnapshot:()=>snapshot,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},dispose(){sources.clear();snapshot=[];listeners.clear();}};
},css=".tanuki-global-bubble{box-sizing:border-box;display:inline-flex;position:relative;flex:none;width:22px;height:22px;align-items:center;justify-content:center;vertical-align:middle;pointer-events:none;color:#fff;font-family:inherit;font-variant-numeric:tabular-nums;background:transparent}.tanuki-global-bubble svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}.tanuki-global-bubble [data-state=done]{stroke:#14e878}.tanuki-global-bubble [data-state=action]{stroke:#e6e63c}.tanuki-global-bubble [data-state=error]{stroke:#ed3030}.tanuki-global-bubble [data-state=running]{stroke:#55a9e6}.tanuki-bubble-blue-track{opacity:.24}.tanuki-bubble-blue-progress{stroke-dasharray:22 78;transform-origin:16px 16px;animation:tanuki-bubble-progress 1.5s cubic-bezier(.45,.05,.55,.95) infinite}.tanuki-global-bubble-count{position:relative;font-size:12px;line-height:1;font-weight:750;letter-spacing:-.6px}.tanuki-global-bubble-layer{position:fixed;inset:0;z-index:75;pointer-events:none;overflow:hidden}.tanuki-global-bubble-layer:empty{display:none}[data-row-key^=\"session:\"]>span:has(>.tanuki-global-bubble){position:relative;overflow:visible}[data-row-key^=\"session:\"]>span:has(>.tanuki-global-bubble)>svg[data-state],[data-row-key^=\"session:\"]>span:has(>.tanuki-global-bubble)>span[data-state]{visibility:hidden}[data-tanuki-task-read-aware] [data-row-key^=\"session:\"]>span>svg[data-state=done],[data-tanuki-task-read-aware] [data-row-key^=\"session:\"]>span>span[data-state=done]{visibility:hidden}@keyframes tanuki-bubble-progress{from{transform:rotate(-90deg)}to{transform:rotate(270deg)}}@media(prefers-reduced-motion:reduce){.tanuki-bubble-blue-progress{animation:none;stroke-dasharray:none}.tanuki-bubble-blue-track{opacity:1}}\n[data-tanuki-task-bubbles-hidden] [data-row-key^=\"session:\"]>span>svg[data-state],[data-tanuki-task-bubbles-hidden] [data-row-key^=\"session:\"]>span>span[data-state]{visibility:hidden}\n",dictionaries={"zh":{"done":"已完成","action":"需要操作","error":"出错","running":"进行中"},"en":{"done":"Completed","action":"Action needed","error":"Error","running":"In progress"}},NS='tanukiBubbles';
  function apply(ctx,{categories={}}={}){
    const model=createBubbleModel(categories);let alive=true;
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
})(ctx,NS,dictionaries),t=toolboxLocale.t;
    ctx.effect(()=>{const style=document.createElement('style');style.dataset.pluginCss='tanuki-global-bubbles';style.textContent=css;document.head.appendChild(style);return()=>style.remove();});
    function Bubble({target,sessionId,packageName,style}){
      const snapshot=React.useSyncExternalStore(model.subscribe,model.getSnapshot);
      React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
      const maskId='tanuki-blue-'+React.useId().replace(/[^a-zA-Z0-9_-]/g,'');
      const summary=model.aggregate(snapshot,target,sessionId,packageName);if(!summary)return null;
      const title=summary.states.map(state=>t(state)).join(' / ')+': '+summary.total;
      // Clockwise quadrants: green NE, blue SE, red SW, yellow NW.
      // Lower-priority states occupy their fixed quarter; the winner fills the rest.
      const priority=['error','action','running','done'];
      const dominant=priority.find(state=>summary.states.includes(state));
      const fixed=['done','running','error','action'];
      const quadrants=fixed.map(state=>state!==dominant&&summary.states.includes(state)?state:dominant);
      const segments=[];
      // Merge adjacent quarters, including across midnight, into a single arc.
      const boundary=quadrants.findIndex((state,i)=>state!==quadrants[(i+3)%4]);
      if(boundary<0)segments.push({state:dominant,full:true});
      else for(let offset=0;offset<4;){
        const start=boundary+offset,state=quadrants[start%4];let length=1;
        while(offset+length<4&&quadrants[(start+length)%4]===state)length++;
        const trim=Math.asin(3/12),a=start*Math.PI/2-Math.PI/2+trim,b=(start+length)*Math.PI/2-Math.PI/2-trim;
        const point=angle=>[16+12*Math.cos(angle),16+12*Math.sin(angle)].join(' ');
        segments.push({state,d:'M'+point(a)+' A12 12 0 '+(b-a>Math.PI?1:0)+' 1 '+point(b)});offset+=length;
      }
      const shape=(segment,props)=>h(segment.full?'circle':'path',{...(segment.full?{cx:16,cy:16,r:12}:{d:segment.d}),fill:'none',strokeWidth:6,strokeLinecap:'round',...props});
      const blue=segments.find(segment=>segment.state==='running');
      return h('span',{className:'tanuki-global-bubble',style,role:'img','aria-label':title,title},
        h('svg',{viewBox:'0 0 32 32','aria-hidden':true},
          blue?h('defs',null,h('mask',{id:maskId,maskUnits:'userSpaceOnUse',x:0,y:0,width:32,height:32},shape(blue,{stroke:'#fff'}))):null,
          segments.map((segment,index)=>shape(segment,{key:index,'data-state':segment.state,className:segment.state==='running'?'tanuki-bubble-blue-track':undefined})),
          blue?h('g',{mask:'url(#'+maskId+')'},h('circle',{cx:16,cy:16,r:12,fill:'none',strokeWidth:6,strokeLinecap:'round',pathLength:100,'data-state':'running',className:'tanuki-bubble-blue-progress'})):null),
        summary.total>1?h('span',{className:'tanuki-global-bubble-count','aria-hidden':true,style:{fontSize:summary.total>999?5:summary.total>99?7:summary.total>9?10:12}},String(summary.total)):null);
    }
    function DetailBubble({subject}){const name=subject?.pkg?.name;return typeof name==='string'?h(Bubble,{target:'plugins',packageName:name}):null;}
    ctx.slots.inject('plugins.detail.badge',()=>ctx.slots.register({name:'plugins.detail.badge',id:'tanuki-global-plugin-bubble',locale:NS},DetailBubble));
    function Overlay(){
      const snapshot=React.useSyncExternalStore(model.subscribe,model.getSnapshot);
      const [anchors,setAnchors]=React.useState([]);
      React.useEffect(()=>{
        let frame=0,stopped=false;const observed=new Set();
        const resize=new ResizeObserver(()=>queue());
        function queue(){if(!stopped&&!frame)frame=requestAnimationFrame(measure);}
        function measure(){
          frame=0;if(stopped||!alive)return;
          const candidates=new Map();
          for(const element of document.querySelectorAll('[data-tanuki-bubble-target]')){
            const target=element.getAttribute('data-tanuki-bubble-target');if(!['workspace','plugins','plugin-updates'].includes(target))continue;
            const anchor=element.closest('button')||element;candidates.set(anchor,target);
          }
          // Native sidebar offers no separate badge slot. Resolve its declared label
          // instead of guessing translated text or replacing its React-owned icon.
          const entries=ctx.slots.entriesOfSlot?.('sidebar.panellist')||[];
          const option=entries.find(entry=>entry.options?.id==='plugins')?.options;
          const label=typeof option?.label==='function'?option.label():option?.label;
          if(typeof label==='string')for(const slot of document.querySelectorAll('[data-slot="sidebar.panellist"]')){
            const button=slot.closest('button');if(button?.getAttribute('aria-label')===label)candidates.set(button,'plugins');
          }
          for(const element of [...observed])if(!candidates.has(element)){resize.unobserve(element);observed.delete(element);}
          const next=[];
          for(const [element,target] of candidates){
            if(!observed.has(element)){observed.add(element);resize.observe(element);}
            if(!model.aggregate(snapshot,target))continue;
            const rect=element.getBoundingClientRect(),computed=getComputedStyle(element);
            if(!element.isConnected||rect.width<=0||rect.height<=0||computed.visibility==='hidden'||computed.display==='none'||rect.bottom<0||rect.top>innerHeight||rect.right<0||rect.left>innerWidth)continue;
            const x=Math.min(innerWidth-22,Math.max(0,rect.right-19)),y=Math.max(0,rect.top-2);
            next.push({element,target,x,y});
          }
          // The native leading slot is absent while running, so render into the
          // verified status container instead. CSS hides native status only while
          // our replacement is actually mounted; disposal restores it automatically.
          for(const row of document.querySelectorAll('[data-row-key^="session:"]')){
            const sessionId=row.getAttribute('data-row-key').slice(8),element=row.firstElementChild;
            if(element?.tagName!=='SPAN'||![...element.classList].some(name=>name.endsWith('_slot')))continue;
            // completionUnread can exist in the root store while the native row
            // is idle and its leading cell is empty. Do not require a native dot.
            if(!model.aggregate(snapshot,'workspace',sessionId))continue;
            next.push({element,target:'workspace',sessionId});
          }
          setAnchors(previous=>previous.length===next.length&&previous.every((a,i)=>a.element===next[i].element&&a.target===next[i].target&&a.sessionId===next[i].sessionId&&a.x===next[i].x&&a.y===next[i].y)?previous:next);
        }
        // Only layout invalidation; no network scanning or continuous animation loop.
        const mutation=new MutationObserver(records=>{if(records.some(record=>!record.target.closest?.('.tanuki-global-bubble-layer')))queue();});
        mutation.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','aria-label','data-tanuki-bubble-target','data-state','data-row-key']});
        const offSlots=ctx.slots.subscribe('sidebar.panellist',queue),offLocale=ctx.locale.subscribe(queue);
        window.addEventListener('resize',queue);document.addEventListener('scroll',queue,true);queue();
        return()=>{stopped=true;cancelAnimationFrame(frame);mutation.disconnect();resize.disconnect();offSlots();offLocale();window.removeEventListener('resize',queue);document.removeEventListener('scroll',queue,true);};
      },[snapshot]);
      return h(React.Fragment,null,
        createPortal(h('div',{className:'tanuki-global-bubble-layer'},anchors.filter(a=>a.sessionId===undefined).map((a,index)=>h(Bubble,{key:index,target:a.target,style:{position:'fixed',left:a.x,top:a.y}}))),document.body),
        anchors.filter(a=>a.sessionId!==undefined).map(a=>createPortal(h(Bubble,{target:a.target,sessionId:a.sessionId,style:{position:'absolute',width:18,height:18,left:'50%',top:'50%',transform:'translate(-50%,-50%)'}}),a.element,a.sessionId)));
    }
    ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'tanuki-global-bubbles',locale:NS},Overlay));
    const receive=event=>{if(!alive)return;if(event.detail?.source==='notifications'){
      document.documentElement.toggleAttribute('data-tanuki-task-read-aware',event.detail.taskReadAware===true);
      document.documentElement.toggleAttribute('data-tanuki-task-bubbles-hidden',event.detail.categories?.tasks===false);
    }model.replace(event.detail);};
    window.addEventListener('tanuki:bubble-state',receive);
    window.dispatchEvent(new CustomEvent('tanuki:bubble-request'));
    ctx.effect(()=>()=>{alive=false;window.removeEventListener('tanuki:bubble-state',receive);document.documentElement.removeAttribute('data-tanuki-task-read-aware');document.documentElement.removeAttribute('data-tanuki-task-bubbles-hidden');model.dispose();});
  }
  return {apply};
});
