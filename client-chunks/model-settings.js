document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,{Switch}=require('@deepseek-ai/dsh-client-ui-primitives'),NS='tanukiModelSettings';
  const key=(provider,model)=>JSON.stringify([provider,model]);
  function apply(ctx,{ready}){
    let alive=true;const requests=new Set();
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
})(ctx,NS,{"zh":{"title":"模型启用","hint":"关闭的模型不能用于新的调用。已有对话选中该模型时保留灰色占位并禁止发送，切换其他模型后从列表移除；重新开启后恢复。","refresh":"刷新","loading":"正在读取模型…","error":"无法读取或保存模型开关，请重试。设置未成功保存时不会改变原有开关。","search":"搜索模型或提供方","toggle":"启用模型","missing":"提供方当前未提供此模型；保留已保存的开关。","partial":"以下提供方的模型暂时无法读取：","empty":"当前没有可管理的模型。请先配置模型提供方。","noMatch":"没有匹配的模型。","restoreProvider":"重新启用模型服务"},"en":{"title":"Enabled models","hint":"Disabled models cannot be called. A disabled model already selected in a conversation remains as a grey placeholder and blocks sending. Choosing another model removes the placeholder. Enable it again to restore access.","refresh":"Refresh","loading":"Loading models…","error":"Could not read or save model switches. Please retry. Failed saves leave your previous switches unchanged.","search":"Search models or providers","toggle":"Enable model","missing":"Not currently advertised by its provider; the saved switch is retained.","partial":"Models are temporarily unavailable for:","empty":"No models to manage. Configure a provider first.","noMatch":"No matching models.","restoreProvider":"Enable provider again"}}),t=toolboxLocale.t;
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=".tanuki-model-settings{border-top:1px solid var(--dsw-alias-border-l1);padding-top:20px;margin-top:20px;color:var(--dsw-alias-label-primary)}\n.tanuki-model-settings>header{display:flex;align-items:center;justify-content:space-between;gap:16px}\n.tanuki-model-settings h3{font-size:16px;margin:0;font-weight:600}\n.tanuki-model-settings h4{font-size:14px;font-weight:500;margin:18px 0 6px;color:var(--dsw-alias-label-secondary)}\n.tanuki-model-policy-provider h4{display:flex;align-items:center;justify-content:space-between;gap:12px}.tanuki-provider-restore{font:inherit;font-size:12px;padding:4px 8px;background:transparent;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;color:var(--dsw-alias-label-secondary);cursor:pointer}.tanuki-provider-restore:disabled{opacity:.5;cursor:default}\n.tanuki-model-settings>header button{font:inherit;font-size:13px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);padding:5px 10px;cursor:pointer}\n.tanuki-model-settings>header button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}\n.tanuki-model-settings>header button:disabled{opacity:.5;cursor:default}\n.tanuki-model-policy-hint{font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary);margin:8px 0 12px}\n.tanuki-model-policy-error{font-size:13px;color:var(--dsw-alias-state-error-primary)}\n.tanuki-model-policy-search{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);padding:8px 10px;font:inherit;font-size:13px}\n.tanuki-model-policy-search::placeholder{color:var(--dsw-alias-label-caption)}\n.tanuki-model-policy-row{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:48px;padding:8px 0;border-bottom:1px solid var(--dsw-alias-border-l1)}\n.tanuki-model-policy-identity{display:flex;flex-direction:column;gap:3px;min-width:0;font-size:14px;overflow-wrap:anywhere}\n.tanuki-model-policy-identity small{font-size:12px;color:var(--dsw-alias-label-tertiary)}\n.tanuki-model-policy-row[data-disabled=true] .tanuki-model-policy-identity{color:var(--dsw-alias-label-tertiary)}\n.tanuki-model-settings :is(input,button):focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}\n";document.head.appendChild(style);return()=>style.remove();});
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
      const disabled=new Set((data?.disabled||[]).map(pair=>key(...pair))),disabledProviders=new Set(data?.disabledProviders||[]),groups=(data?.groups||[]).map(group=>({...group,models:[...group.models]}));
      for(const provider of disabledProviders)if(!groups.some(group=>group.id===provider))groups.push({id:provider,name:provider,models:[]});
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
          const providerDisabled=disabledProviders.has(group.id);
          if(!models.length&&!(providerDisabled&&(group.name+' '+group.id).toLocaleLowerCase().includes(search)))return null;
          return h('section',{key:group.id,className:'tanuki-model-policy-provider','aria-label':group.name},h('h4',null,group.name,providerDisabled?h('button',{type:'button',className:'tanuki-provider-restore',disabled:busy!==null,onClick:()=>void toggle(group.id,undefined,true)},t('restoreProvider')):null),
            ...models.map(model=>h('div',{key:model.id,className:'tanuki-model-policy-row','data-disabled':providerDisabled||disabled.has(key(group.id,model.id))},
              h('div',{className:'tanuki-model-policy-identity'},h('span',null,model.name),h('small',null,model.id),model.missing?h('small',null,t('missing')):null),
              h(Switch,{checked:!providerDisabled&&!disabled.has(key(group.id,model.id)),label:t('toggle')+' '+model.name,disabled:busy!==null||providerDisabled,onChange:enabled=>void toggle(group.id,model.id,enabled)}))));
        }),
        data?.failures?.length?h('p',{className:'tanuki-model-policy-hint'},t('partial')+' '+data.failures.map(item=>item.name).join('、')):null,
        data&&!count&&!disabledProviders.size?h('p',null,t('empty')):null,
        search&&!groups.some(group=>disabledProviders.has(group.id)&&(group.name+' '+group.id).toLocaleLowerCase().includes(search)||group.models.some(model=>(group.name+' '+group.id+' '+model.name+' '+model.id).toLocaleLowerCase().includes(search)))?h('p',null,t('noMatch')):null);
    }
    ready(Models);
    ctx.effect(()=>()=>{alive=false;for(const controller of requests)controller.abort();requests.clear();});
  }
  return {name:'tanuki-model-settings',inject:['locale','remote'],apply};
});
