document.currentScript.__tanukiRegister(function(require){
  'use strict';
  const React=require('react'),{createPortal}=require('react-dom'),h=React.createElement;
  const createBubbleModel=__BUBBLES_FUNCTION__,css=__CSS__,dictionaries=__LOCALES__,NS='tanukiBubbles';
  function apply(ctx){
    const model=createBubbleModel();let alive=true;
    ctx.effect(()=>ctx.locale.register(NS,dictionaries));const t=ctx.locale.bind(NS);
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
    const receive=event=>{if(!alive)return;if(event.detail?.source==='notifications')document.documentElement.toggleAttribute('data-tanuki-task-read-aware',event.detail.taskReadAware===true);model.replace(event.detail);};
    window.addEventListener('tanuki:bubble-state',receive);
    window.dispatchEvent(new CustomEvent('tanuki:bubble-request'));
    ctx.effect(()=>()=>{alive=false;window.removeEventListener('tanuki:bubble-state',receive);document.documentElement.removeAttribute('data-tanuki-task-read-aware');model.dispose();});
  }
  return {apply};
});
