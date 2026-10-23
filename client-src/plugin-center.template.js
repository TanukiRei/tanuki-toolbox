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
    const CENTER_ICON=__CENTER_ICON__;
    const enabledUpdateCounts=__COUNT_FUNCTION__;
    const createMarketUpdater=__UPDATE_FUNCTION__;
    const {resolveRepositories}=(__REPOSITORIES_FUNCTION__)();
    const createDetailNavigation=__DETAIL_NAVIGATION_FUNCTION__;
    const createViewHandoff=__VIEW_HANDOFF_FUNCTION__;
    const createPluginAliases=__ALIASES_FUNCTION__;
    const createPluginArtwork=__ARTWORK_FUNCTION__;
    const VIEW_KEY='tanuki-toolbox:center-view-v1';
    let savedView={tab:null,category:'installed',marketMode:null};
    try{const saved=JSON.parse(sessionStorage.getItem(VIEW_KEY)||'null');if(saved)savedView={tab:['market','manage'].includes(saved.tab)?saved.tab:null,category:saved.category==='official'?'official':'installed',marketMode:saved.marketMode==='installed'?'installed':null};}catch{}
    function rememberView(patch){savedView={...savedView,...patch};try{sessionStorage.setItem(VIEW_KEY,JSON.stringify(savedView));}catch{}}
    const dictionaries=__LOCALES__;
    const css=__CSS__;
    function apply(ctx,{lifecycle}) {
      const generation=Math.random().toString(36).slice(2),handoff=createViewHandoff({window,document,css});
      const toolboxLocale=(__LOCALE_FACTORY__)(ctx,NS,dictionaries),t=toolboxLocale.t;
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
        return h('button',{type:'button',className:'tanuki-update-button tanuki-update-all','data-available':allowed||undefined,disabled:!allowed||busy,title,onClick:()=>void updater.startAll(names)},tr(busy?'updating':'updateAll'));
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
