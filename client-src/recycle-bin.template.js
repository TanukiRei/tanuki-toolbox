document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,{Menu,MenuItemButton,IconEllipsisOutlineRegular}=require('@deepseek-ai/dsh-client-ui-primitives');
  const NS='tanukiRecycleBin',PANEL='tanuki-recycle-bin',ORIGINAL=Symbol.for('cordis.original');
  function Icon({name='trash'}){if(name==='dots')return h(IconEllipsisOutlineRegular,{size:16,className:'tanuki-bin-more-icon'});const paths={trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',restore:'M4 10a8 8 0 1 1 1.8 8.3M4 4v6h6M12 8v5l3 2',copy:'M9 8h11v13H9zM15 8V3H4v13h5',refresh:'M20 7v5h-5M4 17v-5h5M5.5 8a7 7 0 0 1 12-3L20 8M4 16l2.5 3a7 7 0 0 0 12-3'};return h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.65,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:paths[name]}));}
  function apply(ctx,{lifecycle}){
    let alive=true,watch=null,loading=null,retryTimer=null,retries=0,switching=false,mode=false,selected=null,previous=null,restoring=null,clearing=false;
    let snapshot={items:[],ready:false,error:null,active:false,selected:null,clearing:false};
    const listeners=new Set(),requests=new Set(),owned=new Set(),decorations=new Set(),busy=new Set(),purging=new Set();
    const locale=(__LOCALE_FACTORY__)(ctx,NS,__LOCALES__),t=locale.t,ui=ctx.get('uiWorkspace'),target=ui[ORIGINAL]||ui;
    const native={open:target.openSession,clear:target.clearMain};
    const publish=value=>{if(!alive)return;snapshot={...snapshot,...value,active:mode,selected,clearing};for(const fn of [...listeners])fn();};
    const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn);},useState=()=>React.useSyncExternalStore(subscribe,()=>snapshot);
    function useLocale(){React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());}
    const rowFor=id=>snapshot.items.find(item=>item.sessionId===id),viewable=row=>row&&!purging.has(row.sessionId)&&row.phase==='trashed'&&row.expiresAt>Date.now();
    const sorted=()=>[...snapshot.items].sort((a,b)=>b.deletedAt-a.deletedAt);
    const address=()=>new URL('tanuki-toolbox/recycle-bin',document.baseURI);
    async function request(value){
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),['clear','purge'].includes(value?.action)?120000:45000);requests.add(controller);
      try{const response=await fetch(address(),{method:value?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'X-Tanuki-Settings':'1',...(value?{'content-type':'application/json'}:{})},...(value?{body:JSON.stringify(value)}:{})});const result=await response.json();if(!response.ok)throw Error(result.error||'RECYCLE_UNAVAILABLE');return result;}
      finally{clearTimeout(timeout);requests.delete(controller);}
    }
    function modeChanged(){document.documentElement.toggleAttribute('data-tanuki-recycle-view',mode);window.dispatchEvent(new CustomEvent('tanuki:recycle-view',{detail:{active:mode}}));}
    function show(id){
      if(!alive||!mode||clearing)return;if(id!==null&&!viewable(rowFor(id)))return;
      selected=id;publish({});switching=true;
      try{if(id===null)native.clear.call(ui);else native.open.call(ui,id);}
      catch(error){selected=null;native.clear.call(ui);publish({error:error.message});notify(error);}
      finally{switching=false;}
    }
    function enter(){
      if(!alive)return;if(!mode){previous=ui.mainReference?.sessionId||null;mode=true;modeChanged();}
      show(viewable(rowFor(selected))?selected:sorted().find(viewable)?.sessionId||null);
    }
    function leave({restore=true,panel=ctx.layout.panelInfo.getSnapshot().activePanelId}={}){
      if(!mode)return;const saved=previous;previous=null;mode=false;selected=null;modeChanged();publish({});if(!restore)return;
      switching=true;try{
        if(saved&&!rowFor(saved)&&!ctx.get('workspaces').list.getSnapshot().archivedSessionIds.includes(saved))native.open.call(ui,saved);else native.clear.call(ui);
        if(panel!==null&&panel!==PANEL)ctx.layout.selectPanel(panel);
      }finally{switching=false;}
    }
    function reconcile(){if(!mode||clearing||restoring!==null&&restoring===selected)return;if(!viewable(rowFor(selected))){const next=sorted().find(viewable)?.sessionId||null;if(next!==selected)show(next);}}
    function accept(value){if(!alive)return;publish({...value,ready:true,error:null});reconcile();}
    function connect(){
      if(!alive)return Promise.resolve();if(loading)return loading;clearTimeout(retryTimer);
      loading=request().then(value=>{if(!alive)return;retries=0;accept(value);if(!watch){const url=address();url.searchParams.set('watch','1');watch=new EventSource(url,{withCredentials:true});watch.onmessage=event=>{try{accept(JSON.parse(event.data));}catch{}};watch.onerror=()=>publish({error:'DISCONNECTED'});}})
        .catch(error=>{publish({error:error.message});if(alive&&!snapshot.ready&&retries<5)retryTimer=setTimeout(()=>void connect(),250*2**retries++);}).finally(()=>{loading=null;});return loading;
    }
    function notify(error,key='error'){
      if(!alive)return;window.dispatchEvent(new CustomEvent('tanuki:notify',{detail:{kind:'error',destination:{page:PANEL},title:{zh:__LOCALES__.zh.title,en:__LOCALES__.en.title},message:{zh:__LOCALES__.zh[key],en:__LOCALES__.en[key]}}}));console.warn('[Tanuki] Recycle Bin: '+String(error?.message||'unavailable'));
    }
    async function action(id,kind){
      if(busy.has(id)||clearing)return;const wasCurrent=ui.mainReference?.sessionId===id;
      if(kind==='move'){const status=ctx.get('uiSession')?.sessionStatus?.getSnapshot()?.get(id);if((status?.running||status?.pendingInteraction)&&!window.confirm(t('stopConfirm')))return;}
      busy.add(id);if(kind==='restore')restoring=id;publish({});
      try{const value=await request({action:kind,sessionId:id});if(!alive)return;accept(value);
        if(kind==='restore'&&mode&&selected===id){leave({restore:false});native.open.call(ui,id);}
        else if(kind==='move'&&wasCurrent)enter();
      }catch(error){notify(error);}finally{busy.delete(id);if(restoring===id)restoring=null;publish({});reconcile();}
    }
    async function clearBin(){
      if(clearing||!snapshot.ready||!snapshot.items.length||busy.size)return;const token=snapshot.clearToken;if(!token||!window.confirm(t('clearConfirm',{n:snapshot.items.length})))return;
      // Release the native main-view reference before the host takes a write
      // lease. Other plugins receive the usual native binding change.
      show(null);clearing=true;publish({});
      try{const result=await request({action:'clear',token});if(alive){accept(result);if(result.failedCount)notify(Error('CLEAR_DEFERRED'),'clearDeferred');}}
      catch(error){notify(error,error.message==='RECYCLE_BIN_CHANGED'?'changed':'error');void connect();}finally{clearing=false;publish({});reconcile();}
    }
    async function deletePermanently(row,title){
      const id=row.sessionId;if(!alive||clearing||busy.has(id))return;
      if(!window.confirm(t('permanentConfirm',{title})))return;
      purging.add(id);busy.add(id);if(mode&&selected===id)show(null);publish({});
      try{const result=await request({action:'purge',sessionId:id,deletedAt:row.deletedAt});if(alive){accept(result);if(result.failedCount)notify(Error('PURGE_DEFERRED'),'deleteDeferred');}}
      catch(error){notify(error,error.message==='RECYCLE_BIN_CHANGED'?'changed':'error');void connect();}
      finally{purging.delete(id);busy.delete(id);publish({});reconcile();}
    }
    async function copy(id){try{await navigator.clipboard.writeText(id);}catch(error){notify(error);}}
    function DeleteItem({sessionId,useMenuOpenState}){const state=useState();useLocale();const controls=useMenuOpenState(),row=rowFor(sessionId);return h(MenuItemButton,{disabled:busy.has(sessionId)||clearing||!state.ready||!!row&&!viewable(row),icon:h(Icon,{name:row?'restore':'trash'}),onSelect:()=>{controls[1](false);void action(sessionId,row?'restore':'move');}},t(row?'restore':'delete'));}
    ctx.slots.inject('sidebar.workspaces.session.menu.item',()=>ctx.slots.register({name:'sidebar.workspaces.session.menu.item',id:'tanuki-recycle-bin',order:500,locale:NS},DeleteItem));
    function RowMarker({sessionId}){
      const ref=React.useRef(null),state=useState(),trashed=state.items.some(row=>row.sessionId===sessionId);
      React.useLayoutEffect(()=>{const row=ref.current?.closest('[data-row-key^="session:"]');if(!row)return;if(trashed)row.setAttribute('data-tanuki-trashed','');else row.removeAttribute('data-tanuki-trashed');const stop=()=>{row.removeAttribute('data-tanuki-trashed');owned.delete(stop);};owned.add(stop);return stop;},[sessionId,trashed]);return h('span',{hidden:true,ref});
    }
    ctx.slots.inject('sidebar.workspaces.session.row.action',()=>ctx.slots.register({name:'sidebar.workspaces.session.row.action',id:'tanuki-recycle-marker',order:11000},RowMarker));
    function useClock(active,period){const [now,setNow]=React.useState(Date.now);React.useEffect(()=>{if(!active)return;setNow(Date.now());const clock=setInterval(()=>{if(alive)setNow(Date.now());},period);return()=>clearInterval(clock);},[active,period]);return now;}
    function remaining(row,now){const duration=Math.max(0,row.expiresAt-now);return row.phase==='purging'||duration===0?t('expiring'):t('remaining')+' '+(duration>=86400000?t('days',{n:Math.ceil(duration/86400000)}):t('hours',{n:Math.max(1,Math.ceil(duration/3600000))}));}
    function Item({row,title,workspace,now,selected}){
      const [open,setOpen]=React.useState(false),disabled=busy.has(row.sessionId)||clearing||!viewable(row);
      return h('div',{className:'tanuki-bin-row','data-selected':selected,'data-menu-open':open,role:'listitem',onContextMenu:event=>{event.preventDefault();setOpen(true);}},
        h('button',{type:'button',className:'tanuki-bin-session',disabled:!viewable(row)||clearing,'aria-current':selected?'page':undefined,title:workspace?title+' · '+workspace:title,onClick:()=>show(row.sessionId)},title),
        h('span',{className:'tanuki-bin-time'},remaining(row,now)),
        h('span',{className:'tanuki-bin-row-actions'},
          h(Menu,{open,onClose:()=>setOpen(false),portal:true,closeOnPointerLeave:true,anchor:h('button',{type:'button',className:'tanuki-bin-icon','aria-label':t('more'),'aria-expanded':open,onClick:()=>setOpen(value=>!value)},h(Icon,{name:'dots'}))},
            h(MenuItemButton,{icon:h(Icon,{name:'restore'}),disabled,onSelect:()=>{setOpen(false);void action(row.sessionId,'restore');}},t('restore')),
            h(MenuItemButton,{icon:h(Icon,{name:'copy'}),onSelect:()=>{setOpen(false);void copy(row.sessionId);}},t('copyId')),
            h(MenuItemButton,{icon:h(Icon,{name:'trash'}),danger:true,separatorBefore:true,disabled:busy.has(row.sessionId)||clearing,onSelect:()=>{setOpen(false);void deletePermanently(row,title);}},t('permanentDelete'))),
          h('button',{type:'button',className:'tanuki-bin-icon',title:t('restore'),'aria-label':t('restore'),disabled,onClick:()=>void action(row.sessionId,'restore')},h(Icon,{name:'restore'}))));
    }
    function Sidebar(){
      useLocale();const state=useState(),list=ctx.get('sessions').list,workspaces=ctx.get('workspaces').list;
      const sessions=React.useSyncExternalStore(fn=>list.subscribe(fn),()=>list.getSnapshot()),workspaceState=React.useSyncExternalStore(fn=>workspaces.subscribe(fn),()=>workspaces.getSnapshot());
      const [search,setSearch]=React.useState(''),now=useClock(state.active,60000),title=id=>sessions.byId?.[id]?.displayTitle||sessions.byId?.[id]?.title||t('untitled');
      const rows=sorted().filter(row=>title(row.sessionId).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
      return h('section',{className:'tanuki-bin-sidebar tanukiBin_root'},
        h('header',{className:'tanukiBin_sectionHeader'},h('strong',{className:'tanukiBin_sectionLabel'},t('title')),h('div',{className:'tanukiBin_headerActions'},h('button',{type:'button',className:'tanuki-bin-icon',title:t('refresh'),'aria-label':t('refresh'),onClick:()=>void connect()},h(Icon,{name:'refresh'})))),
        h('button',{type:'button',className:'tanuki-bin-clear',disabled:!state.ready||!state.items.length||state.clearing||busy.size>0,onClick:()=>void clearBin()},h(Icon),t(state.clearing?'clearing':'clear')),
        h('input',{className:'tanuki-bin-search',type:'search',value:search,placeholder:t('search'),'aria-label':t('search'),onChange:event=>setSearch(event.target.value)}),
        state.error?h('p',{className:'tanuki-bin-error',role:'alert'},t('error')):null,
        h('div',{role:'list',className:'tanuki-bin-list'},!state.ready?h('p',null,t('loading')):!rows.length?h('p',{className:'tanuki-bin-empty'},t(search?'noResults':'empty')):rows.map(row=>h(Item,{key:row.sessionId,row,title:title(row.sessionId),workspace:workspaceState.items?.find(item=>item.workspaceId===row.workspaceId)?.title,now,selected:state.selected===row.sessionId}))),
        h('p',{className:'tanuki-bin-hint'},t('hint')));
    }
    function Empty(){useLocale();const state=useState();return h('div',{className:'tanuki-bin-empty-view'},h(Icon),h('h2',null,t(state.clearing?'clearing':!state.ready?'loading':state.items.length?'choose':'empty')),h('p',null,t('readOnly')));}
    function RestoreFooter({sessionId}){
      const state=useState();useLocale();const row=rowFor(sessionId),now=useClock(state.active&&state.selected===sessionId,1000),seconds=Math.max(0,Math.ceil(((row?.expiresAt||now)-now)/1000));
      React.useEffect(()=>{if(row&&!viewable(row))reconcile();},[seconds===0,row?.phase]);
      const days=Math.floor(seconds/86400),clock=[Math.floor(seconds/3600)%24,Math.floor(seconds/60)%60,seconds%60].map(value=>String(value).padStart(2,'0')).join(':');
      return h('div',{className:'tanuki-bin-restore'},h('p',{'aria-live':'off'},t(row?.phase==='purging'?'expiring':'countdown',{days,clock})),h('button',{type:'button',disabled:busy.has(sessionId)||state.clearing||!viewable(row),onClick:()=>void action(sessionId,'restore')},h(Icon,{name:'restore'}),t('restore')));
    }
    // Preserve native owners and authorized child-slot faces. The shell keeps
    // main.conversation, so both view tabs and bottom/right plugins use the
    // actual Session binding instead of a copied transcript.
    function decorate(slot,predicate,create){
      let current=null,descriptor=null,wrapper=null,stopped=false,scanning=false;
      const restore=()=>{if(current&&current.component===wrapper)Object.defineProperty(current,'component',descriptor);current=null;wrapper=null;};
      function ping(entry){const options={name:slot,priority:1000000};if(entry.options.id!==undefined)options.id=entry.options.id;if(entry.options.key!==undefined)options.key=entry.options.key;const stop=ctx.slots.register(options,()=>null);stop();}
      function scan(){if(stopped||!alive||scanning)return;scanning=true;try{const entry=ctx.slots.entriesOfSlot(slot).find(predicate);if(entry===current&&entry?.component===wrapper)return;restore();if(!entry||!entry.component)return;const property=Object.getOwnPropertyDescriptor(entry,'component');if(!property?.writable)return;current=entry;descriptor=property;wrapper=create(entry.component);Object.defineProperty(entry,'component',{...property,value:wrapper});ping(entry);}finally{scanning=false;}}
      const off=ctx.slots.subscribe(slot,scan);scan();const stop=()=>{if(stopped)return;stopped=true;off();const entry=current;restore();if(entry&&alive)ping(entry);decorations.delete(stop);};decorations.add(stop);return stop;
    }
    ctx.slots.inject('sidebar.workspaces',()=>decorate('sidebar.workspaces',entry=>!!entry.children?.['sidebar.workspaces.session.menu.item'],Original=>function BinWorkspace(props){const state=useState();return state.active?h(Sidebar):h(Original,props);}));
    ctx.slots.inject('main.conversation',()=>decorate('main.conversation',()=>true,Original=>function BinConversation(props){const state=useState();return state.active&&!state.selected?h(Empty):h(Original,props);}));
    ctx.slots.inject('conversation.composer.bar',()=>decorate('conversation.composer.bar',()=>true,Original=>function BinComposer(props){
      useState();const trashed=!!rowFor(props.sessionId);if(!trashed)return h(Original,props);
      const renderSlot=(name,...args)=>name==='conversation.composer.dock'?props.renderSlot(name,...args):null;
      return h('div',{className:'tanuki-bin-input'},h(RestoreFooter,{sessionId:props.sessionId}),h('div',{className:'tanuki-bin-native-stats'},h(Original,{...props,disabled:true,blocked:{reason:t('readOnly')},onRequestWorkspace:undefined,renderSlot})));
    }));
    // Only viewing is exempted from the native navigation guard. The durable
    // archive flag and server-side admission gate still prohibit new turns.
    for(const [name,create]of [
      ['clearArchivedCurrent',original=>function(...args){if(alive&&mode&&rowFor(this.mainReference?.sessionId))return false;return original.apply(this,args);} ],
      ['openSession',original=>function(id,...args){if(alive&&!switching){const row=rowFor(typeof id==='string'?id:id?.sessionId);if(row){if(!viewable(row)){notify(Error('RECYCLE_EXPIRED'));return;}if(!mode){previous=this.mainReference?.sessionId||null;mode=true;modeChanged();}show(row.sessionId);return;}leave({restore:false});}return original.call(this,id,...args);} ],
      ...['clearMain','startSession','openWorkspace','openWorkspaceSession'].map(name=>[name,original=>function(...args){if(alive&&!switching)leave({restore:name!=='clearMain'});return original.apply(this,args);}])
    ]){const original=target[name],descriptor=Object.getOwnPropertyDescriptor(target,name);if(typeof original!=='function')continue;const wrapper=create(original);ctx.effect(()=>{Object.defineProperty(target,name,{configurable:true,writable:true,value:wrapper});return()=>{if(target[name]===wrapper){if(descriptor)Object.defineProperty(target,name,descriptor);else delete target[name];}};});}
    function panelChanged(){if(!alive||switching)return;const panel=ctx.layout.panelInfo.getSnapshot().activePanelId;if(panel===PANEL)enter();else if(panel!==null&&mode)leave({panel});}
    const offPanel=ctx.layout.panelInfo.subscribe(panelChanged),leaveRequested=()=>leave({panel:null});window.addEventListener('tanuki:leave-recycle',leaveRequested);
    // The alias enters Bin mode then selects native Conversation. Better
    // Sidebar therefore retains its main.conversation DOM anchor.
    ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:PANEL,locale:NS},Empty));
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=__CSS__;document.head.append(style);return()=>style.remove();});void connect();panelChanged();
    const offReset=ctx.on('connection/reset',()=>{watch?.close();watch=null;void connect();});
    ctx.effect(()=>()=>{
      offPanel();window.removeEventListener('tanuki:leave-recycle',leaveRequested);leave({panel:null});for(const stop of [...decorations])stop();alive=false;clearTimeout(retryTimer);offReset();watch?.close();watch=null;
      for(const controller of requests)controller.abort();requests.clear();for(const stop of [...owned])stop();for(const stop of [...decorations])stop();listeners.clear();snapshot={items:[],ready:false,error:null,active:false,selected:null};
      if(lifecycle.disabled&&ctx.layout.panelInfo.getSnapshot().activePanelId===PANEL)ctx.layout.selectPanel(null);
    });
  }
  return {name:'tanuki-recycle-bin-client',inject:['slots','locale','layout','sessions','workspaces','uiWorkspace'],apply};
});
