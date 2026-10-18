document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,NS='tanukiDetails';
  const createRecommendationComponents=function createRecommendationComponents({React,ctx,useLocale,useModel,json,refresh,notifyInstalled}){
  const h=React.createElement;
  let state={busy:false,name:null,phase:'idle'},alive=true;
  const listeners=new Set();
  const publish=patch=>{if(!alive)return;state={...state,...patch};for(const fn of listeners)fn();};
  const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
  function localized(value,locale){if(typeof value==='string')return value;return value?.[locale]||value?.[String(locale).split('-')[0]]||value?.en||value?.zh||'';}
  function GitButton({name}){
    const model=useModel(),tr=useLocale(),pkg=model.bundles.find(p=>p.name===name),url=model.repositories?.[name];
    if(!pkg?.installed||pkg.removable===false)return null;
    const allowed=typeof url==='string'&&/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(url);
    return allowed?h('a',{className:'tanuki-git-button',href:url,target:'_blank',rel:'noopener noreferrer',title:tr('gitOpen'),onClick:e=>e.stopPropagation()},'Git'):h('button',{type:'button',className:'tanuki-git-button',disabled:true,title:tr(model.repositoryLoading?'gitLoading':model.repositoryError?'gitUnavailable':'gitMissing')},'Git');
  }
  function Icon({src,title}){
    const [failed,setFailed]=React.useState(false);
    React.useEffect(()=>setFailed(false),[src]);
    return src&&!failed?h('img',{className:'tanuki-recommend-icon',src,alt:'',loading:'lazy',referrerPolicy:'no-referrer',onError:()=>setFailed(true)}):h('span',{className:'tanuki-recommend-icon tanuki-recommend-fallback','aria-hidden':true},Array.from(title||'?')[0]);
  }
  async function settle(answer){
    if(!alive)return;
    const result=answer?.ok?answer.value:null;
    if(!result){publish({busy:false,phase:'unknown'});return;}
    const failed=result.application==='failed'||result.application==='cancelled'||result.application==='overridden';
    publish({busy:false,phase:failed?'failed':'done',key:failed?(result.pendingBuilds?.length?'recommendBuild':result.error?.code==='incompatible-version'?'recommendIncompatible':'recommendInstallFailed'):result.application==='restart-required'?'recommendRestart':'recommendInstalled',requestId:null});
    notifyInstalled();await refresh(true);
  }
  async function resume(){
    if(!alive||!state.requestId||state.busy)return;
    publish({busy:true});
    try{
      const answer=await ctx.remote.pluginManager.waitForInstall(state.requestId);
      if(answer.ok&&answer.value)await settle(answer);else publish({busy:false,phase:'unknown'});
    }catch{publish({busy:false,phase:'unknown'});}
  }
  async function install(entry){
    if(!alive||state.busy||state.phase==='unknown'||!entry.installSpec||entry.error)return;
    publish({busy:true,name:entry.name,phase:'inspecting',key:null,requestId:null});
    try{
      const checked=await ctx.remote.pluginManager.inspect(entry.installSpec);
      if(!alive)return;
      if(!checked.ok||checked.value.status!=='accepted'){
        publish({busy:false,phase:'failed',key:checked.ok&&checked.value.problem==='already-installed'?'recommendAlreadyInstalled':'recommendInstallFailed'});
        await refresh(true);return;
      }
      const requestId=crypto.randomUUID();
      publish({phase:'installing',requestId});
      const answer=await ctx.remote.pluginManager.installBundle(entry.installSpec,{enabled:true,requestId,registry:checked.value.registry});
      await settle(answer);
    }catch{publish({busy:false,phase:state.requestId?'unknown':'failed',key:'recommendInstallFailed'});}
  }
  function Recommendations(){
    const tr=useLocale(),model=useModel(),operation=React.useSyncExternalStore(subscribe,()=>state);
    const [open,setOpen]=React.useState(false),[revision,setRevision]=React.useState(0),[feed,setFeed]=React.useState({phase:'idle',plugins:[]}),[aliases,setAliases]=React.useState({});
    const locale=ctx.locale.getSnapshot()?.active||'en';
    React.useEffect(()=>{
      if(!open){setFeed({phase:'idle',plugins:[]});setAliases({});return;}
      const controller=new AbortController();let mounted=true;
      const timeout=setTimeout(()=>controller.abort(),75000);
      setFeed(previous=>({...previous,phase:'loading'}));
      // Reuse the profile-local alias service, but only while recommendations are open.
      // Alias failure must not block GitHub metadata or invent translated names.
      const aliasController=new AbortController(),aliasTimeout=setTimeout(()=>aliasController.abort(),7000);
      json('/tanuki-toolbox/plugin-aliases',aliasController.signal).then(value=>{
        if(!alive||!mounted)return;
        if(value?.schema!==1||!value.aliases||typeof value.aliases!=='object'||Array.isArray(value.aliases))return;
        setAliases(Object.fromEntries(Object.entries(value.aliases).filter(([name,alias])=>typeof alias==='string'&&alias.trim()).map(([name,alias])=>[name,alias.trim()])));
      }).catch(()=>{}).finally(()=>clearTimeout(aliasTimeout));
      json('/tanuki-toolbox/recommendations',controller.signal).then(value=>{
        if(!Array.isArray(value.plugins))throw new Error('Invalid recommendations');
        if(alive&&mounted)setFeed({phase:value.plugins.some(p=>p.error)?'error':'ready',plugins:value.plugins});
      }).catch(()=>{if(alive&&mounted)setFeed(previous=>({...previous,phase:'error'}));}).finally(()=>clearTimeout(timeout));
      return()=>{mounted=false;clearTimeout(timeout);clearTimeout(aliasTimeout);controller.abort();aliasController.abort();};
    },[open,revision]);
    return h('section',{className:'tanuki-recommendations'},
      h('div',{className:'tanuki-recommend-header'},
        h('button',{type:'button',className:'tanuki-recommend-toggle','aria-expanded':open,onClick:()=>setOpen(value=>!value)},h('span',null,tr('recommendations')),h('span',{'aria-hidden':true},open?'⌃':'⌄')),
        open?h('button',{type:'button',className:'tanuki-recommend-refresh',disabled:feed.phase==='loading','aria-label':tr('recommendRefresh'),title:tr('recommendRefresh'),onClick:()=>setRevision(v=>v+1)},h('svg',{width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17'}))):null),
      open?h('div',{className:'tanuki-recommend-body'},
        ['loading','error'].includes(feed.phase)?h('div',{className:'tanuki-recommend-status',role:'status'},tr(feed.phase==='loading'?'recommendLoading':'recommendUnavailable')):null,
        operation.phase!=='idle'?h('div',{className:'tanuki-recommend-notice',role:operation.phase==='failed'||operation.phase==='unknown'?'alert':'status'},h('span',null,tr(operation.busy?'recommendInstalling':operation.phase==='unknown'?'recommendUnknown':operation.key||'recommendInstallFailed')),operation.phase==='unknown'?h('button',{type:'button',className:'tanuki-link',disabled:operation.busy,onClick:()=>void resume()},tr('checkProgress')):null):null,
        h('div',{className:'tanuki-recommend-grid'},...feed.plugins.map(entry=>{
          const alias=Object.hasOwn(aliases,entry.name)?aliases[entry.name]:'';
          const title=alias||localized(entry.title,locale)||entry.name,description=localized(entry.description,locale);
          const repository=typeof entry.repository==='string'&&/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(entry.repository)?entry.repository:null;
          const installed=model.bundles.some(pkg=>pkg.name===entry.name&&pkg.installed);
          const busy=operation.busy&&operation.name===entry.name;
          const unavailable=feed.phase!=='ready'||!!entry.error||!entry.installSpec;
          return h('article',{className:'tanuki-recommend-card',key:entry.name},
            h('div',{className:'tanuki-recommend-main'},
              h('div',{className:'tanuki-recommend-heading'},h(Icon,{src:entry.icon,title}),h('div',null,h('h3',null,title),title!==entry.name?h('span',{className:'tanuki-recommend-original'},entry.name):null)),
              entry.version?h('span',{className:'tanuki-recommend-version'},'v'+entry.version):null,
              h('p',{className:'tanuki-recommend-description'},description),
              entry.error?h('p',{className:'tanuki-recommend-status',role:'status'},tr(entry.error==='GITHUB_LIMIT'?'recommendLimit':'recommendUnavailable')):null),
            h('div',{className:'tanuki-recommend-actions'},
              h('button',{type:'button',className:'tanuki-install-button',disabled:installed||unavailable||operation.busy||operation.phase==='unknown'||model.update.busy,onClick:()=>void install(entry)},installed?tr('recommendInstalledButton'):busy?tr('recommendInstallingButton'):tr('recommendInstall')),
              repository?h('a',{className:'tanuki-recommend-git',href:repository,target:'_blank',rel:'noopener noreferrer',title:tr('gitOpen')},'Git'):h('button',{type:'button',className:'tanuki-recommend-git',disabled:true,title:tr('gitMissing')},'Git')));
        })),
        feed.phase==='ready'&&!feed.plugins.length?h('p',null,tr('recommendEmpty')):null):null);
  }
  ctx.effect(()=>()=>{alive=false;listeners.clear();});
  return {Recommendations,GitButton};
};
  const componentIcons={"plugin-center":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiByeD0iMiIgZmlsbD0iIzg2QjNFRSIvPjxyZWN0IHg9IjEzIiB5PSIzIiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiByeD0iMiIgZmlsbD0iIzc4QjVBNyIvPjxyZWN0IHg9IjMiIHk9IjEzIiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiByeD0iMiIgZmlsbD0iIzc4QjVBNyIvPjxyZWN0IHg9IjEzIiB5PSIxMyIgd2lkdGg9IjgiIGhlaWdodD0iOCIgcng9IjIiIGZpbGw9IiM4NkIzRUUiLz48L3N2Zz4NCg==","home":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBkPSJNMyAxMC41IDExIDMuOGExLjYgMS42IDAgMCAxIDIgMGw4IDYuN2ExIDEgMCAwIDEtLjY1IDEuOEgxOVYxOWEyIDIgMCAwIDEtMiAySDdhMiAyIDAgMCAxLTItMnYtNi43SDMuNjVBMSAxIDAgMCAxIDMgMTAuNVoiIGZpbGw9IiM4NkIzRUUiLz48cGF0aCBkPSJNOSAyMXYtN2ExIDEgMCAwIDEgMS0xaDRhMSAxIDAgMCAxIDEgMXY3WiIgZmlsbD0iIzI0MzQ0NyIvPjxyZWN0IHg9IjEwIiB5PSIxNCIgd2lkdGg9IjQiIGhlaWdodD0iNyIgcng9IjEiIGZpbGw9IiM3OEI1QTciLz48L3N2Zz4NCg==","dynamic-island":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cmVjdCB4PSIyIiB5PSI1IiB3aWR0aD0iMjAiIGhlaWdodD0iMTQiIHJ4PSI3IiBmaWxsPSIjODZCM0VFIi8+PGNpcmNsZSBjeD0iNy41IiBjeT0iMTIiIHI9IjIuNSIgZmlsbD0iIzI0MzQ0NyIvPjxjaXJjbGUgY3g9IjcuNSIgY3k9IjEyIiByPSIxLjUiIGZpbGw9IiM3OEI1QTciLz48cmVjdCB4PSIxMiIgeT0iOSIgd2lkdGg9IjciIGhlaWdodD0iMiIgcng9IjEiIGZpbGw9IiMyNDM0NDciLz48cmVjdCB4PSIxMiIgeT0iMTMiIHdpZHRoPSI1IiBoZWlnaHQ9IjIiIHJ4PSIxIiBmaWxsPSIjMjQzNDQ3Ii8+PC9zdmc+DQo=","startup-guard":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBkPSJtMTIgMiA4IDN2NmMwIDUtMy41IDguNS04IDExLTQuNS0yLjUtOC02LTgtMTFWNVoiIGZpbGw9IiM4NkIzRUUiLz48cGF0aCBkPSJtOCAxMSAzIDMgNS02IiBmaWxsPSJub25lIiBzdHJva2U9IiMyNDM0NDciIHN0cm9rZS13aWR0aD0iMy41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cGF0aCBkPSJtOCAxMSAzIDMgNS02IiBmaWxsPSJub25lIiBzdHJva2U9IiM3OEI1QTciIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+DQo=","sidebar":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cmVjdCB4PSIyIiB5PSIzIiB3aWR0aD0iMjAiIGhlaWdodD0iMTgiIHJ4PSIzIiBmaWxsPSIjODZCM0VFIi8+PHJlY3QgeD0iNCIgeT0iNSIgd2lkdGg9IjUiIGhlaWdodD0iMTQiIHJ4PSIxLjUiIGZpbGw9IiM3OEI1QTciLz48cmVjdCB4PSIxMSIgeT0iNSIgd2lkdGg9IjkiIGhlaWdodD0iMTQiIHJ4PSIxLjUiIGZpbGw9IiMyNDM0NDciLz48Y2lyY2xlIGN4PSI2LjUiIGN5PSI4IiByPSIuOCIgZmlsbD0iIzI0MzQ0NyIvPjxjaXJjbGUgY3g9IjYuNSIgY3k9IjEyIiByPSIuOCIgZmlsbD0iIzI0MzQ0NyIvPjxjaXJjbGUgY3g9IjYuNSIgY3k9IjE2IiByPSIuOCIgZmlsbD0iIzI0MzQ0NyIvPjwvc3ZnPg0K"};
  function apply(ctx,{ready}){
    let alive=true,flight=null,again=false,timer;const requests=new Set(),listeners=new Set();
    let snapshot={bundles:[],update:{busy:false}};
    const publish=value=>{if(!alive)return;snapshot={...snapshot,...value};for(const fn of [...listeners])fn();};
    ctx.effect(()=>ctx.locale.register(NS,{"zh":{"toolbox":"黎猫工具箱","description":"集成了各种小组件，让DeepSeek Harness更好用。持续扩展中。","checkProgress":"重新检查进度","recommendations":"推荐插件","recommendLoading":"正在从 GitHub 读取最新插件…","recommendLive":"展开时获取 GitHub 最新发布信息","recommendUnavailable":"暂时无法读取 GitHub，请稍后刷新。","recommendLimit":"GitHub 请求暂时受限，请稍后刷新。","recommendRefresh":"刷新","recommendInstall":"安装","recommendInstalledButton":"已安装","recommendInstallingButton":"安装中…","recommendInstalling":"正在安装推荐插件…","recommendInstalled":"安装完成，已启用。","recommendRestart":"安装完成，重启 DSH 后生效。","recommendInstallFailed":"安装未完成，请在 DSH 的添加插件中查看详情或重试。","recommendAlreadyInstalled":"此插件已安装，请在「已安装」中管理。","recommendBuild":"此插件需要构建授权，请在 DSH 的添加插件中完成安装。","recommendIncompatible":"此版本与当前 DSH 不兼容，请选择适配的版本。","recommendUnknown":"暂时无法确认安装结果，请先重新检查进度。","recommendEmpty":"还没有推荐插件。","gitOpen":"在浏览器中打开 GitHub 仓库","gitMissing":"此插件尚未提供 GitHub 地址","gitLoading":"正在读取仓库信息","gitUnavailable":"暂时无法读取仓库信息，请稍后刷新。"},"en":{"toolbox":"Tanuki Toolbox","description":"A growing collection of small components that make DeepSeek Harness easier to use.","checkProgress":"Check progress again","recommendations":"Recommended plugins","recommendLoading":"Loading the latest plugins from GitHub…","recommendLive":"Latest GitHub release details are fetched when expanded","recommendUnavailable":"GitHub is unavailable. Please refresh later.","recommendLimit":"GitHub requests are temporarily limited. Please refresh later.","recommendRefresh":"Refresh","recommendInstall":"Install","recommendInstalledButton":"Installed","recommendInstallingButton":"Installing…","recommendInstalling":"Installing the recommended plugin…","recommendInstalled":"Installed and enabled.","recommendRestart":"Installed. Restart DSH to apply it.","recommendInstallFailed":"Installation did not finish. View details or retry in DSH’s Add plugin dialog.","recommendAlreadyInstalled":"This plugin is already installed. Manage it in Installed.","recommendBuild":"This plugin needs build approval. Complete installation in DSH’s Add plugin dialog.","recommendIncompatible":"This version is incompatible with your DSH. Choose a compatible version.","recommendUnknown":"The installation result is uncertain. Check its progress before retrying.","recommendEmpty":"No recommended plugins yet.","gitOpen":"Open the GitHub repository in your browser","gitMissing":"This plugin has not provided a GitHub repository","gitLoading":"Loading repository details","gitUnavailable":"Repository details are temporarily unavailable. Please refresh later."}}));const t=ctx.locale.bind(NS);
    function useLocale(){React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());return t;}
    function useModel(){return React.useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn);},()=>snapshot);}
    async function json(path,signal){
      if(!alive)throw new Error('View closed');
      const controller=new AbortController();requests.add(controller);
      const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      try{const result=await fetch(new URL(path.replace(/^\//,''),document.baseURI),{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!result.ok)throw new Error('Metadata unavailable');return await result.json();}
      finally{requests.delete(controller);signal?.removeEventListener('abort',abort);}
    }
    async function refresh(){
      if(!alive)return;if(flight){again=true;return flight;}
      flight=ctx.remote.pluginManager.listBundles().then(result=>{if(result.ok)publish({bundles:result.value});}).catch(()=>{}).finally(()=>{flight=null;if(again&&alive){again=false;void refresh();}});return flight;
    }
    const off=ctx.remote.$on('plugin-manager/changed',()=>{clearTimeout(timer);timer=setTimeout(refresh,250);});void refresh();
    const {Recommendations}=createRecommendationComponents({React,ctx,useLocale,useModel,json,refresh,notifyInstalled(){}});
    function Details(){const tr=useLocale();return h('div',{className:'tanuki-info'},h('img',{className:'tanuki-toolbox-hero',src:new URL('tanuki-toolbox/assets/toolbox.png?v=0.5.25',document.baseURI).href,width:160,height:160,alt:tr('toolbox')}),h(Recommendations));}
    ctx.effect(()=>{
      const style=document.createElement('style');
      // Use the same assets as Settings even when the host cached older metadata.
      // Scoped to the mounted toolbox detail; no observers or disabled-component code.
      const icons=Object.entries(componentIcons).map(([name,src])=>{
        const target='[data-plugin-detail="dsh-local-plugin-center"] [data-plugin-row="tanuki-'+name+'"] > div:first-child > span:first-child';
        return target+'{background-image:url("'+src+'");background-position:center;background-repeat:no-repeat;background-size:24px 24px;}'+target+' > *{visibility:hidden;}';
      }).join('\n');
      style.textContent=".tanuki-info .tanuki-quiet,.tanuki-info .tanuki-link{font:inherit;font-size:14px;line-height:20px;color:var(--dsw-alias-label-secondary,#b2b2b2);background:transparent;border:1px solid transparent;cursor:pointer;border-radius:8px;padding:7px 14px;display:inline-flex;gap:7px;align-items:center;white-space:nowrap;}\n.tanuki-info .tanuki-quiet{font-size:12px;padding:6px 8px;}\n.tanuki-quiet:disabled{opacity:.55;cursor:wait;}\n.tanuki-info{display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;gap:16px;padding:0 0 8px;width:100%;}\n.tanuki-toolbox-hero{width:160px;height:160px;object-fit:contain;}\n.tanuki-link{color:#c59b6d;font-size:12px;padding:4px 8px;}\n.tanuki-recommendations{width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,#ffffff20);border-radius:14px;overflow:hidden;container-type:inline-size;container-name:tanuki-recommendations;}\n.tanuki-recommend-header{position:relative;}\n.tanuki-recommend-refresh{position:absolute;right:44px;top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,#b2b2b2);cursor:pointer;}\n.tanuki-recommend-refresh:hover:not(:disabled){background:var(--dsw-alias-bg-layer-3,#353535);}\n.tanuki-recommend-refresh:disabled{opacity:.45;cursor:wait;}\n.tanuki-recommend-toggle{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;padding:16px 18px;border:0;background:var(--dsw-alias-bg-layer-1,#202020);color:var(--dsw-alias-label-primary,#eee);font:inherit;font-size:15px;font-weight:600;text-align:left;cursor:pointer;}\n.tanuki-recommend-toggle:hover{background:var(--dsw-alias-bg-layer-2,#292929);}\n.tanuki-recommend-body{padding:16px;}\n.tanuki-recommend-body>.tanuki-recommend-status{margin-bottom:12px;}\n.tanuki-recommend-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;}\n.tanuki-recommend-card{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:12px;min-width:0;padding:14px;border:1px solid var(--dsw-alias-border-l2,#ffffff20);border-radius:12px;box-sizing:border-box;background:var(--dsw-alias-bg-layer-1,#202020);}\n.tanuki-recommend-main{display:flex;flex-direction:column;gap:8px;min-width:0;}\n.tanuki-recommend-heading{display:flex;align-items:center;gap:10px;}\n.tanuki-recommend-original{display:block;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#888);overflow-wrap:anywhere;}\n.tanuki-recommend-actions{display:flex;flex-direction:column;align-items:stretch;gap:8px;}\n.tanuki-recommend-git{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:32px;padding:5px 10px;border:1px solid var(--dsw-alias-border-l2,#ffffff20);border-radius:9px;color:var(--dsw-alias-label-secondary,#b2b2b2);background:transparent;font:inherit;font-size:12px;text-decoration:none;cursor:pointer;}\n.tanuki-recommend-git:hover{background:var(--dsw-alias-bg-layer-2,#292929);}\n.tanuki-recommend-git:disabled{opacity:.45;cursor:default;}\n.tanuki-recommend-heading>div{min-width:0;}\n.tanuki-recommend-heading h3{font-size:16px;line-height:24px;font-weight:600;margin:0 0 4px;overflow-wrap:anywhere;}\n.tanuki-recommend-version{font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary,#aaa);}\n.tanuki-recommend-icon{width:44px;height:44px;object-fit:contain;border-radius:10px;flex:none;}\n.tanuki-recommend-fallback{display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-3,#353535);font-size:19px;}\n.tanuki-recommend-description{margin:0;font-size:13px;line-height:22px;color:var(--dsw-alias-label-secondary,#b2b2b2);overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;line-clamp:3;max-height:66px;overflow:hidden;text-overflow:ellipsis;}\n.tanuki-recommend-status,.tanuki-recommend-notice{margin:0;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary,#b2b2b2);}\n.tanuki-recommend-notice{display:flex;align-items:center;gap:8px;margin-bottom:12px;}\n.tanuki-install-button{min-width:60px;min-height:34px;padding:6px 10px;border:0;border-radius:9px;background:var(--dsw-alias-label-primary,#f5f5f5);color:var(--dsw-alias-bg-base,#151515);font:inherit;font-size:13px;cursor:pointer;}\n.tanuki-install-button:disabled{opacity:.45;cursor:default;}\n.tanuki-recommend-toggle:focus-visible,.tanuki-recommend-refresh:focus-visible,.tanuki-install-button:focus-visible,.tanuki-recommend-git:focus-visible{outline:2px solid #86b3ee;outline-offset:-3px;}\n.tanuki-recommend-toggle>span:first-child{padding-right:34px;}\n@container tanuki-recommendations (min-width:760px){.tanuki-recommend-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}\n@container tanuki-recommendations (min-width:1160px){.tanuki-recommend-grid{grid-template-columns:repeat(3,minmax(0,1fr));}}\n\n[data-plugin-detail=\"dsh-local-plugin-center\"] [data-plugin-rows] code,[data-plugin-detail=\"dsh-local-plugin-center\"] [data-plugin-row]>div:first-child>span:last-of-type{display:none!important;}\n[data-plugin-detail=\"dsh-local-plugin-center\"] [data-plugin-rows]>div:first-child>span{display:none!important;}\n[data-plugin-detail=\"dsh-local-plugin-center\"] [data-plugin-row]>div:first-child>div>span:nth-child(2){font-family:inherit;font-size:13px;line-height:20px;}\n"+'\n'+icons;document.head.appendChild(style);return()=>style.remove();
    });
    ctx.effect(()=>()=>{alive=false;clearTimeout(timer);off();for(const controller of requests)controller.abort();requests.clear();listeners.clear();snapshot={bundles:[],update:{busy:false}};});
    ready(Details);
  }
  return {name:'tanuki-details-runtime',inject:['locale','remote','remote.pluginManager'],apply};
});
