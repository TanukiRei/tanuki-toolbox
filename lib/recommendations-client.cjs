'use strict';
function createRecommendationComponents({React,ctx,useLocale,useModel,json,refresh,notifyInstalled}){
  const h=React.createElement;
  let state={busy:false,name:null,phase:'idle'},alive=true;
  const listeners=new Set();
  const publish=patch=>{if(!alive)return;state={...state,...patch};for(const fn of listeners)fn();};
  const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
  function localized(value,locale){if(typeof value==='string')return value;return /^zh(?:[-_]|$)/i.test(locale)?value?.zh||value?.['zh-CN']||value?.['zh-TW']||value?.en||'':value?.en||'';}
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
}
module.exports={createRecommendationComponents};
