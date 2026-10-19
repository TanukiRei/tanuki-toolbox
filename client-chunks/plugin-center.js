document.currentScript.__tanukiRegister(function(require) {
    'use strict';
    const React=require('react');
    const {createPortal}=require('react-dom');
    const h=React.createElement;
    const SELF='dsh-local-plugin-center', NS='tanukiCenter';
    const DETAIL_SELECTOR='[data-plugin-detail], [data-plugin-item-detail], [data-plugin-row-detail]';
    // DSH 0.2.1 split the former official group into basic, extensions and more.
    const OFFICIAL_GROUP_SELECTOR=':is([data-plugin-group="official"],[data-plugin-group="basic"],[data-plugin-group="extensions"],[data-plugin-group="more"])';
    const MORE_SELECTOR='[data-plugin-group="more"]';
    const isOfficialBundle=pkg=>pkg?.official===true||(pkg?.official===undefined&&pkg?.optional===true);
    const hasNestedView=page=>!!page.querySelector(DETAIL_SELECTOR)||!!page.querySelector(MORE_SELECTOR);
    const CENTER_ICON="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiByeD0iMiIgZmlsbD0iIzg2QjNFRSIvPjxyZWN0IHg9IjEzIiB5PSIzIiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiByeD0iMiIgZmlsbD0iIzc4QjVBNyIvPjxyZWN0IHg9IjMiIHk9IjEzIiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiByeD0iMiIgZmlsbD0iIzc4QjVBNyIvPjxyZWN0IHg9IjEzIiB5PSIxMyIgd2lkdGg9IjgiIGhlaWdodD0iOCIgcng9IjIiIGZpbGw9IiM4NkIzRUUiLz48L3N2Zz4NCg==";
    const enabledUpdateCounts=function enabledUpdateCounts(summary, bundles, rows) {
  const live = new Map(rows.map(r => [r.entryId, r]));
  const candidates = new Map(bundles.filter(p => p.installed && p.official !== true && p.optional !== true && p.removable !== false && p.enabled && (!p.rows?.length || p.rows.some(r => live.get(r.entryId)?.enabled === true))).map(p => [p.name, p]));
  const found = new Set();
  let official = 0, installed = 0;
  for (const update of summary?.packages ?? []) {
    if (found.has(update.name)) continue;
    const pkg = candidates.get(update.name);
    if (!pkg) continue;
    found.add(update.name);
    if (pkg.optional && !pkg.installed) official++; else installed++;
  }
  return { total: official + installed, official, installed, names: [...found] };
};
    const createMarketUpdater=function createMarketUpdater({request, capabilities, inventory, available, changed, completed, storage, wait:customWait, now=Date.now}) {
  const schema='dsh-market/update-api/v1', key='tanuki-toolbox:update-v1', batchKey='tanuki-toolbox:update-all-v1';
  let state={busy:false,phase:'idle',batchBusy:false}, disposed=false, batch=null, batchFlight=null;
  const waits=new Map();
  const wait=ms=>disposed?Promise.resolve():customWait?customWait(ms):new Promise(resolve=>{const timer=setTimeout(()=>{waits.delete(timer);resolve();},ms);waits.set(timer,resolve);});
  const publish=patch=>{state={...state,...patch};if(!disposed)changed(state);};
  const save=record=>{try{record?storage?.setItem(key,JSON.stringify(record)):storage?.removeItem(key);}catch{}};
  const read=()=>{try{const x=JSON.parse(storage?.getItem(key)||'null');return x&&typeof x.name==='string'&&typeof x.operationId==='string'?x:null;}catch{return null;}};
  const saveBatch=()=>{try{batch?storage?.setItem(batchKey,JSON.stringify(batch)):storage?.removeItem(batchKey);}catch{}};
  const readBatch=()=>{try{const x=JSON.parse(storage?.getItem(batchKey)||'null');return x&&Array.isArray(x.names)&&x.names.length>0&&x.names.length<=1024&&x.names.every(n=>typeof n==='string'&&n.length<=250)&&Number.isSafeInteger(x.total)?x:null;}catch{return null;}};
  const eligible=name=>{const pkg=inventory().find(p=>p.name===name);return pkg?.installed&&pkg.removable!==false&&pkg.official!==true&&pkg.optional!==true&&pkg.readOnlyReason===undefined&&available().some(p=>p.name===name);};
  const supported=c=>c?.schema===schema&&c.features?.update===true&&c.features?.progress===true&&typeof c.endpoints?.updates==='string'&&typeof c.endpoints?.operations==='string';
  const check=(body,name,id)=>{
    const op=body?.operation;
    if(body?.schema!==schema||!op||op.packageName!==name||typeof op.operationId!=='string'||(id&&op.operationId!==id)||!['queued','running','succeeded','failed','cancelled','rolled-back'].includes(op.state))throw Object.assign(new Error('Invalid operation'),{code:'INVALID_RESPONSE'});
    return op;
  };
  async function observe(caps,record,initial){
    const deadline=now()+15*60*1000;let op=initial,errors=0;
    while(!disposed&&now()<deadline){
      if(!op){
        try{
          const url=new URL(caps.endpoints.operations,'https://same-origin.invalid');url.searchParams.set('operationId',record.operationId);
          // Keep the discovered origin intact; request() enforces same-origin.
          const endpoint=/^https?:/.test(caps.endpoints.operations)?new URL(caps.endpoints.operations):null;
          if(endpoint){endpoint.searchParams.set('operationId',record.operationId);}
          op=check(await request(endpoint?endpoint.href:url.pathname+url.search),record.name,record.operationId);errors=0;
        }catch(error){if(disposed)return;if(++errors>=3||error.status===404)throw error;await wait(1500);continue;}
      }
      if(disposed)return;
      publish({percent:Number.isFinite(op.progress?.percent)?Math.max(0,Math.min(100,Math.round(op.progress.percent))):null});
      if(['succeeded','failed','cancelled','rolled-back'].includes(op.state)){
        save(null);
        const verified=op.state==='succeeded'&&typeof op.installedVersion==='string'&&op.installedVersion!==op.beforeVersion;
        // Commit the queue before host refresh/HMR can dispose this instance.
        if(batch?.names[0]===record.name){if(verified){batch.names.shift();batch.current=null;}else batch=null;saveBatch();}
        publish({busy:false,phase:verified?'succeeded':'failed',code:verified?null:op.failure?.code|| (op.state==='succeeded'?'VERSION_UNCHANGED':op.state.toUpperCase()),restartRequired:verified&&op.outcome?.restartRequired===true,refreshRequired:verified&&op.outcome?.refreshRequired===true,installedVersion:op.installedVersion});
        await completed(state);return;
      }
      await wait(1200);op=null;
    }
    if(!disposed)throw Object.assign(new Error('Observation timed out'),{code:'STATUS_UNKNOWN'});
  }
  async function run(name,resume){
    if(disposed||state.busy)return false;
    const caps=capabilities(),pkg=inventory().find(p=>p.name===name);
    if(!supported(caps)||!pkg?.installed||pkg.removable===false||pkg.readOnlyReason!==undefined||(!resume&&!available().some(p=>p.name===name)))return false;
    // Never issue a second POST while a previously accepted operation is unresolved.
    if(!resume&&read()){publish({phase:'unknown',code:'STATUS_UNKNOWN',name:read().name});return false;}
    publish({busy:true,phase:'running',name,percent:null,code:null,operationId:resume?.operationId||null,restartRequired:false});
    let record=resume;
    try{
      let initial;
      if(!record){
        initial=check(await request(caps.endpoints.updates,{method:'POST',body:{packageName:name}}),name);
        record={name,operationId:initial.operationId};save(record);publish({operationId:record.operationId});
      }
      await observe(caps,record,initial);
    }catch(error){
      if(!disposed){
        // A replacement Host cannot retain the former process's operation ID.
        if(record&&error.status===404)save(null);
        const uncertain=!!record||!error.status||error.status>=500;
        publish({busy:false,phase:uncertain?'unknown':'failed',code:uncertain?'STATUS_UNKNOWN':error.code||'UPDATE_FAILED'});
      }
    }
    return true;
  }
  async function drain(){
    publish({batchBusy:true,batchTotal:batch.total});
    try{
      while(!disposed&&batch?.names.length){
        const name=batch.names[0],record=read();
        publish({batchIndex:batch.total-batch.names.length+1});
        if(record&&record.name!==name){publish({phase:'unknown',name:record.name,code:'STATUS_UNKNOWN'});break;}
        if(!record&&batch.current?.name===name){
          // A request may have reached the host without its acknowledgement
          // reaching us. Never replay that POST after reload.
          const version=inventory().find(p=>p.name===name)?.version;
          if(version&&typeof batch.current.beforeVersion==='string'&&version!==batch.current.beforeVersion){batch.names.shift();batch.current=null;saveBatch();continue;}
          publish({phase:'unknown',name,code:'STATUS_UNKNOWN'});break;
        }
        if(!record&&!eligible(name)){batch.names.shift();saveBatch();continue;}
        if(!supported(capabilities()))break;
        if(!record){batch.current={name,beforeVersion:inventory().find(p=>p.name===name)?.version};saveBatch();}
        const ran=await run(name,record);
        if(disposed)return;
        if(!ran||state.phase!=='succeeded')break;
      }
    }finally{
      if(!disposed){batch=null;saveBatch();publish({batchBusy:false});}
    }
  }
  function runBatch(){if(batchFlight)return batchFlight;batchFlight=drain().finally(()=>{batchFlight=null;});return batchFlight;}
  return {
    start:name=>state.batchBusy?Promise.resolve(false):run(name,null),
    startAll(names){
      if(disposed||state.busy||state.batchBusy||read()||!supported(capabilities()))return Promise.resolve(false);
      const selected=[...new Set(names)].filter(eligible);
      // Update providers last, so earlier operations retain their connection.
      const rank=name=>name==='dshmarket'?2:name==='dsh-local-plugin-center'?1:0;
      selected.sort((a,b)=>rank(a)-rank(b));if(!selected.length)return Promise.resolve(false);
      batch={names:selected,total:selected.length,current:null};saveBatch();return runBatch();
    },
    resume(){
      if(disposed||state.busy||state.batchBusy)return Promise.resolve(false);
      batch=readBatch();if(batch)return runBatch();
      const record=read();return record?run(record.name,record):Promise.resolve(false);
    },
    getState:()=>state,supported,
    dispose({discardBatch=false}={}){disposed=true;if(discardBatch){batch=null;saveBatch();}for(const [timer,resolve] of waits){clearTimeout(timer);resolve();}waits.clear();}
  };
};
    const {resolveRepositories}=(function createRepositoryTools(){
  function repositoryUrl(value){
    if(value&&typeof value==='object')value=value.url;
    if(typeof value!=='string')return null;
    value=value.trim().replace(/^git\+/i,'').replace(/^git@github\.com:/i,'https://github.com/').replace(/^ssh:\/\/git@github\.com\//i,'https://github.com/').replace(/^github:/i,'https://github.com/');
    if(/^[\w.-]+\/[\w.-]+(?:#.*)?$/.test(value))value='https://github.com/'+value;
    // Region proxies prefix the original archive URL. Extract its repository,
    // never the proxy itself, and never use the result as an installation target.
    const nested=value.match(/https:\/\/(?:github\.com|codeload\.github\.com|api\.github\.com)\/[^\s]+/i);
    if(nested)value=nested[0];
    try{
      const url=new URL(value);let parts=url.pathname.split('/').filter(Boolean);
      if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
      if(url.hostname==='api.github.com'){if(parts.shift()!=='repos')return null;}
      else if(!['github.com','codeload.github.com'].includes(url.hostname))return null;
      if(parts.length<2)return null;
      parts=parts.slice(0,2);parts[1]=parts[1].replace(/\.git$/i,'');
      if(!parts.every(p=>/^[\w.-]+$/.test(p)&&p!=='.'&&p!=='..'))return null;
      return 'https://github.com/'+parts.join('/');
    }catch{return null;}
  }
  function resolveRepositories(names,local={},installed={},catalog=[]){
    const result=Object.create(null),plugins=Array.isArray(catalog)?catalog:[];
    const unique=values=>[...new Map(values.map(repositoryUrl).filter(Boolean).map(url=>[url.toLowerCase(),url])).values()];
    for(const name of names){
      const spec=installed.installed?.[name]??local.specs?.[name]??'';
      const source=repositoryUrl(spec);
      if(source){result[name]=source;continue;}
      // A URL install from another host must not be reassigned to an unrelated
      // catalog entry merely because the packages happen to share a name.
      if(typeof spec==='string'&&/^(?:https?:|git\+|git:|ssh:)/i.test(spec))continue;
      const known=unique([...(Array.isArray(installed.repoIdentities?.[name])?installed.repoIdentities[name]:[]),local.repositories?.[name]]);
      if(known.length===1){result[name]=known[0];continue;}
      if(known.length>1)continue;
      const hints=unique(Array.isArray(installed.repoHints?.[name])?installed.repoHints[name]:[]);
      if(hints.length===1){result[name]=hints[0];continue;}
      const npmAlias=typeof spec==='string'?spec.match(/^npm:((?:@[^/]+\/)?[^@]+)(?:@|$)/)?.[1]:null;
      const keys=new Set([name,npmAlias].filter(Boolean).map(x=>x.toLowerCase()));
      // Prefer npm identity; only use the catalog name if it has one unique repo.
      let matches=plugins.filter(p=>typeof p?.npm==='string'&&keys.has(p.npm.toLowerCase()));
      if(!matches.length)matches=plugins.filter(p=>typeof p?.name==='string'&&keys.has(p.name.toLowerCase()));
      const urls=unique(matches.map(p=>p.url));
      if(urls.length===1)result[name]=urls[0];
    }
    return result;
  }
  return {repositoryUrl,resolveRepositories};
})();
    const createDetailNavigation=function createDetailNavigation({window:win,hasDetail,goList}){
  const key='tanukiPluginDetail',owner=Math.random().toString(36).slice(2);
  let open=false,suppress=false,disposed=false;
  const ours=()=>win.history.state?.[key]?.owner===owner;
  function sync(){
    if(disposed)return;
    const detail=hasDetail();
    if(suppress){if(!detail){suppress=false;open=false;}return;}
    if(detail&&!open){
      open=true;
      const state={...(win.history.state||{}),[key]:{owner}};
      if(win.history.state?.[key])win.history.replaceState(state,'');else win.history.pushState(state,'');
    }else if(!detail&&open){open=false;if(ours())win.history.back();}
  }
  const pop=()=>{if(hasDetail()&&!ours()){suppress=true;open=false;goList();}};
  const back=()=>{if(!hasDetail())return false;if(ours())win.history.back();else{open=false;suppress=true;goList();}return true;};
  const keys=event=>{if(event.altKey&&!event.ctrlKey&&!event.metaKey&&event.key==='ArrowLeft'&&hasDetail()){event.preventDefault();event.stopPropagation();back();}};
  win.addEventListener('popstate',pop);win.addEventListener('keydown',keys,true);sync();
  return {sync,back,dispose(){disposed=true;win.removeEventListener('popstate',pop);win.removeEventListener('keydown',keys,true);if(ours()){const state={...win.history.state};delete state[key];win.history.replaceState(state,'');}}};
};
    const createViewHandoff=function createViewHandoff({window:win,document:doc,css}){
  const key='__tanukiViewHandoffV1';
  function clear(){const state=win[key];if(!state)return;win.clearTimeout(state.timeout);win.clearTimeout(state.readyTimer);state.cover.remove();win.removeEventListener('resize',state.cancel);doc.removeEventListener('click',state.outside,true);delete win[key];}
  function capture(page,owner,revision,leaving=false){
    if(leaving){clear();return;}
    if(!page?.isConnected)return;
    clear();const rect=page.getBoundingClientRect(),style=win.getComputedStyle(page);
    const cover=doc.createElement('div'),copy=page.cloneNode(true),sheet=doc.createElement('style');
    cover.dataset.tanukiHandoff='';cover.setAttribute('aria-hidden','true');cover.inert=true;
    Object.assign(cover.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',zIndex:'10000',overflow:'hidden',background:style.backgroundColor==='rgba(0, 0, 0, 0)'?'var(--dsw-alias-bg-base,#151515)':style.backgroundColor,font:style.font,color:style.color});
    // Keep the previous frame's CSS even when the old plugin fiber retracts it.
    sheet.textContent=css;cover.append(sheet,copy);copy.style.height=rect.height+'px';copy.style.width='100%';copy.style.boxSizing='border-box';copy.style.margin='0';
    for(const element of copy.querySelectorAll('[id]'))element.removeAttribute('id');
    doc.body.append(cover);copy.scrollTop=page.scrollTop;
    const state={cover,owner,revision,scrollTop:page.scrollTop,tab:page.dataset.tanukiCenter,category:page.dataset.tanukiCategory,cancel:clear,outside:event=>{if(!page.contains(event.target)&&!cover.contains(event.target))clear();}};
    state.timeout=win.setTimeout(clear,8000);win[key]=state;
    win.addEventListener('resize',state.cancel);doc.addEventListener('click',state.outside,true);
  }
  function ready(page,owner,revision){
    const state=win[key];if(!state||!page?.isConnected||(state.owner===owner&&revision<=state.revision)||page.dataset.tanukiCenter!==state.tab||page.dataset.tanukiCategory!==state.category)return;
    win.clearTimeout(state.readyTimer);
    state.readyTimer=win.setTimeout(()=>{if(win[key]!==state||!page.isConnected)return;page.scrollTop=state.scrollTop;win.requestAnimationFrame(()=>win.requestAnimationFrame(()=>{if(win[key]===state)clear();}));},250);
  }
  return {capture,ready,clear,pending:()=>!!win[key]};
};
    const createPluginAliases=function createPluginAliases({React,useLocale,json}){
  const h=React.createElement,listeners=new Set(),requests=new Set();
  let alive=true,flight=null,state={ready:false,loading:false,values:Object.create(null)};
  const publish=patch=>{if(!alive)return;state={...state,...patch};for(const fn of [...listeners])fn();};
  const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
  async function request(options){
    if(!alive)throw new Error('Component stopped');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);requests.add(controller);
    try{return await json('/tanuki-toolbox/plugin-aliases',controller.signal,options);}
    finally{clearTimeout(timer);requests.delete(controller);}
  }
  async function load(){
    if(!alive||state.ready)return state.ready;if(flight)return flight;
    publish({loading:true});
    flight=request().then(value=>{
      if(value?.schema!==1||!value.aliases||Array.isArray(value.aliases)||typeof value.aliases!=='object')throw new Error('Invalid names');
      const values=Object.create(null);for(const [name,alias] of Object.entries(value.aliases))if(typeof alias==='string')values[name]=alias;
      publish({ready:true,values});return alive;
    }).catch(()=>false).finally(()=>{flight=null;publish({loading:false});});return flight;
  }
  const notify=key=>{if(alive)window.dispatchEvent(new CustomEvent('tanuki:notify',{detail:{id:'alias:'+Date.now(),destination:{page:'plugins',category:'installed'},title:{zh:'自定义名称',en:'Custom name'},message:key==='load'?{zh:'暂时无法读取自定义名称，请稍后重试。',en:'Could not load custom names. Please try again.'}:{zh:'名称未能保存，请重试。',en:'The name could not be saved. Please retry.'}}}));};
  async function save(name,alias){
    const result=await request({method:'PUT',body:{name,alias}});
    if(result?.schema!==1||result.name!==name||typeof result.alias!=='string')throw new Error('Invalid saved name');
    if(!alive)return;
    const values=Object.assign(Object.create(null),state.values);
    if(result.alias)values[name]=result.alias;else delete values[name];
    publish({values});
  }
  function Title({name,heading}){
    const model=React.useSyncExternalStore(subscribe,()=>state),value=model.values[name]||'';
    return value?h('button',{type:'button',className:'tanuki-alias-text',title:value,onClick:event=>{event.stopPropagation();heading.querySelector(':scope > button')?.click();}},value):null;
  }
  function Alias({name}){
    const tr=useLocale(),model=React.useSyncExternalStore(subscribe,()=>state),value=model.values[name]||'';
    const [editing,setEditing]=React.useState(false),[draft,setDraft]=React.useState(''),[saving,setSaving]=React.useState(false);
    const input=React.useRef(null),mounted=React.useRef(false),isEditing=React.useRef(false),pending=React.useRef(false),composing=React.useRef(false);
    React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;isEditing.current=false;};},[]);
    React.useLayoutEffect(()=>{if(editing){input.current?.focus();input.current?.select();}},[editing]);
    const cancel=()=>{isEditing.current=false;setEditing(false);setDraft(value);};
    async function finish(){
      if(!alive||!isEditing.current||pending.current)return;
      const alias=Array.from(draft.replace(/[\u0000-\u001f\u007f]/g,' ').trim()).slice(0,120).join('');
      if(alias===value){cancel();return;}
      pending.current=true;setSaving(true);
      try{await save(name,alias);if(alive&&mounted.current){isEditing.current=false;setEditing(false);}}
      catch{if(alive&&mounted.current)notify('save');}
      finally{pending.current=false;if(alive&&mounted.current)setSaving(false);}
    }
    async function edit(){
      if(editing){void finish();return;}
      if(!state.ready&&!await load()){if(mounted.current)notify('load');return;}
      if(!alive||!mounted.current)return;
      setDraft(state.values[name]||'');isEditing.current=true;setEditing(true);
    }
    return h('span',{className:'tanuki-alias-editor','data-editing':editing||undefined,'aria-busy':saving||undefined,onClick:event=>event.stopPropagation(),onKeyDown:event=>event.stopPropagation()},
      editing?h('input',{ref:input,type:'text',className:'tanuki-alias-input',value:draft,maxLength:120,readOnly:saving,'aria-label':tr('aliasLabel'),placeholder:tr('aliasPlaceholder'),title:tr('aliasHint'),autoComplete:'off',spellCheck:false,onChange:event=>setDraft(event.target.value),onCompositionStart:()=>{composing.current=true;},onCompositionEnd:()=>{composing.current=false;},onBlur:()=>{if(!pending.current)cancel();},onKeyDown:event=>{event.stopPropagation();if(composing.current||event.nativeEvent.isComposing||event.keyCode===229)return;if(event.key==='Enter'){event.preventDefault();void finish();}else if(event.key==='Escape'&&!pending.current){event.preventDefault();cancel();}}}):
      h('button',{type:'button',className:'tanuki-alias-edit',disabled:saving||model.loading,'aria-label':tr('aliasEdit'),'aria-expanded':editing,title:tr('aliasEdit'),onClick:()=>void edit()},tr('aliasRename')));

  }
  return {Alias,Title,load,subscribe,getSnapshot:()=>state,dispose(){alive=false;for(const controller of requests)controller.abort();requests.clear();listeners.clear();state={ready:false,loading:false,values:Object.create(null)};}};
};
    const createPluginArtwork=function createPluginArtwork({document}){
  const entries=new Map();let disposed=false;
  const marker='data-tanuki-plugin-artwork',ready='data-tanuki-artwork-ready';
  function initials(name){
    const label=name.replace(/^@[^/]+\//,'').replace(/^dsh[-_]/i,'').replace(/([a-z])([A-Z])/g,'$1 $2');
    const words=label.split(/[-_\s]+/).filter(Boolean);
    return (words.length>1?words[0][0]+words[1][0]:label.slice(0,2)).toUpperCase()||'?';
  }
  function remove(entry){entry.disposed=true;entry.image.onload=null;entry.image.onerror=null;entry.image.removeAttribute('src');entry.host.remove();entry.slot.removeAttribute(ready);}
  function sync(page,bundles,icons){
    if(disposed)return;
    const packages=new Map(bundles.filter(p=>p.installed&&p.official!==true&&!(p.official===undefined&&p.optional===true)).map(p=>[p.name,p]));
    const targets=new Map();
    for(const owner of page.querySelectorAll('[data-plugin-group="bundles"] [data-plugin-package], [data-plugin-detail]')){
      const name=owner.getAttribute('data-plugin-package')||owner.getAttribute('data-plugin-detail'),pkg=packages.get(name);
      if(!pkg)continue;
      const slot=owner.querySelector(owner.hasAttribute('data-plugin-detail')?':scope > [data-window-drag] > div:last-child > span:first-child':':scope > div:first-child > span:first-child');
      if(!slot)continue;
      // Preserve a host-provided image, including future author icon declarations.
      const native=slot.querySelector(':scope > img');
      if(native&&(!native.complete||native.naturalWidth>0))continue;
      const art=icons[name],usable=art&&art.version===pkg.version&&typeof art.src==='string'&&/^data:image\/(?:svg\+xml|png|webp|jpeg|gif|x-icon);base64,[a-z\d+/=]+$/i.test(art.src);
      targets.set(slot,{name,src:usable?art.src:'',mask:usable&&art.mask===true});
    }
    for(const [slot,entry] of entries){
      const next=targets.get(slot);
      if(!next||next.name!==entry.name||next.src!==entry.src||next.mask!==entry.mask||entry.host.parentElement!==slot){remove(entry);entries.delete(slot);}
    }
    for(const [slot,target] of targets){
      if(entries.has(slot))continue;
      const host=document.createElement('span'),label=document.createElement('span'),image=document.createElement('img');
      host.setAttribute(marker,'');host.setAttribute('aria-hidden','true');host.className='tanuki-plugin-artwork';
      label.className='tanuki-plugin-initials';label.textContent=initials(target.name);
      image.alt='';image.draggable=false;image.hidden=true;host.append(label,image);
      const entry={...target,slot,host,image,disposed:false};entries.set(slot,entry);
      image.onload=()=>{
        if(disposed||entry.disposed||!host.isConnected)return;
        label.hidden=true;
        if(target.mask){host.classList.add('tanuki-plugin-artwork-mask');host.style.setProperty('--tanuki-plugin-mask','url("'+target.src+'")');}
        else image.hidden=false;
      };
      image.onerror=()=>{if(!disposed&&!entry.disposed){label.hidden=false;image.hidden=true;}};
      slot.appendChild(host);slot.setAttribute(ready,'');
      if(target.src)image.src=target.src;
    }
  }
  return {sync,dispose(){disposed=true;for(const entry of entries.values())remove(entry);entries.clear();}};
};
    const VIEW_KEY='tanuki-toolbox:center-view-v1';
    let savedView={tab:null,category:'installed',marketMode:null};
    try{const saved=JSON.parse(sessionStorage.getItem(VIEW_KEY)||'null');if(saved)savedView={tab:['market','manage'].includes(saved.tab)?saved.tab:null,category:saved.category==='official'?'official':'installed',marketMode:saved.marketMode==='installed'?'installed':null};}catch{}
    function rememberView(patch){savedView={...savedView,...patch};try{sessionStorage.setItem(VIEW_KEY,JSON.stringify(savedView));}catch{}}
    const dictionaries={"zh":{"title":"插件中心","toolbox":"黎猫工具箱","market":"插件市场","manage":"已安装","official":"官方","installed":"第三方","back":"返回对话","pluginList":"插件列表","pages":"插件中心页面","groups":"插件分类","updates":"{n} 个已启用插件可更新","check":"检查更新","checking":"正在检查插件更新…","unknown":"暂时无法检查更新","latest":"未发现已启用插件的可用更新","viewUpdates":"去市场更新","updateHint":"可用更新","error":"市场暂时无法显示，请在“已安装”中检查插件市场。","retry":"重新加载市场","empty":"这个分类暂时没有插件。","update":"更新","updating":"更新中","updateVersion":"更新至 {version}","noUpdate":"暂无可用更新","updateUnavailable":"请先启用支持更新接口的插件市场","updateDone":"{name} 已更新。","updateRestart":"{name} 已更新，重启 DSH 后生效。","updateFailed":"{name} 更新失败，请到插件市场的任务中查看详情。","updateUnknown":"{name} 的更新状态暂时无法确认，请到插件市场的任务中查看。","updateFresh":"新版本暂未通过市场的发布时间检查，请稍后重试。","updateBusy":"插件市场正在执行其他更新，请稍后重试。","dismiss":"关闭提示","checkProgress":"重新检查进度","gitOpen":"在浏览器中打开 GitHub 仓库","gitMissing":"此插件尚未提供 GitHub 地址","builtinAlwaysOn":"内置功能随 DSH 运行","builtinUpdate":"此内置功能随 DSH 更新","updateReload":"{name} 已更新，刷新 DSH 界面后生效。","updateLatest":"最新","updateCheckUnavailable":"暂时无法确认最新版本，请检查网络后重试。","gitLoading":"正在读取仓库信息","gitUnavailable":"暂时无法读取仓库信息，请稍后刷新。","aliasLabel":"插件自定义名称","aliasPlaceholder":"输入自定义名称","aliasEdit":"编辑自定义名称","aliasSave":"保存自定义名称","aliasSaving":"正在保存…","aliasHint":"Enter 保存，Esc 或点击框外取消；清空后保存可恢复原名。","aliasRename":"命名","updateAll":"更新全部","updateAllCount":"更新全部 {n} 个插件","updateAllProgress":"正在更新 {current} / {total}","search":"搜索插件昵称或原名","stable":"正式版","experimental":"实验性插件"},"en":{"title":"Plugin Center","toolbox":"Tanuki Toolbox","market":"Marketplace","manage":"Installed","official":"Official","installed":"Third-party","back":"Back to chat","pluginList":"Plugins","pages":"Plugin Center pages","groups":"Plugin categories","updates":"{n} enabled plugins have updates","check":"Check for updates","checking":"Checking for plugin updates…","unknown":"Updates could not be checked","latest":"No updates found for enabled plugins","viewUpdates":"Update in Marketplace","updateHint":"Update available","error":"The market is unavailable. Check Plugin Market in Installed.","retry":"Reload marketplace","empty":"No plugins in this category yet.","update":"Update","updating":"Updating","updateVersion":"Update to {version}","noUpdate":"No update available","updateUnavailable":"Enable Plugin Market with update API support first","updateDone":"{name} has been updated.","updateRestart":"{name} has been updated. Restart DSH to apply it.","updateFailed":"Could not update {name}. See Tasks in Marketplace for details.","updateUnknown":"The update status for {name} could not be confirmed. See Tasks in Marketplace.","updateFresh":"The new release is still within the market’s release-age wait. Try again later.","updateBusy":"Marketplace is running another update. Try again later.","dismiss":"Dismiss","checkProgress":"Check progress again","gitOpen":"Open the GitHub repository in your browser","gitMissing":"This plugin has not provided a GitHub repository","builtinAlwaysOn":"Built-in feature runs with DSH","builtinUpdate":"This built-in feature updates with DSH","updateReload":"{name} has been updated. Reload the DSH interface to apply it.","updateLatest":"Latest","updateCheckUnavailable":"The latest version could not be confirmed. Check your connection and retry.","gitLoading":"Loading repository details","gitUnavailable":"Repository details are temporarily unavailable. Please refresh later.","aliasLabel":"Custom plugin name","aliasPlaceholder":"Enter a custom name","aliasEdit":"Edit custom name","aliasSave":"Save custom name","aliasSaving":"Saving…","aliasHint":"Enter to save; Esc or click outside to cancel. Save an empty name to restore the original.","aliasRename":"Name","updateAll":"Update all","updateAllCount":"Update all {n} plugins","updateAllProgress":"Updating {current} / {total}","search":"Search by custom or original plugin name","stable":"Stable","experimental":"Experimental plugins"}};
    const css="[data-plugin-panel][data-tanuki-center]{gap:8px;padding-inline:clamp(6px,.65vw,10px);width:100%;max-width:none;min-width:0;box-sizing:border-box;align-items:stretch;container-type:inline-size;container-name:tanuki-center;}\r\n[data-plugin-panel][data-tanuki-center]>*{max-width:none;min-width:0;}\r\n[data-plugin-panel][data-tanuki-center]>[data-tanuki-toolbar]{flex:none;order:-1;width:100%;max-width:none;position:sticky;top:0;z-index:5;padding-top:14px;background:var(--dsw-alias-bg-base,#151515);}\r\n.tanuki-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:8px;}\r\n.tanuki-heading h1{font-size:22px;line-height:30px;font-weight:600;margin:0;}\r\n.tanuki-actions{display:flex;align-items:center;gap:6px;}\r\n.tanuki-tabs,.tanuki-subtabs{display:flex;gap:6px;align-items:center;border-bottom:1px solid var(--dsw-alias-border-l2,#ffffff16);padding-bottom:8px;}\r\n.tanuki-subtabs{padding-top:8px;border-bottom:0;min-height:36px;}\r\n.tanuki-list-action-anchor{height:36px;min-width:150px;flex:none;margin-left:auto;}\r\n.tanuki-button,.tanuki-quiet,.tanuki-link{font:inherit;font-size:14px;line-height:20px;color:var(--dsw-alias-label-secondary,#b2b2b2);background:transparent;border:1px solid transparent;cursor:pointer;border-radius:8px;padding:7px 14px;display:inline-flex;gap:7px;align-items:center;white-space:nowrap;}\r\n.tanuki-button:hover,.tanuki-quiet:hover{background:var(--dsw-alias-bg-layer-2,#292929);color:var(--dsw-alias-label-primary,#fff);}\r\n.tanuki-button[aria-pressed=true]{background:var(--dsw-alias-bg-layer-3,#353535);color:var(--dsw-alias-label-primary,#fff);font-weight:600;}\r\n.tanuki-button:focus-visible,.tanuki-quiet:focus-visible,.tanuki-link:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px;}\r\n.tanuki-quiet{font-size:12px;padding:6px 8px;}\r\n.tanuki-quiet:disabled{opacity:.55;cursor:wait;}\r\n.tanuki-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;border-radius:99px;background:#b97846;color:#fff;font-size:11px;font-weight:600;line-height:18px;}\r\nbutton:has(.tanuki-sidebar-icon){position:relative;}\r\nbutton:has(.tanuki-sidebar-icon):has(>span:nth-child(2)){padding-left:6px;padding-right:40px;gap:6px;}\r\n.tanuki-sidebar-icon{object-fit:contain;flex:none;}\r\n/* Own only the fallback layer; native React artwork is restored on cleanup. */\r\n[data-tanuki-artwork-ready]{position:relative;}\r\n[data-tanuki-artwork-ready]>:not([data-tanuki-plugin-artwork]){visibility:hidden;}\r\n.tanuki-plugin-artwork{position:absolute;inset:3px;display:flex;align-items:center;justify-content:center;pointer-events:none;border-radius:inherit;overflow:hidden;color:var(--dsw-alias-label-primary,#eee);}\r\n.tanuki-plugin-artwork>img{display:block;width:100%;height:100%;object-fit:contain;}\r\n.tanuki-plugin-artwork [hidden]{display:none!important;}\r\n.tanuki-plugin-initials{display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:inherit;background:var(--dsw-alias-bg-layer-2,#303238);color:var(--dsw-alias-label-primary,#eee);font-size:15px;font-weight:600;letter-spacing:.03em;}\r\n.tanuki-plugin-artwork-mask::after{content:'';width:85%;height:85%;background:currentColor;mask:var(--tanuki-plugin-mask) center/contain no-repeat;-webkit-mask:var(--tanuki-plugin-mask) center/contain no-repeat;}\r\n.tanuki-side-badge{position:absolute;right:10px;top:50%;transform:translateY(-50%);}\r\nbutton:has(.tanuki-sidebar-icon):not(:has(>span:nth-child(2))) .tanuki-side-badge{right:0;top:0;transform:none;min-width:12px;height:12px;font-size:8px;padding:0 3px;}\r\n[data-tanuki-center=market]{overflow:hidden!important;padding-bottom:0!important;}\r\n[data-tanuki-center=market]>:not([data-tanuki-toolbar]):not([data-tanuki-market]){display:none!important;}\r\n[data-tanuki-center]>[data-tanuki-market]{width:100%;max-width:none;flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;}\r\n[data-tanuki-market][hidden]{display:none!important;}\r\n[data-tanuki-market]>*{min-height:0;flex:1;}\r\n[data-tanuki-center=manage]>header>div:first-child{display:none!important;}\r\n/* This header is anchored to our toolbar. Native macOS pageHead top padding\r\n   otherwise wins specificity and shifts its buttons below the tab row. */\r\n[data-tanuki-center=manage]>header{width:auto!important;min-height:0;padding:0!important;margin:0;z-index:6;position:fixed;top:var(--tanuki-list-top,-1000px);right:var(--tanuki-list-right,0px);transform:translateY(-50%);pointer-events:none;}\r\n[data-tanuki-center=manage]>header>div{pointer-events:auto;}\r\n[data-tanuki-center=manage] [data-plugin-group]>div:first-child{display:none!important;}\r\n[data-tanuki-center=manage][data-tanuki-category=installed] :is([data-plugin-group=official],[data-plugin-group=basic],[data-plugin-group=extensions],[data-plugin-group=more]){display:none!important;}\r\n[data-tanuki-center=manage][data-tanuki-category=official] [data-plugin-group=bundles]{display:none!important;}\r\n/* Keep the host's optional official catalog reachable without duplicating its controls. */\r\n[data-tanuki-center=manage][data-tanuki-category=official] [data-plugin-group=extensions]>div:first-child:has(button){display:flex!important;justify-content:flex-end;margin-bottom:8px;}\r\n[data-tanuki-center=manage][data-tanuki-category=official] [data-plugin-group=extensions]>div:first-child>h3{display:none;}\r\n[data-tanuki-center=manage]>header[data-window-drag]:has(>button:first-child){display:none!important;}\r\n.tanuki-backbar{padding:8px 0;border-top:1px solid var(--dsw-alias-border-l2,#ffffff16);display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:36px;}\r\n.tanuki-action-anchor{height:36px;flex:none;}\r\n[data-tanuki-center=manage] [data-tanuki-pinned-actions]{position:fixed;top:var(--tanuki-actions-top);right:var(--tanuki-actions-right);transform:translateY(-50%);z-index:7;margin:0;-webkit-app-region:no-drag;}\r\n[data-tanuki-update-host]{display:inline-flex;align-items:center;margin-right:12px;}\r\n[data-tanuki-pinned-actions]>[data-tanuki-update-host]{margin-right:0;}\r\n.tanuki-update-button{display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:4px 12px;border:1px solid var(--dsw-alias-border-l2,#ffffff20);border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#b2b2b2);font:inherit;font-size:12px;line-height:20px;white-space:nowrap;cursor:pointer;}\r\n.tanuki-update-button[data-available]{background:#e6e63c;color:#000;border-color:#e6e63c;}\r\n.tanuki-update-button[data-available]:hover:not(:disabled){background:#e6e63c;color:#000;border-color:#e6e63c;}\r\n.tanuki-update-button:disabled{opacity:.4;cursor:default;}\r\n.tanuki-update-button[data-available]:disabled{opacity:.7;cursor:wait;}\r\n.tanuki-update-button:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:3px;}\r\n[data-tanuki-update-all-host]{display:inline-flex;align-items:center;flex:none;}\r\n.tanuki-update-all{min-height:34px;padding:6px 12px;font-size:13px;}\r\n.tanuki-update-notice{display:flex;gap:8px;align-items:center;font-size:12px;line-height:20px;padding:6px 0;}\r\n.tanuki-update-notice>span{flex:1;}\r\n.tanuki-back{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:4px 0;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#b2b2b2);font:inherit;font-size:14px;cursor:pointer;}\r\n.tanuki-back:hover{color:var(--dsw-alias-label-primary,#fff);}\r\n.tanuki-back:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:4px;border-radius:4px;}\r\n[data-tanuki-center=manage] :is([data-plugin-detail],[data-plugin-item-detail],[data-plugin-row-detail])>[data-window-drag]>button:first-child{display:none!important;}\r\n[data-tanuki-center=manage] :is([data-plugin-detail],[data-plugin-item-detail],[data-plugin-row-detail])>[data-window-drag]{padding-top:4px;}\r\n[data-tanuki-center=manage] :is([data-plugin-detail],[data-plugin-item-detail],[data-plugin-row-detail])>[data-window-drag]>div:last-child{margin-top:12px;}\r\n[data-tanuki-center=manage] [data-plugin-rows] code{display:none!important;}\r\n[data-tanuki-center=manage] [data-plugin-rows]>div:first-child>span{display:none!important;}\r\n[data-tanuki-center=manage] [data-plugin-row]>div:first-child>span:last-of-type{display:none!important;}\r\n[data-plugin-detail=\"dsh-local-plugin-center\"] [data-plugin-rows] code,\r\n[data-plugin-detail=\"dsh-local-plugin-center\"] [data-plugin-rows]>div:first-child>span,\r\n[data-plugin-detail=\"dsh-local-plugin-center\"] [data-plugin-row]>div:first-child>span:last-of-type{display:none!important;}\r\n[data-tanuki-center=manage] [data-plugin-row]>div:first-child>div>span:nth-child(2),\r\n[data-plugin-detail=\"dsh-local-plugin-center\"] [data-plugin-row]>div:first-child>div>span:nth-child(2){font-family:inherit;font-size:13px;line-height:20px;}\r\n.tanuki-muted{opacity:.75;}\r\n.tanuki-update-line{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;padding:6px 0;}\r\n.tanuki-link{color:var(--dsw-alias-link);font-size:12px;padding:4px 8px;}\r\n.tanuki-error{padding:24px;border:1px solid var(--dsw-alias-border-l2,#444);border-radius:10px;}\r\n@media(max-width:700px){.tanuki-heading h1{font-size:19px}.tanuki-button{padding:6px 10px}.tanuki-list-action-anchor{min-width:120px;}}\r\n\r\n/* Keep native titles, switches and navigation; only change the list presentation. */\r\n[data-tanuki-center=manage] [data-plugin-group]{width:100%;max-width:none;flex:none;margin-top:4px;}\r\n[data-tanuki-center=manage] [data-plugin-group]>ul{display:grid;grid-template-columns:minmax(0,1fr);align-items:stretch;gap:8px;width:100%;padding:0;margin:0;list-style:none;}\r\n[data-tanuki-center=manage] [data-plugin-group=bundles]>ul{grid-auto-rows:148px;}\r\n[data-tanuki-center=manage] [data-plugin-group=bundles] [data-plugin-package]>div:first-child{height:100%;box-sizing:border-box;grid-template-rows:44px minmax(0,1fr);min-height:0;}\r\n[data-tanuki-center=manage] :is([data-plugin-package],[data-plugin-item]){min-width:0;padding:8px!important;margin:0;border:1px solid var(--dsw-alias-border-l2,#ffffff20);border-radius:12px;background:var(--dsw-alias-bg-layer-1,#202020);box-sizing:border-box;}\r\n[data-tanuki-center=manage] :is([data-plugin-package],[data-plugin-item]):hover{background:var(--dsw-alias-bg-layer-2,#292929);}\r\n[data-tanuki-center=manage] :is([data-plugin-package],[data-plugin-item])>div:first-child{display:grid;grid-template-columns:40px minmax(0,1fr) var(--tanuki-control-width,36px);grid-template-rows:auto 1fr;align-items:start;column-gap:8px;row-gap:8px;min-height:104px;}\r\n[data-tanuki-center=manage] :is([data-plugin-package],[data-plugin-item])>div:first-child>span:first-child{grid-column:1;grid-row:1;width:40px;height:40px;border-radius:10px;}\r\n[data-tanuki-center=manage] :is([data-plugin-package],[data-plugin-item])>div:first-child>span:first-child img{max-width:100%;max-height:100%;object-fit:contain;}\r\n[data-tanuki-center=manage] :is([data-plugin-package],[data-plugin-item])>div:first-child>div:nth-child(2){display:contents;}\r\n[data-tanuki-center=manage] :is([data-plugin-package],[data-plugin-item])>div:first-child>div:nth-child(2)>div:first-child{grid-column:2;grid-row:1;align-self:center;display:flex;flex-wrap:wrap;gap:6px;min-width:0;}\r\n[data-tanuki-center=manage] :is([data-plugin-package],[data-plugin-item])>div:first-child>div:nth-child(2)>div:first-child>button{font-size:16px;line-height:23px;font-weight:600;text-align:left;white-space:normal;overflow-wrap:anywhere;overflow:visible;text-overflow:clip;}\r\n[data-tanuki-center=manage] :is([data-plugin-package],[data-plugin-item])>div:first-child>div:nth-child(2)>span{grid-column:1 / 3;grid-row:2;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;line-clamp:3;max-height:66px;font-size:13px;line-height:22px;color:var(--dsw-alias-label-secondary,#b2b2b2);white-space:normal;overflow:hidden;overflow-wrap:anywhere;text-overflow:ellipsis;}\r\n[data-tanuki-center=manage] [data-plugin-package]>div:first-child>div:last-child{grid-column:3;grid-row:1 / 3;display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-start;gap:8px;margin:0;align-self:stretch;}\r\n[data-tanuki-card-extras],[data-tanuki-builtin-actions]{display:flex;flex-direction:column;align-items:flex-end;gap:8px;margin:0;}\r\n/* Compact installed-card actions so the fourth action retains bottom breathing room. */\r\n[data-tanuki-center=manage] [data-plugin-group=bundles] [data-plugin-package]>div:first-child>div:last-child,\r\n[data-tanuki-center=manage] [data-plugin-group=bundles] [data-tanuki-card-extras]{gap:4px;}\r\n[data-tanuki-builtin-actions]{grid-column:3;grid-row:1 / 3;gap:12px;}\r\n[data-tanuki-card-extras] .tanuki-update-button,[data-tanuki-card-extras] .tanuki-git-button{width:var(--tanuki-control-width,36px);height:max(28px,calc(var(--tanuki-control-height,22px) + 6px));min-height:28px;padding:0 2px;font-size:10px;line-height:18px;border-radius:var(--tanuki-control-radius,99px);box-sizing:border-box;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}\r\n.tanuki-git-button{display:inline-flex;align-items:center;justify-content:center;min-height:30px;padding:4px 12px;border:1px solid var(--dsw-alias-border-l2,#ffffff20);border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#b2b2b2);font:inherit;font-size:12px;line-height:20px;text-decoration:none;cursor:pointer;}\r\n.tanuki-git-button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-3,#353535);color:var(--dsw-alias-label-primary,#fff);}\r\n.tanuki-git-button:disabled{opacity:.4;cursor:default;}\r\n[data-tanuki-center=manage] :is([data-plugin-group=official],[data-plugin-group=basic],[data-plugin-group=extensions],[data-plugin-group=more]) :is([data-plugin-package],[data-plugin-item])>div:first-child{min-height:0;grid-template-rows:40px auto;row-gap:6px;}\r\n[data-tanuki-center=manage] [data-plugin-item]>div:first-child{grid-template-columns:40px minmax(0,1fr);}\r\n[data-tanuki-center=manage] :is([data-plugin-group=official],[data-plugin-group=basic],[data-plugin-group=extensions],[data-plugin-group=more]) :is([data-plugin-package],[data-plugin-item])>div:first-child>div:nth-child(2)>span{-webkit-line-clamp:2;line-clamp:2;max-height:44px;}\r\n[data-tanuki-center=manage] [role=switch]{transition:filter .16s ease,box-shadow .16s ease,transform .16s ease;}\r\n[data-tanuki-center=manage] [role=switch]:not(:disabled):hover{filter:brightness(1.2);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-business-primary) 28%,transparent);transform:scale(1.05);}\r\n[data-tanuki-center=manage] [role=switch]:not(:disabled):active{transform:scale(.97);}\r\n@media(prefers-reduced-motion:reduce){[data-tanuki-center=manage] [role=switch]{transition:none;}}\r\n\r\n/* Preserve the native title button and its navigation. Both names share one line. */\r\n[data-tanuki-center=manage] [data-plugin-group=bundles] [data-plugin-package]>div:first-child>span:first-child{align-self:start;}\r\n[data-tanuki-center=manage] [data-plugin-group=bundles] [data-plugin-package]>div:first-child>div:nth-child(2)>[data-tanuki-alias-heading]{position:relative;display:flex;flex-wrap:nowrap;align-items:baseline;align-self:start;gap:5px;height:40px;padding-top:1px;padding-bottom:17px;box-sizing:border-box;min-width:0;}\r\n.tanuki-installed-version{position:absolute;left:0;right:0;bottom:0;display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;line-height:16px;font-weight:400;color:var(--dsw-alias-label-secondary,#aaa);font-variant-numeric:tabular-nums;}\r\n[data-tanuki-center=manage] [data-plugin-group=bundles] [data-plugin-package]>div:first-child>div:nth-child(2)>[data-tanuki-alias-heading]>button{flex:0 1 auto;min-width:0;max-width:100%;padding:0;font-size:17px;line-height:22px;font-weight:600;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\r\n[data-tanuki-center=manage] [data-plugin-group=bundles] [data-plugin-package]>div:first-child>div:nth-child(2)>[data-tanuki-alias-heading]:has(.tanuki-alias-text)>button{font-size:15px;line-height:20px;font-weight:400;color:var(--dsw-alias-label-secondary,#aaa);}\r\n[data-tanuki-center=manage] [data-tanuki-alias-heading]>:not(button):not([data-tanuki-alias-host]){flex:none;max-height:18px;font-size:10px;line-height:16px;white-space:nowrap;}\r\n[data-tanuki-alias-host]{display:contents;}\r\n[data-tanuki-alias-host]:has(.tanuki-alias-text){display:flex;align-items:baseline;flex:0 1 auto;min-width:0;max-width:65%;}\r\n.tanuki-alias-text{display:block;min-width:0;max-width:100%;padding:0;border:0;background:transparent;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:inherit;font-size:17px;line-height:22px;font-weight:600;color:var(--dsw-alias-label-primary,#eee);text-align:left;cursor:pointer;}\r\n.tanuki-alias-editor{position:relative;display:block;width:var(--tanuki-control-width,36px);height:max(28px,calc(var(--tanuki-control-height,22px) + 6px));flex:none;}\r\n.tanuki-alias-edit{display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:0 2px;box-sizing:border-box;background:transparent;border:1px solid var(--dsw-alias-border-l2,#ffffff20);border-radius:var(--tanuki-control-radius,99px);font:inherit;font-size:10px;line-height:18px;color:var(--dsw-alias-label-secondary,#aaa);cursor:pointer;transition:background .15s ease,color .15s ease;}\r\n.tanuki-alias-edit:hover:not(:disabled){background:var(--dsw-alias-bg-layer-3,#353535);color:var(--dsw-alias-label-primary,#fff);}\r\n.tanuki-alias-edit:disabled{opacity:.45;cursor:wait;}\r\n.tanuki-alias-edit:focus-visible,.tanuki-alias-text:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px;}\r\n.tanuki-alias-input{position:absolute;right:0;bottom:0;z-index:2;display:block;width:min(220px,55vw);height:100%;box-sizing:border-box;border:1px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));border-radius:6px;padding:0 8px;background:var(--dsw-alias-bg-base,#151515);color:var(--dsw-alias-label-primary,#eee);font:inherit;font-size:14px;line-height:20px;outline:none;box-shadow:0 2px 8px #0003;}\r\n.tanuki-alias-input::placeholder{color:var(--dsw-alias-label-secondary,#999);font-size:12px;}\r\n.tanuki-alias-input:focus-visible{box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)) 35%,transparent);}\r\n@media(prefers-reduced-motion:reduce){.tanuki-alias-edit{transition:none;}}\r\n\r\n/* Use the panel's available width, not the window: an open right pane also changes columns. */\r\n@container tanuki-center (min-width:760px){[data-tanuki-center=manage] [data-plugin-group]>ul{grid-template-columns:repeat(2,minmax(0,1fr));}}\r\n@container tanuki-center (min-width:1160px){[data-tanuki-center=manage] [data-plugin-group]>ul{grid-template-columns:repeat(3,minmax(0,1fr));}}\r\n\n/* The native add control is an inverse primary button. Use a themed surface\n   only inside our managed list; preserve its native split-menu actions. */\n[data-tanuki-center=manage]>header [role=group] button:is([class*=\"_addPrimary\"],[class*=\"_addMore\"]){background:var(--dsw-alias-bg-module-platform,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2);}\r\n[data-tanuki-center=manage]>header [role=group] button:is([class*=\"_addPrimary\"],[class*=\"_addMore\"]):hover:not(:disabled),[data-tanuki-center=manage]>header [role=group] button:is([class*=\"_addPrimary\"],[class*=\"_addMore\"])[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover-solid,var(--dsw-alias-bg-overlay));color:var(--dsw-alias-label-primary);}\r\n\n/* Search and official grouping preserve every native card and its handlers. */\n.tanuki-plugin-search{padding:8px 0 10px;}\n.tanuki-plugin-search input{display:block;box-sizing:border-box;width:100%;min-height:36px;padding:7px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;}\n.tanuki-plugin-search input::placeholder{color:var(--dsw-alias-label-secondary);}\n.tanuki-plugin-search input:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px;}\n.tanuki-update-checking{display:block;padding:4px 10px;font-size:12px;color:var(--dsw-alias-label-secondary);}\n[data-tanuki-center=manage] [data-tanuki-search-hidden]{display:none!important;}\n[data-tanuki-center=manage][data-tanuki-category=official] [data-tanuki-official-grid]{display:grid!important;grid-template-columns:minmax(0,1fr);align-items:stretch;align-content:start;gap:8px;}\n[data-tanuki-center=manage][data-tanuki-category=official] [data-tanuki-official-grid]>:is([data-plugin-group=basic],[data-plugin-group=official],[data-plugin-group=extensions],[data-plugin-group=more]),\n[data-tanuki-center=manage][data-tanuki-category=official] [data-tanuki-official-grid]>[data-plugin-group]>ul{display:contents!important;}\n[data-tanuki-center=manage] [data-tanuki-official-grid] :is([data-plugin-item],[data-plugin-package]){height:124px;order:0;}\n[data-tanuki-center=manage] [data-tanuki-official-grid] :is([data-plugin-item],[data-plugin-package])>div:first-child{height:100%;box-sizing:border-box;grid-template-rows:40px minmax(0,1fr);}\n[data-tanuki-center=manage] [data-tanuki-official-grid] [data-tanuki-experimental]{order:2;}\n[data-tanuki-official-grid]::before,[data-tanuki-official-grid]::after{grid-column:1 / -1;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;padding:6px 2px;}\n[data-tanuki-official-grid][data-tanuki-has-stable]::before{content:attr(data-tanuki-stable-label);order:-1;}\n[data-tanuki-official-grid][data-tanuki-has-experimental]::after{content:attr(data-tanuki-experimental-label);order:1;border-top:1px solid var(--dsw-alias-border-l2);margin-top:8px;padding-top:14px;}\n[data-tanuki-center=manage][data-tanuki-category=official] [data-tanuki-official-grid] [data-plugin-group=extensions]>div:first-child:has(button){grid-column:1 / -1;order:3;margin:0;padding-top:4px;}\n@container tanuki-center (min-width:760px){[data-tanuki-center=manage][data-tanuki-category=official] [data-tanuki-official-grid]{grid-template-columns:repeat(2,minmax(0,1fr));}}\n@container tanuki-center (min-width:1160px){[data-tanuki-center=manage][data-tanuki-category=official] [data-tanuki-official-grid]{grid-template-columns:repeat(3,minmax(0,1fr));}}\n";
    function apply(ctx,{lifecycle}) {
      const generation=Math.random().toString(36).slice(2),handoff=createViewHandoff({window,document,css});
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
      let alive=true, inflight=null, refreshAgain=false, updateAt=0, nativeRefreshPending=false, marketEpoch=0, summaryAbort=null;
      let updateFlight=null,updateAgain=false,repoFlight=null,repoAgain=false,repoAt=0,localRepoAt=0,catalog=null,marketInstalled=null,localRepositories={};
      let snapshot={ready:false,market:null,marketEnabled:false,bundles:[],rows:[],repositories:{},repositoryLoading:false,repositoryError:false,counts:null,summary:null,caps:null,checking:false,update:{busy:false,phase:'idle'},notice:null};
      const listeners=new Set(),announcedUpdates=new Set(),installedUpdates=new Map();
      function notifyAvailableUpdates(summary,counts){
        if(!alive)return;
        for(const name of counts?.names||[]){
          const row=summary.packages.find(item=>item.name===name),version=typeof row?.latestVersion==='string'?row.latestVersion:'';
          const key=JSON.stringify([name,version]);if(announcedUpdates.has(key))continue;
          announcedUpdates.add(key);while(announcedUpdates.size>1024)announcedUpdates.delete(announcedUpdates.values().next().value);
          window.dispatchEvent(new CustomEvent('tanuki:notify',{detail:{id:'plugin.available:'+key,kind:'plugin.available',category:'plugins',packageName:name,title:{zh:'插件有可用更新',en:'Plugin update available'},message:{zh:version?`${name} 可更新至 ${version}。`:`${name} 有可用更新。`,en:version?`${name} can be updated to ${version}.`:`An update is available for ${name}.`}}}));
        }
      }
      const store={getSnapshot:()=>snapshot,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
      const updateCandidates=s=>s.marketEnabled&&s.caps?.features?.update===true?(s.summary?.packages||[]).filter(row=>{
        const pkg=s.bundles.find(item=>item.name===row.name);
        return pkg?.installed&&!isOfficialBundle(pkg)&&pkg.removable!==false&&pkg.readOnlyReason===undefined;
      }):[];
      const publish=patch=>{
        if(!alive)return;
        const next={...snapshot,...patch};
        // A verified installed version supersedes a stale Market summary, even
        // while the running Host still reports its pre-restart bundle version.
        if(next.summary){
          const installed=new Map(next.bundles.filter(p=>p.installed).map(p=>[p.name,p.version]));
          for(const [name,version] of installedUpdates)if(!installed.has(name)||installed.get(name)===version)installedUpdates.delete(name);
          next.summary={...next.summary,packages:next.summary.packages.filter(row=>!row.latestVersion||(row.latestVersion!==installed.get(row.name)&&row.latestVersion!==installedUpdates.get(row.name)))};
          next.counts=next.summary.checked>0?enabledUpdateCounts(next.summary,next.bundles,next.rows):null;
        }
        snapshot=next;for(const fn of [...listeners])fn();publishBubbles();
      };
      function publishBubbles(){
        if(!alive)return;
        const items=new Map();
        for(const name of snapshot.counts?.names||[])items.set(name,{id:'package:'+name,target:'plugins',packageName:name,state:'action'});
        if(snapshot.lastError||snapshot.updateCheckError)items.set('@error',{id:'update-check-error',target:'plugins',state:'error'});
        const update=snapshot.update.busy?snapshot.update:snapshot.notice;
        if(update?.name){
          const state=update.phase==='running'?'running':update.phase==='unknown'?'action':update.phase==='failed'?'error':null;
          if(state)items.set(update.name,{id:'package:'+update.name,target:'plugins',packageName:update.name,state,operation:true});
        }
        const updates=updateCandidates(snapshot).map(row=>({id:'available:'+row.name,target:'plugin-updates',packageName:row.name,state:snapshot.update.busy&&snapshot.update.name===row.name?'running':snapshot.notice?.name===row.name&&snapshot.notice.phase==='failed'?'error':'action'}));
        window.dispatchEvent(new CustomEvent('tanuki:bubble-state',{detail:{source:'plugin-center',items:[...items.values(),...updates]}}));
      }
      window.addEventListener('tanuki:bubble-request',publishBubbles);
      function resetMarket(patch){marketEpoch++;updateAt=0;repoAt=0;marketInstalled=null;summaryAbort?.abort();publish({...patch,caps:null,counts:null,summary:null,checking:false,updateCheckError:false});}
      function useModel(){return React.useSyncExternalStore(store.subscribe,store.getSnapshot);}
      function useLocale(){React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());return t;}
      async function json(url,signal,options={}){
        if(!alive)throw new DOMException('Component stopped','AbortError');
        const target=new URL(/^https?:/i.test(url)?url:url.replace(/^\/+/,''),document.baseURI);
        if(target.origin!==location.origin)throw new Error('cross-origin endpoint');
        const response=await fetch(target.href,{credentials:'same-origin',cache:'no-store',signal,method:options.method||'GET',...(options.body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(options.body)}:{})});
        const body=await response.json();
        if(!response.ok)throw Object.assign(new Error('HTTP '+response.status),{status:response.status,code:body.failure?.code});
        return body;
      }
      const aborters=new Set();
      const aliases=createPluginAliases({React,useLocale,json});
      ctx.effect(()=>()=>aliases.dispose());
      async function readWithTimeout(url,ms){const abort=new AbortController();aborters.add(abort);const timer=setTimeout(()=>abort.abort(),ms);try{return await json(url,abort.signal);}finally{clearTimeout(timer);aborters.delete(abort);}}
      const publishRepositories=()=>publish({repositories:resolveRepositories(snapshot.bundles.map(p=>p.name),localRepositories,marketInstalled||{},catalog||[])});
      async function refreshRepositories(force=false){
        if(!alive)return;
        if(repoFlight){repoAgain=repoAgain||force;return repoFlight;}
        if(!force&&Date.now()-localRepoAt<300000)return;localRepoAt=Date.now();
        repoFlight=(async()=>{
          publish({repositoryLoading:true});
          let failed=false;
          try{const local=await readWithTimeout('/tanuki-toolbox/repositories',5000);if(!local||typeof local.repositories!=='object')throw new Error('invalid repositories');localRepositories=local;publishRepositories();}catch{failed=true;}
          if(alive&&snapshot.marketEnabled&&(force||Date.now()-repoAt>=300000)){
            const epoch=marketEpoch;repoAt=Date.now();
            // These read-only Market UI fields supplement links. They never
            // choose update targets or replace the public mutation protocol.
            const results=await Promise.allSettled([readWithTimeout('/dsh-market/installed',25000).then(value=>{
              if(!alive||epoch!==marketEpoch)return;
              if(!value?.installed||typeof value.installed!=='object')throw new Error('invalid inventory metadata');
              marketInstalled=value;publishRepositories();
            }),readWithTimeout('/dsh-market/registry',60000).then(value=>{
              if(!alive||epoch!==marketEpoch)return;
              if(!Array.isArray(value?.registry?.plugins))throw new Error('invalid catalog');
              catalog=value.registry.plugins;publishRepositories();
            })]);
            if(epoch===marketEpoch)failed=failed||results.some(r=>r.status==='rejected');
          }
          publish({repositoryLoading:false,repositoryError:failed});
        })().finally(()=>{repoFlight=null;if(repoAgain&&alive){repoAgain=false;void refreshRepositories(true);}});
        return repoFlight;
      }
      async function refreshUpdates(force=false){
        if(!alive||!snapshot.marketEnabled)return;
        if(updateFlight){updateAgain=updateAgain||force;return updateFlight;}
        if(!force&&Date.now()-updateAt<300000)return;
        window.dispatchEvent(new CustomEvent('tanuki:component-maintenance'));
        const epoch=marketEpoch,abort=new AbortController();summaryAbort=abort;aborters.add(abort);updateAt=Date.now();
        const timeout=setTimeout(()=>abort.abort(),90000);
        publish({checking:true,updateCheckError:false});
        updateFlight=(async()=>{
          try{
            const caps=await json('/dsh-market/api/v1/capabilities',abort.signal);
            if(!alive||epoch!==marketEpoch||!snapshot.marketEnabled)return;
            if(caps.schema!=='dsh-market/update-api/v1'||!caps.features?.updatesSummary||typeof caps.endpoints?.updatesSummary!=='string')throw new Error('unsupported');
            publish({caps});
            const endpoint=caps.endpoints.updatesSummary+(force?(caps.endpoints.updatesSummary.includes('?')?'&':'?')+'force=1':'');
            const summary=await json(endpoint,abort.signal);
            if(!alive||epoch!==marketEpoch||!snapshot.marketEnabled)return;
            if(summary.schema!=='dsh-market/update-api/v1'||!Array.isArray(summary.packages)||!Number.isFinite(summary.checked))throw new Error('invalid summary');
            const counts=summary.checked>0?enabledUpdateCounts(summary,snapshot.bundles,snapshot.rows):null;
            publish({summary,counts});notifyAvailableUpdates(snapshot.summary,snapshot.counts);
            if(updater.getState().phase==='idle')void updater.resume();
          }catch{if(alive&&epoch===marketEpoch)publish({counts:null,summary:null,updateCheckError:true});}
          finally{clearTimeout(timeout);aborters.delete(abort);if(summaryAbort===abort)summaryAbort=null;if(epoch===marketEpoch)publish({checking:false});}
        })().finally(()=>{updateFlight=null;if(updateAgain&&alive){updateAgain=false;void refreshUpdates(true);}});
        return updateFlight;
      }
      const updater=createMarketUpdater({
        request:async(url,options)=>{const abort=new AbortController();aborters.add(abort);const timer=setTimeout(()=>abort.abort(),25000);try{return await json(url,abort.signal,options);}finally{clearTimeout(timer);aborters.delete(abort);}},
        capabilities:()=>snapshot.caps,inventory:()=>snapshot.bundles,available:()=>snapshot.summary?.packages||[],
        storage:{getItem:key=>sessionStorage.getItem(key),setItem:(key,value)=>sessionStorage.setItem(key,value),removeItem:key=>sessionStorage.removeItem(key)},
        changed:update=>{
          if(!alive)return;
          if(update.phase==='succeeded'&&typeof update.installedVersion==='string')installedUpdates.set(update.name,update.installedVersion);
          publish({update,notice:['succeeded','failed','unknown'].includes(update.phase)?update:null});
        },
        completed:async()=>{nativeRefreshPending=true;if(inflight)await inflight;if(alive)await refresh(true);}
      });
      async function refresh(force=false){
        if(!alive)return;
        if(inflight){if(force)refreshAgain=true;return inflight;}
        inflight=(async()=>{
          try{
            const manager=ctx.remote.pluginManager;
            const [bundleResult,rowResult]=await Promise.all([manager.listBundles(),manager.listPlugins()]);
            if(!bundleResult.ok||!rowResult.ok)throw new Error('Plugin inventory unavailable');
            const bundles=bundleResult.value,rows=rowResult.value;
            if(!alive)return;
            const marketEnabled=bundles.some(b=>b.name==='dshmarket'&&b.installed&&b.enabled)&&rows.some(r=>r.moduleName==='dshmarket'&&r.enabled);
            if(marketEnabled!==snapshot.marketEnabled)resetMarket({marketEnabled});
            publish({ready:true,revision:(snapshot.revision||0)+1,bundles,rows,lastError:null,counts:snapshot.summary?.checked>0?enabledUpdateCounts(snapshot.summary,bundles,rows):null});
            void refreshRepositories(force);
            void refreshUpdates(force);
          }catch(error){console.warn('[Tanuki Toolbox] Inventory unavailable',error);publish({counts:null,checking:false,lastError:true});}
        })().finally(()=>{inflight=null;const again=refreshAgain;refreshAgain=false;if(again&&alive)schedule();});return inflight;
      }
      let refreshTimer;
      const schedule=()=>{clearTimeout(refreshTimer);if(alive)refreshTimer=setTimeout(()=>refresh(true),1000);};
      const offChange=ctx.get('remote').$on('plugin-manager/changed',schedule);
      const clearHandoff=()=>handoff.clear();window.addEventListener('tanuki:clear-handoff',clearHandoff);
      const locatePlugin=event=>{const value=event.detail||{},name=value.packageName,entryId=value.entryId,category=['official','installed'].includes(value.category)?value.category:undefined;if(!alive||(!value.list&&!name&&!entryId)||[name,entryId].some(id=>id!==undefined&&(typeof id!=='string'||id.length>250)))return;rememberView({tab:'manage',...(category?{category}:{} )});publish({notificationTarget:{name,entryId,category,token:Date.now()+Math.random()}});};
      window.addEventListener('tanuki:locate-plugin',locatePlugin);
      const offReset=ctx.on('connection/reset',schedule);
      const interval=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},300000);
      const focus=()=>{if(document.visibilityState==='visible')refresh();};
      document.addEventListener('visibilitychange',focus);window.addEventListener('focus',focus);
      // Watch the optional service in its own scope: losing it must not dispose the center.
      ctx.inject(['market'],marketCtx=>{
        const market=marketCtx.get('market');if(market?.version!==1||typeof market.render!=='function')return;
        resetMarket({market});schedule();
        marketCtx.effect(()=>()=>{if(snapshot.market===market){resetMarket({market:null});schedule();}});
      });
      refresh(true);
      ctx.effect(()=>()=>{alive=false;window.removeEventListener('tanuki:locate-plugin',locatePlugin);window.removeEventListener('tanuki:bubble-request',publishBubbles);window.dispatchEvent(new CustomEvent('tanuki:bubble-state',{detail:{source:'plugin-center',items:[]}}));marketEpoch++;updater.dispose({discardBatch:lifecycle.disabled});if(lifecycle.disabled)handoff.clear();window.removeEventListener('tanuki:clear-handoff',clearHandoff);clearTimeout(refreshTimer);clearInterval(interval);offChange();offReset();document.removeEventListener('visibilitychange',focus);window.removeEventListener('focus',focus);for(const a of aborters)a.abort();aborters.clear();listeners.clear();announcedUpdates.clear();installedUpdates.clear();catalog=null;marketInstalled=null;localRepositories={};snapshot={ready:false,bundles:[],rows:[],repositories:{},update:{busy:false}};});
      ctx.effect(()=>{const style=document.createElement('style');style.dataset.pluginCss='tanuki-toolbox';style.textContent=css;document.head.appendChild(style);return()=>style.remove();});
      function SidebarIcon({size=16}){return h('img',{className:'tanuki-sidebar-icon','data-tanuki-bubble-target':'plugins',src:CENTER_ICON,width:size,height:size,alt:''});}
      function GitButton({name}){
        const model=useModel(),tr=useLocale(),pkg=model.bundles.find(p=>p.name===name),url=model.repositories?.[name];
        if(!pkg?.installed||pkg.removable===false||isOfficialBundle(pkg))return null;
        const allowed=typeof url==='string'&&/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(url);
        return allowed?h('a',{className:'tanuki-git-button',href:url,target:'_blank',rel:'noopener noreferrer',title:tr('gitOpen'),onClick:e=>e.stopPropagation()},'Git'):h('button',{type:'button',className:'tanuki-git-button',disabled:true,title:tr(model.repositoryLoading?'gitLoading':model.repositoryError?'gitUnavailable':'gitMissing')},'Git');
      }
      function UpdateButton({name}){
        const s=useModel(),tr=useLocale(),pkg=s.bundles.find(p=>p.name===name),update=s.summary?.packages.find(p=>p.name===name);
        if(!pkg?.installed||pkg.removable===false||isOfficialBundle(pkg))return null;
        const busy=s.update.busy&&s.update.name===name,supported=updater.supported(s.caps),allowed=!!update&&supported&&pkg.readOnlyReason===undefined;
        const title=busy?tr('updating'):s.checking?tr('checking'):!s.marketEnabled?tr('updateUnavailable'):!supported||!s.summary?tr('updateCheckUnavailable'):update?tr('updateVersion',{version:update.latestVersion||''}):tr('noUpdate');
        return h('button',{type:'button',className:'tanuki-update-button','data-available':allowed||undefined,disabled:!allowed||s.update.busy||s.update.batchBusy,title,'aria-label':title,onClick:event=>{event.stopPropagation();void updater.start(name);}},busy?tr('updating')+(s.update.percent==null?'…':' '+s.update.percent+'%'):allowed?tr('update'):tr('updateLatest'));
      }
      function UpdateAllButton(){
        const s=useModel(),tr=useLocale(),names=[...new Set(updateCandidates(s).map(p=>p.name))];
        const busy=s.update.busy||s.update.batchBusy,allowed=names.length>0&&updater.supported(s.caps)&&!s.updateCheckError;
        const title=busy?tr('updateAllProgress',{current:s.update.batchIndex||1,total:s.update.batchTotal||1}):!s.marketEnabled?tr('updateUnavailable'):allowed?tr('updateAllCount',{n:names.length}):tr('noUpdate');
        return h('button',{type:'button',className:'tanuki-update-button tanuki-update-all','data-tanuki-bubble-target':'plugin-updates','data-available':allowed||undefined,disabled:!allowed||busy,title,onClick:()=>void updater.startAll(names)},tr(busy?'updating':'updateAll'));
      }
      function UpdateNotice(){
        const s=useModel(),tr=useLocale(),n=s.notice;if(!n)return null;
        const pkg=s.bundles.find(p=>p.name===n.name),name=n.name===SELF?tr('toolbox'):toolboxLocale.text(pkg?.meta?.title)||n.name;
        const key=n.phase==='succeeded'?(n.restartRequired?'updateRestart':n.refreshRequired?'updateReload':'updateDone'):n.phase==='unknown'?'updateUnknown':['RELEASE_TOO_FRESH','VERSION_UNCHANGED'].includes(n.code)?'updateFresh':n.code==='OPERATION_BUSY'?'updateBusy':'updateFailed';
        return h('div',{className:'tanuki-update-notice',role:n.phase==='succeeded'?'status':'alert'},h('span',null,tr(key,{name})),n.phase==='unknown'&&n.operationId?h('button',{type:'button',className:'tanuki-link',onClick:()=>void updater.resume()},tr('checkProgress')):null,h('button',{type:'button',className:'tanuki-quiet','aria-label':tr('dismiss'),onClick:()=>publish({notice:null})},'×'));
      }
      // Add only our portal hosts. Native uninstall/switch nodes keep their React ownership.
      function NativePluginEnhancements({page,category,query}){
        const [hosts,setHosts]=React.useState([]),[aliasHosts,setAliasHosts]=React.useState([]),[batchHost,setBatchHost]=React.useState(null);
        const model=useModel(),[icons,setIcons]=React.useState({}),artworkRef=React.useRef(null),artworkData=React.useRef(null);
        artworkData.current={bundles:model.bundles,icons};
        React.useEffect(()=>{
          const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),10000);
          json('/tanuki-toolbox/plugin-artwork',abort.signal).then(result=>{if(!abort.signal.aborted&&alive&&result?.icons&&typeof result.icons==='object')setIcons(result.icons);}).catch(()=>{}).finally(()=>clearTimeout(timer));
          return()=>{clearTimeout(timer);abort.abort();};
        },[model.revision]);
        React.useLayoutEffect(()=>{artworkRef.current?.sync(page,model.bundles,icons);},[page,model.bundles,icons]);
        React.useEffect(()=>{if(category==='installed')void aliases.load();},[category]);
        const aliasState=React.useSyncExternalStore(aliases.subscribe,aliases.getSnapshot),tr=useLocale();
        React.useLayoutEffect(()=>{
          let frame,grid=null;const marked=new Set();
          const normalize=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().trim();
          const needle=normalize(query);
          const clearGrid=()=>{if(grid){for(const key of ['data-tanuki-official-grid','data-tanuki-stable-label','data-tanuki-experimental-label','data-tanuki-has-stable','data-tanuki-has-experimental'])grid.removeAttribute(key);grid=null;}};
          const scan=()=>{
            if(!alive)return;
            const groups=[...page.querySelectorAll(OFFICIAL_GROUP_SELECTOR)],parent=groups[0]?.parentElement;
            const next=category==='official'&&!page.querySelector(DETAIL_SELECTOR)&&parent&&groups.every(group=>group.parentElement===parent)?parent:null;
            if(grid!==next){clearGrid();grid=next;}
            let stable=false,experimental=false;
            const current=new Set();
            for(const card of page.querySelectorAll('[data-plugin-group] [data-plugin-package],[data-plugin-group] [data-plugin-item]')){
              current.add(card);marked.add(card);
              const name=card.getAttribute('data-plugin-package')||card.getAttribute('data-plugin-item'),pkg=model.bundles.find(item=>item.name===name);
              const heading=card.querySelector(':scope > div:first-child > div:nth-child(2) > div:first-child');
              const label=toolboxLocale.text(pkg?.meta?.title);
              const matches=!needle||[name,label,aliasState.values[name],heading?.textContent].some(value=>normalize(value).includes(needle));
              card.toggleAttribute('data-tanuki-search-hidden',!matches);
              const beta=!!card.closest(OFFICIAL_GROUP_SELECTOR)&&String(name).startsWith('@deepseek-ai/dsh-experimental-');
              card.toggleAttribute('data-tanuki-experimental',beta);
              if(grid&&card.closest(OFFICIAL_GROUP_SELECTOR)&&matches){if(beta)experimental=true;else stable=true;}
            }
            for(const card of marked)if(!current.has(card)){card.removeAttribute('data-tanuki-search-hidden');card.removeAttribute('data-tanuki-experimental');marked.delete(card);}
            if(grid){grid.setAttribute('data-tanuki-official-grid','');grid.setAttribute('data-tanuki-stable-label',tr('stable'));grid.setAttribute('data-tanuki-experimental-label',tr('experimental'));grid.toggleAttribute('data-tanuki-has-stable',stable);grid.toggleAttribute('data-tanuki-has-experimental',experimental);}
          };
          const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(scan);};
          scan();const observer=new MutationObserver(schedule);observer.observe(page,{childList:true,subtree:true,characterData:true});
          return()=>{observer.disconnect();cancelAnimationFrame(frame);clearGrid();for(const card of marked){card.removeAttribute('data-tanuki-search-hidden');card.removeAttribute('data-tanuki-experimental');}marked.clear();};
        },[page,category,query,model.bundles,aliasState,tr('stable'),tr('experimental')]);

        React.useLayoutEffect(()=>{
          setHosts([]);setAliasHosts([]);
          const entries=new Map(),names=new Map();let frame,pinned=null,observedBar=null,updateAllHost=null;
          const artwork=createPluginArtwork({document});artworkRef.current=artwork;
          const removeName=entry=>{entry.host.remove();entry.heading.removeAttribute('data-tanuki-alias-heading');};
          const unpin=()=>{if(pinned){pinned.removeAttribute('data-tanuki-pinned-actions');pinned.style.removeProperty('--tanuki-actions-top');pinned.style.removeProperty('--tanuki-actions-right');pinned=null;}};
          const measure=()=>{
            const listHead=page.querySelector(':scope > header'),listAnchor=page.querySelector('.tanuki-list-action-anchor');
            if(listHead&&listAnchor){const rect=listAnchor.getBoundingClientRect();listHead.style.setProperty('--tanuki-list-top',(rect.top+rect.height/2)+'px');listHead.style.setProperty('--tanuki-list-right',Math.max(0,window.innerWidth-rect.right)+'px');const width=Math.ceil(listHead.getBoundingClientRect().width)+'px';if(listAnchor.style.width!==width)listAnchor.style.width=width;}
            for(const entry of entries.values()){
              if(!entry.card)continue;
              const control=entry.owner.querySelector('[role="switch"]'),rect=control?.getBoundingClientRect();
              if(rect?.width>0&&rect.height>0){entry.owner.style.setProperty('--tanuki-control-width',Math.ceil(rect.width)+'px');entry.owner.style.setProperty('--tanuki-control-height',Math.ceil(rect.height)+'px');entry.owner.style.setProperty('--tanuki-control-radius',getComputedStyle(control).borderRadius);}
            }
            const bar=page.querySelector('.tanuki-backbar'),anchor=bar?.querySelector('.tanuki-action-anchor');
            if(!pinned||!bar||!anchor)return;
            const rect=anchor.getBoundingClientRect();
            pinned.style.setProperty('--tanuki-actions-top',(rect.top+rect.height/2)+'px');
            pinned.style.setProperty('--tanuki-actions-right',Math.max(0,window.innerWidth-rect.right)+'px');
            const width=Math.ceil(pinned.getBoundingClientRect().width)+'px';if(anchor.style.width!==width)anchor.style.width=width;
          };
          const resize=new ResizeObserver(measure);
          const scan=()=>{
            artwork.sync(page,artworkData.current.bundles,artworkData.current.icons);
            const refreshButton=page.querySelector(':scope > header > div:last-child button[aria-busy]');
            const controls=refreshButton?.closest('header')?.lastElementChild;
            if(updateAllHost&&(!controls||updateAllHost.parentElement!==controls)){updateAllHost.remove();updateAllHost=null;setBatchHost(null);}
            if(controls&&!updateAllHost){
              let refreshContainer=refreshButton;while(refreshContainer.parentElement!==controls)refreshContainer=refreshContainer.parentElement;
              updateAllHost=document.createElement('span');updateAllHost.setAttribute('data-tanuki-update-all-host','');controls.insertBefore(updateAllHost,refreshContainer.nextSibling);setBatchHost(updateAllHost);
            }
            if(nativeRefreshPending&&refreshButton&&!refreshButton.disabled){nativeRefreshPending=false;refreshButton.click();}
            const candidates=[],nameCandidates=[];
            for(const card of page.querySelectorAll('[data-plugin-package]')){
              if(card.closest(OFFICIAL_GROUP_SELECTOR))continue;
              const heading=card.querySelector(':scope > div:first-child > div:nth-child(2) > div:first-child');
              if(category==='installed'&&card.closest('[data-plugin-group="bundles"]')&&heading?.querySelector(':scope > button'))nameCandidates.push({owner:card,name:card.getAttribute('data-plugin-package'),heading});
              const end=card.firstElementChild?.lastElementChild;
              if(end?.querySelector('[role="switch"]'))candidates.push({owner:card,name:card.getAttribute('data-plugin-package'),end,card:true});
            }
            const detail=page.querySelector(DETAIL_SELECTOR),actions=detail?.querySelector(':scope > [data-window-drag] > div:last-child > div:last-child');
            if(actions?.querySelector('[role="switch"]')&&detail.getAttribute('data-plugin-detail'))candidates.push({owner:detail,name:detail.getAttribute('data-plugin-detail'),end:actions});
            const keep=new Set(candidates.map(x=>x.owner));let dirty=false;
            for(const [owner,entry] of entries){if(!keep.has(owner)||!entry.host.isConnected){entry.host.remove();entries.delete(owner);dirty=true;}}
            for(const candidate of candidates){
              if(entries.has(candidate.owner))continue;
              const host=document.createElement('span');host.setAttribute('data-tanuki-update-host','');
              if(candidate.card){host.setAttribute('data-tanuki-card-extras','');candidate.end.appendChild(host);}
              else{let toggle=candidate.end.querySelector('[role="switch"]');while(toggle.parentElement!==candidate.end)toggle=toggle.parentElement;candidate.end.insertBefore(host,toggle);}
              entries.set(candidate.owner,{...candidate,host});dirty=true;
            }
            let namesDirty=false;const desiredNames=new Map(nameCandidates.map(candidate=>[candidate.owner,candidate]));
            for(const [owner,entry] of names){
              const desired=desiredNames.get(owner);
              if(!desired||desired.name!==entry.name||desired.heading!==entry.heading||entry.host.parentElement!==entry.heading){removeName(entry);names.delete(owner);namesDirty=true;}
            }
            for(const candidate of nameCandidates){
              if(names.has(candidate.owner))continue;
              const host=document.createElement('span');host.setAttribute('data-tanuki-alias-host','');
              candidate.heading.setAttribute('data-tanuki-alias-heading','');candidate.heading.prepend(host);
              names.set(candidate.owner,{...candidate,host});namesDirty=true;
            }
            if(dirty)setHosts([...entries.values()]);
            if(namesDirty)setAliasHosts([...names.values()]);
            const bar=page.querySelector('.tanuki-backbar');
            if(actions!==pinned||bar!==observedBar){resize.disconnect();unpin();observedBar=bar;if(actions&&bar){pinned=actions;pinned.setAttribute('data-tanuki-pinned-actions','');resize.observe(pinned);resize.observe(bar);}resize.observe(page);}
            measure();
          };
          const queue=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(scan);};
          scan();const observer=new MutationObserver(queue);observer.observe(page,{childList:true,subtree:true,attributes:true,attributeFilter:['data-tanuki-category']});
          // Save before native handlers can trigger HMR, disposal or a reload.
          const preserveToggle=event=>{
            const control=event.target instanceof Element&&event.target.closest('[role="switch"]');if(!control)return;
            rememberView({tab:'manage',category:page.getAttribute('data-tanuki-category')==='official'?'official':'installed'});
            const row=control.closest('[data-plugin-row]')?.getAttribute('data-plugin-row');
            const pkg=control.closest('[data-plugin-package],[data-plugin-detail]');
            const isWholeToolbox=!row&&(pkg?.getAttribute('data-plugin-package')===SELF||pkg?.getAttribute('data-plugin-detail')===SELF);
            const leaving=control.getAttribute('aria-checked')==='true'&&(isWholeToolbox||row==='tanuki-plugin-center');
            handoff.capture(page,generation,snapshot.revision||0,leaving);
          };
          page.addEventListener('click',preserveToggle,true);page.addEventListener('scroll',measure,{passive:true});page.addEventListener('load',queue,true);page.addEventListener('error',queue,true);window.addEventListener('resize',measure);
          return()=>{observer.disconnect();resize.disconnect();cancelAnimationFrame(frame);page.removeEventListener('click',preserveToggle,true);page.removeEventListener('scroll',measure);page.removeEventListener('load',queue,true);page.removeEventListener('error',queue,true);window.removeEventListener('resize',measure);artwork.dispose();if(artworkRef.current===artwork)artworkRef.current=null;unpin();updateAllHost?.remove();for(const entry of names.values())removeName(entry);names.clear();for(const entry of entries.values()){entry.host.remove();entry.owner.style.removeProperty('--tanuki-control-width');entry.owner.style.removeProperty('--tanuki-control-height');entry.owner.style.removeProperty('--tanuki-control-radius');}};
        },[page,category]);
        return h(React.Fragment,null,batchHost?createPortal(h(UpdateAllButton),batchHost):null,...hosts.map(({name,host,card})=>createPortal(h(React.Fragment,null,h(UpdateButton,{name}),card?h(GitButton,{name}):null,card&&category==='installed'?h(aliases.Alias,{name}):null),host)),...aliasHosts.map(({name,host,heading})=>{
          const version=installedUpdates.get(name)||model.bundles.find(pkg=>pkg.name===name)?.version;
          const label=typeof version==='string'&&version.trim()?'v'+version.trim().replace(/^v/i,''):'';
          return createPortal(h(React.Fragment,null,h(aliases.Title,{name,heading}),label?h('small',{className:'tanuki-installed-version',title:label},label):null),host,name);
        }));
      }
      class Boundary extends React.Component {
        constructor(p){super(p);this.state={failed:false,generation:0};}
        static getDerivedStateFromError(){return{failed:true};}
        componentDidCatch(error){console.error('[Tanuki Toolbox]',error);}
        render(){return this.state.failed?h('div',{className:'tanuki-error'},h('p',null,this.props.t('error')),h('button',{className:'tanuki-button',onClick:()=>this.setState(s=>({failed:false,generation:s.generation+1}))},this.props.t('retry'))):h(React.Fragment,{key:this.state.generation},this.props.children);}
      }
      const CenterPlugin={name:'tanuki-center-surface',apply(scoped){
        function CenterBridge(props){
          const active=props.useCenterPanel(s=>s.activePanelId)==='plugins';
          const s=useModel(),tr=useLocale(),[query,setQuery]=React.useState('');
          const market=s.marketEnabled?s.market:null;
          const [selectedTab,setSelectedTab]=React.useState(()=>savedView.tab||(market?'market':'manage')),[category,setSelectedCategory]=React.useState(()=>savedView.category);
          const setTab=value=>{rememberView({tab:value});setSelectedTab(value);};
          const setCategory=value=>{rememberView({category:value});setSelectedCategory(value);};
          const tab=market?selectedTab:'manage';
          const [targets,setTargets]=React.useState(null),[detail,setDetail]=React.useState(false),[marketMode,setSelectedMarketMode]=React.useState(()=>savedView.marketMode);
          const setMarketMode=value=>{rememberView({marketMode:value});setSelectedMarketMode(value);};
          const listNavigation=React.useRef({frame:null,generation:0});
          React.useEffect(()=>()=>{listNavigation.current.generation++;cancelAnimationFrame(listNavigation.current.frame);},[active,targets]);
          const returnToList=()=>{
            const navigation=listNavigation.current,generation=++navigation.generation;
            cancelAnimationFrame(navigation.frame);let lastButton=null,attempts=0;
            const step=()=>{
              if(generation!==navigation.generation||!targets?.page.isConnected)return;
              const current=targets.page.querySelector(DETAIL_SELECTOR),more=targets.page.querySelector(MORE_SELECTOR);
              if(!current&&!more){targets.page.scrollTop=0;setDetail(false);return;}
              const back=current?current.querySelector(':scope > [data-window-drag] > button:first-child'):targets.page.querySelector(':scope > header[data-window-drag] > button:first-child');
              if(!back||++attempts>60)return;
              // Follow native crumbs through row, package and the official More page.
              if(back!==lastButton){lastButton=back;back.click();}
              navigation.frame=requestAnimationFrame(step);
            };
            step();
          };
          const selectCategory=next=>{setCategory(next);returnToList();};
          const goListRef=React.useRef(returnToList);goListRef.current=returnToList;
          React.useEffect(()=>{
            if(!active||!s.notificationTarget)return;
            setTab('manage');const bundle=s.bundles.find(p=>p.name===s.notificationTarget.name);
            setCategory(s.notificationTarget.category||(isOfficialBundle(bundle)?'official':'installed'));
            if(targets)goListRef.current();
          },[active,targets,s.notificationTarget?.token]);
          React.useEffect(()=>{
            const target=s.notificationTarget;
            if(!active||!targets||!target||tab!=='manage')return;
            if(!target.name&&!target.entryId){publish({notificationTarget:null});return;}
            let disposed=false,frame=null;
            const find=()=>{if(disposed||targets.page.querySelector(DETAIL_SELECTOR))return;
              const card=[...targets.page.querySelectorAll('[data-plugin-package],[data-plugin-item]')].find(node=>(node.getAttribute('data-plugin-package')===target.name||!!target.entryId&&node.getAttribute('data-plugin-item')===target.entryId)&&node.getClientRects().length);
              if(!card)return;
              card.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
              card.animate?.([{outline:'2px solid #e6e63c',outlineOffset:'2px'},{outline:'2px solid transparent',outlineOffset:'2px'}],{duration:2200});
              publish({notificationTarget:null});
            };
            const observer=new MutationObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(find);});observer.observe(targets.page,{childList:true,subtree:true,attributes:true});
            frame=requestAnimationFrame(find);const timeout=setTimeout(()=>{if(alive&&snapshot.notificationTarget?.token===target.token)publish({notificationTarget:null});},8000);
            return()=>{disposed=true;observer.disconnect();cancelAnimationFrame(frame);clearTimeout(timeout);};
          },[active,targets,tab,category,s.notificationTarget?.token]);
          React.useEffect(()=>{
            if(!active||!targets)return;
            const navigation=createDetailNavigation({window,hasDetail:()=>hasNestedView(targets.page),goList:()=>goListRef.current()});
            const observer=new MutationObserver(navigation.sync);observer.observe(targets.page,{childList:true,subtree:true});
            return()=>{observer.disconnect();navigation.dispose();};
          },[active,targets]);
          const marketElement=React.useMemo(()=>market?market.render(marketMode?{preferredSubsectionId:marketMode}:{}):null,[market,marketMode]);
          React.useLayoutEffect(()=>{
            if(!active){setTargets(null);return;}
            let current=null,frame;
            const detach=()=>{if(!current)return;current.page.removeAttribute('data-tanuki-center');current.page.removeAttribute('data-tanuki-category');current.toolbar.remove();current.content.remove();current=null;};
            const attach=()=>{
              const page=document.querySelector('[data-slot="main"] [data-plugin-panel]');
              if(page===current?.page&&current.toolbar.isConnected&&current.content.isConnected){setDetail(hasNestedView(page));return;}
              detach();if(!page){setTargets(null);return;}
              const toolbar=document.createElement('div'),content=document.createElement('div');
              toolbar.setAttribute('data-tanuki-toolbar','');content.setAttribute('data-tanuki-market','');content.setAttribute('role','region');
              page.prepend(toolbar);page.appendChild(content);current={page,toolbar,content};setTargets(current);setDetail(hasNestedView(page));
            };
            attach();const observer=new MutationObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(attach);});observer.observe(document.body,{childList:true,subtree:true});
            return()=>{observer.disconnect();cancelAnimationFrame(frame);detach();};
          },[active]);
          React.useLayoutEffect(()=>{if(!targets)return;targets.page.setAttribute('data-tanuki-center',tab);targets.page.setAttribute('data-tanuki-category',category);targets.content.hidden=tab!=='market';targets.content.setAttribute('aria-label',tr('market'));targets.page.scrollTop=0;},[targets,tab,category,tr('market')]);
          React.useLayoutEffect(()=>{if(targets&&s.ready)handoff.ready(targets.page,generation,s.revision||0);},[targets,tab,category,s.revision]);
          React.useEffect(()=>{if(active)refresh();},[active]);
          if(!active||!targets)return null;
          const button=(key,selected,action)=>h('button',{type:'button',className:'tanuki-button','aria-pressed':selected,'data-tanuki-bubble-target':key==='manage'?'plugins':undefined,onClick:action},tr(key));
          const toolbar=h(React.Fragment,null,
            h('div',{className:'tanuki-heading'},h('h1',null,tr('title')),h('div',{className:'tanuki-actions'},market&&s.counts?.total>0?h('button',{type:'button',className:'tanuki-link',onClick:()=>{setMarketMode('installed');setTab('market');}},tr('viewUpdates')):null)),
            h('nav',{className:'tanuki-tabs','aria-label':tr('pages')},market?button('market',tab==='market',()=>setTab('market')):null,button('manage',tab==='manage',()=>setTab('manage'),s.counts?.total)),
            h(UpdateNotice),
            s.checking?h('span',{className:'tanuki-update-checking',role:'status'},tr('checking')):null,
            tab==='manage'?h('nav',{className:'tanuki-subtabs','aria-label':tr('groups')},button('official',category==='official',()=>selectCategory('official'),s.counts?.official),button('installed',category==='installed',()=>selectCategory('installed'),s.counts?.installed),!detail?h('span',{className:'tanuki-list-action-anchor','aria-hidden':true}):null):null,
            tab==='manage'&&!detail?h('div',{className:'tanuki-plugin-search'},h('input',{type:'search',value:query,'aria-label':tr('search'),placeholder:tr('search'),onChange:event=>setQuery(event.target.value)})):null,
            tab==='manage'&&detail?h('div',{className:'tanuki-backbar'},h('button',{type:'button',className:'tanuki-back',onClick:returnToList},h('svg',{width:16,height:16,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,'aria-hidden':true},h('path',{d:'M14 6l-6 6 6 6'})),tr('pluginList')),h('span',{className:'tanuki-action-anchor','aria-hidden':true})):null);
          return h(React.Fragment,null,createPortal(toolbar,targets.toolbar),market?createPortal(h(Boundary,{t:tr},marketElement),targets.content):null,tab==='manage'?h(NativePluginEnhancements,{page:targets.page,category,query}):null);
        }
        scoped.slots.inject('sidebar.panellist',()=>scoped.slots.register({name:'sidebar.panellist',id:'plugins',priority:-20,order:0,label:()=>t('title'),locale:NS},SidebarIcon));
        scoped.slots.inject('shell.overlay',()=>scoped.slots.register({name:'shell.overlay',id:'tanuki-plugin-center',locale:NS,inject:()=>({hooks:{centerPanel:scoped.layout.panelInfo}})},CenterBridge));
      }};
      const surface=ctx.plugin(CenterPlugin);
      ctx.effect(()=>()=>{surface.dispose();});
    }
    return {name:'tanuki-center-runtime',inject:['slots','locale','layout','remote','remote.pluginManager'],apply};
});
