document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,{Switch}=require('@deepseek-ai/dsh-client-ui-primitives'),NS='tanukiModelSettings';
  const key=(provider,model)=>JSON.stringify([provider,model]);
  function apply(ctx,{ready}){
    let alive=true;const requests=new Set();
    const toolboxLocale=(__LOCALE_FACTORY__)(ctx,NS,__LOCALES__),t=toolboxLocale.t;
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=__CSS__;document.head.appendChild(style);return()=>style.remove();});
    async function request(query='',options={}){
      const controller=new AbortController();requests.add(controller);const timer=setTimeout(()=>controller.abort(),25000);
      const abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort();
      try{
        const answer=await fetch(new URL('tanuki-toolbox/model-policy'+query,document.baseURI),{...options,credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'X-Tanuki-Settings':'1',...options.headers}});
        if(!answer.ok)throw new Error('Model policy unavailable');
        return await answer.json();
      }finally{clearTimeout(timer);requests.delete(controller);options.signal?.removeEventListener('abort',abort);}
    }
    function Models(){
      React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
      const [data,setData]=React.useState(null),[error,setError]=React.useState(false),[loading,setLoading]=React.useState(true),[busy,setBusy]=React.useState(null),[query,setQuery]=React.useState('');
      const local=React.useRef(null);
      React.useEffect(()=>{
        const state={alive:true,busy:false,epoch:0,timer:null,refresh:null,read:null};local.current=state;
        const refresh=()=>{
          clearTimeout(state.timer);
          if(!alive||!state.alive)return;
          if(state.busy)return;
          state.read?.abort();state.read=new AbortController();
          const epoch=++state.epoch;setLoading(true);
          request('?catalog=1',{signal:state.read.signal}).then(value=>{if(alive&&state.alive&&state.epoch===epoch){setData(value);setError(false);}}).catch(()=>{if(alive&&state.alive&&state.epoch===epoch)setError(true);}).finally(()=>{if(alive&&state.alive&&state.epoch===epoch)setLoading(false);});
        };
        state.refresh=refresh;
        const schedule=()=>{clearTimeout(state.timer);state.timer=setTimeout(refresh,120);};
        const off=ctx.remote.$on('llm/adapters-updated',schedule),reset=ctx.on('connection/reset',schedule);
        const focus=()=>{if(document.visibilityState==='visible')schedule();};
        window.addEventListener('focus',focus);refresh();
        return()=>{state.alive=false;clearTimeout(state.timer);off();reset();window.removeEventListener('focus',focus);for(const controller of requests)controller.abort();};
      },[]);
      async function toggle(provider,model,enabled){
        const state=local.current;if(!alive||!state?.alive||state.busy)return;
        state.busy=true;state.read?.abort();++state.epoch;setBusy(key(provider,model));setError(false);setLoading(false);
        try{
          const result=await request('',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({provider,model,enabled})});
          if(alive&&state.alive){setData(previous=>({...previous,...result}));window.dispatchEvent(new CustomEvent('tanuki:model-policy-changed',{detail:result}));}
        }catch{if(alive&&state.alive)setError(true);}
        finally{if(alive&&state.alive){state.busy=false;setBusy(null);state.refresh();}}
      }
      const disabled=new Set((data?.disabled||[]).map(pair=>key(...pair))),groups=(data?.groups||[]).map(group=>({...group,models:[...group.models]}));
      // A removed/unavailable provider must never strand a saved disabled switch.
      for(const [provider,model] of data?.disabled||[]){
        let group=groups.find(item=>item.id===provider);
        if(!group){group={id:provider,name:provider,models:[]};groups.push(group);}
        if(!group.models.some(item=>item.id===model))group.models.push({id:model,name:model,missing:true});
      }
      const search=query.trim().toLocaleLowerCase(),count=groups.reduce((sum,group)=>sum+group.models.length,0);
      return h('section',{className:'tanuki-model-settings','aria-busy':busy!==null||loading},
        h('header',null,h('h3',null,t('title')),h('button',{type:'button',onClick:()=>local.current?.refresh(),disabled:busy!==null||loading},t('refresh'))),
        h('p',{className:'tanuki-model-policy-hint'},t('hint')),
        error?h('p',{role:'alert',className:'tanuki-model-policy-error'},t('error')):null,
        !data&&loading?h('p',{role:'status'},t('loading')):null,
        count>5?h('input',{className:'tanuki-model-policy-search',type:'search',value:query,'aria-label':t('search'),placeholder:t('search'),onChange:event=>setQuery(event.target.value)}):null,
        ...groups.map(group=>{
          const models=group.models.filter(model=>(group.name+' '+group.id+' '+model.name+' '+model.id).toLocaleLowerCase().includes(search));
          if(!models.length)return null;
          return h('section',{key:group.id,className:'tanuki-model-policy-provider','aria-label':group.name},h('h4',null,group.name),
            ...models.map(model=>h('div',{key:model.id,className:'tanuki-model-policy-row','data-disabled':disabled.has(key(group.id,model.id))},
              h('div',{className:'tanuki-model-policy-identity'},h('span',null,model.name),h('small',null,model.id),model.missing?h('small',null,t('missing')):null),
              h(Switch,{checked:!disabled.has(key(group.id,model.id)),label:t('toggle')+' '+model.name,disabled:busy!==null,onChange:enabled=>void toggle(group.id,model.id,enabled)}))));
        }),
        data?.failures?.length?h('p',{className:'tanuki-model-policy-hint'},t('partial')+' '+data.failures.map(item=>item.name).join('、')):null,
        data&&!count?h('p',null,t('empty')):null,
        search&&!groups.some(group=>group.models.some(model=>(group.name+' '+group.id+' '+model.name+' '+model.id).toLocaleLowerCase().includes(search)))?h('p',null,t('noMatch')):null);
    }
    ready(Models);
    ctx.effect(()=>()=>{alive=false;for(const controller of requests)controller.abort();requests.clear();});
  }
  return {name:'tanuki-model-settings',inject:['locale','remote'],apply};
});
