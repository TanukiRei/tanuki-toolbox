document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement;
  function apply(ctx){
    let alive=true;const owned=new Set();
    function Marker({sessionId}){const ref=React.useRef(null),list=ctx.get('workspaces').list,state=React.useSyncExternalStore(fn=>list.subscribe(fn),()=>list.getSnapshot()),pinned=state.pinnedSessionIds.includes(sessionId);React.useLayoutEffect(()=>{const row=ref.current?.closest('[data-row-key^="session:"]');if(!row)return;row.setAttribute('data-tanuki-session-list','');row.dataset.tanukiPinned=String(pinned);function menu(event){if(event.target.closest('input,textarea,[contenteditable="true"]'))return;const actions=[...row.children].find(node=>[...node.classList].some(key=>key.endsWith('_rowActions'))),button=actions?.querySelector('button');if(!button)return;event.preventDefault();event.stopPropagation();if(button.getAttribute('aria-expanded')!=='true'&&![...row.classList].some(key=>key.endsWith('_menuOpen')))button.click();}row.addEventListener('contextmenu',menu);const stop=()=>{row.removeEventListener('contextmenu',menu);row.removeAttribute('data-tanuki-session-list');row.removeAttribute('data-tanuki-pinned');owned.delete(stop);};owned.add(stop);return stop;},[pinned,sessionId]);return h('span',{ref,hidden:true});}
    // Keep the native Menu and every live native contribution. Right-click
    // activates its actual anchor instead of maintaining a second item list.
    ctx.slots.inject('sidebar.workspaces.session.row.action',()=>ctx.slots.register({name:'sidebar.workspaces.session.row.action',id:'tanuki-session-context',order:10000},Marker));
    const decorated=new Map();let scanning=false;
    const slot='sidebar.workspaces.session.row.action';
    function ping(row){const off=ctx.slots.register({name:slot,id:row.options.id,priority:1000000},()=>null);off();}
    function scan(){if(scanning||!alive)return;scanning=true;try{for(const id of ['archive','pin']){const entry=ctx.slots.entries(slot).find(row=>row.options?.id===id),previous=decorated.get(id);if(entry===previous?.entry&&entry?.component===previous?.wrapper)continue;if(previous&&previous.entry.component===previous.wrapper)Object.defineProperty(previous.entry,'component',previous.descriptor);decorated.delete(id);const descriptor=entry&&Object.getOwnPropertyDescriptor(entry,'component');if(!descriptor?.writable)continue;const Original=entry.component,wrapper=id==='archive'?()=>null:function Pin(props){const pinned=props.usePinned(set=>set.has(props.sessionId));return h('span',{'data-tanuki-pin-action':pinned,style:{display:'contents'}},h(Original,props));};decorated.set(id,{entry,descriptor,wrapper});Object.defineProperty(entry,'component',{...descriptor,value:wrapper});ping(entry);}}finally{scanning=false;}}
    const off=ctx.slots.subscribe(slot,scan);scan();
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=__CSS__;document.head.append(style);return()=>style.remove();});
    ctx.effect(()=>()=>{alive=false;off();for(const stop of [...owned])stop();for(const {entry,descriptor,wrapper}of decorated.values())if(entry?.component===wrapper){Object.defineProperty(entry,'component',descriptor);}decorated.clear();});
  }
  return {name:'tanuki-composer-session-list',inject:['slots','workspaces'],apply};
});
