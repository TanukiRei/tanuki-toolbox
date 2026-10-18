document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,NS='tanukiDetails';
  const createRecommendationComponents=__RECOMMENDATIONS_FUNCTION__;
  const componentIcons=__COMPONENT_ICONS__;
  function apply(ctx,{ready}){
    let alive=true,flight=null,again=false,timer;const requests=new Set(),listeners=new Set();
    let snapshot={bundles:[],update:{busy:false}};
    const publish=value=>{if(!alive)return;snapshot={...snapshot,...value};for(const fn of [...listeners])fn();};
    ctx.effect(()=>ctx.locale.register(NS,__LOCALES__));const t=ctx.locale.bind(NS);
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
    function Details(){const tr=useLocale();return h('div',{className:'tanuki-info'},h('img',{className:'tanuki-toolbox-hero',src:new URL('tanuki-toolbox/assets/toolbox.png?v=__VERSION_TEXT__',document.baseURI).href,width:160,height:160,alt:tr('toolbox')}),h(Recommendations));}
    ctx.effect(()=>{
      const style=document.createElement('style');
      // Use the same assets as Settings even when the host cached older metadata.
      // Scoped to the mounted toolbox detail; no observers or disabled-component code.
      const icons=Object.entries(componentIcons).map(([name,src])=>{
        const target='[data-plugin-detail="dsh-local-plugin-center"] [data-plugin-row="tanuki-'+name+'"] > div:first-child > span:first-child';
        return target+'{background-image:url("'+src+'");background-position:center;background-repeat:no-repeat;background-size:24px 24px;}'+target+' > *{visibility:hidden;}';
      }).join('\n');
      style.textContent=__CSS__+'\n'+icons;document.head.appendChild(style);return()=>style.remove();
    });
    ctx.effect(()=>()=>{alive=false;clearTimeout(timer);off();for(const controller of requests)controller.abort();requests.clear();listeners.clear();snapshot={bundles:[],update:{busy:false}};});
    ready(Details);
  }
  return {name:'tanuki-details-runtime',inject:['locale','remote','remote.pluginManager'],apply};
});
