document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,NS='tanukiGatewaySpeed',empty=Object.freeze({compatible:false,supported:false,status:'unknown',mode:'inherit',result:null});
  function apply(ctx){
    let alive=true;const locale=(function createToolboxLocale(ctx, namespace, dictionaries) {
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
})(ctx,NS,{"zh":{"speed":"速度","mode_inherit":"继承中枢","mode_standard":"标准","mode_fast":"快速","hint_inherit":"不指定速度，使用中枢 API 密钥的默认设置。","hint_standard":"明确请求标准速度（default）。","hint_fast":"请求快速通道（priority），可能消耗更多额度。","loading":"正在读取能力…","refresh":"重新读取速度能力","unavailable":"能力读取或保存失败，请检查 API 地址、凭据及权限后重试。","notAdvertised":"该模型当前未声明快速能力；可重新读取目录。","nextTurn":"选择只影响下一轮任务；当前任务保持开始时的速度，服务端强制速度策略优先。","confirmed":"上游已确认快速","awaiting":"已请求快速，等待上游确认","unconfirmed":"快速状态未确认","returnedStandard":"上游返回标准","failed":"本次请求失败","aborted":"本次请求已中断","providerHint":"速度选项依据服务端模型目录能力显示。","unsupportedProtocol":"当前服务不支持此速度接口；请使用 OpenAI Chat Completions 协议。","readComplete":"能力已读取；支持的模型会显示速度选项。","notRead":"尚未读取速度能力。","switchStandard":"点击请求标准速度","switchFast":"点击请求快速通道，可能消耗更多额度"},"en":{"speed":"Speed","mode_inherit":"Gateway default","mode_standard":"Standard","mode_fast":"Fast","hint_inherit":"Omit the tier and use the gateway API key's default.","hint_standard":"Explicitly request the default service tier.","hint_fast":"Request the priority tier. This may use more quota.","loading":"Reading capabilities…","refresh":"Refresh speed capabilities","unavailable":"Could not read or save capabilities. Check the API URL, credentials and permissions.","notAdvertised":"This model does not currently advertise Fast. Refresh its catalog to retry.","nextTurn":"Changes apply to the next task turn; the current turn keeps its initial selection. Enforced server speed policies take precedence.","confirmed":"Upstream confirmed Fast","awaiting":"Fast requested; waiting for upstream confirmation","unconfirmed":"Fast status unconfirmed","returnedStandard":"Upstream returned Standard","failed":"This request failed","aborted":"This request was interrupted","providerHint":"Speed controls follow capabilities advertised by the model catalog.","unsupportedProtocol":"This speed interface requires OpenAI Chat Completions.","readComplete":"Capabilities read. Supported models will show speed controls.","notRead":"Speed capabilities have not been read yet.","switchStandard":"Click to request Standard","switchFast":"Click to request Fast; this may use more quota"}}),t=locale.t,stores=new Map(),requests=new Set();
    const url=(session,provider,model,listen=false)=>new URL('tanuki-toolbox/gateway-speed?'+new URLSearchParams({session:session||'',provider,model:model||'',...listen?{listen:'1'}:{}}),document.baseURI);
    async function request(provider,options={},session='',model=''){
      if(!alive)throw new DOMException('Stopped','AbortError');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000),abort=()=>controller.abort();requests.add(controller);options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort();
      const id=JSON.stringify([session,provider,model]),store=stores.get(id),revision=store?.revision;
      try{const response=await fetch(url(session,provider,model),{...options,signal:controller.signal,credentials:'same-origin',cache:'no-store',headers:{'X-Tanuki-Settings':'1',...options.headers}});if(!response.ok)throw Error(t('unavailable'));const value=await response.json();if(alive&&!controller.signal.aborted&&store&&stores.get(id)===store&&store.revision===revision)store.publish(value);return value;}finally{clearTimeout(timer);requests.delete(controller);options.signal?.removeEventListener('abort',abort);}
    }
    function storeFor(session,provider,model){
      const key=JSON.stringify([session,provider,model]);if(stores.has(key))return stores.get(key);
      let value=empty,refs=0,controller=null;const listeners=new Set();
      const store={session,provider,model,revision:0,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},getSnapshot:()=>value,publish:next=>{if(!alive)return;++store.revision;value=next;for(const fn of listeners)fn();},stop:()=>{controller?.abort();controller=null;},retain:()=>{++refs;if(refs===1)connect();return()=>{if(!--refs){store.stop();stores.delete(key);}};}};
      async function connect(){store.stop();if(!alive||!refs)return;const current=new AbortController();controller=current;
        try{const response=await fetch(url(session,provider,model,true),{credentials:'same-origin',cache:'no-store',signal:current.signal});if(!response.ok)throw Error();const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';try{while(true){const {done,value:chunk}=await reader.read();if(done)break;if(!alive||current.signal.aborted)break;buffer+=decoder.decode(chunk,{stream:true});if(buffer.length>256*1024)throw Error();let index;while((index=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,index);buffer=buffer.slice(index+2);if(event.startsWith('data: '))store.publish(JSON.parse(event.slice(6)));}}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}if(alive&&!current.signal.aborted)store.publish({...value,supported:false,status:'error',error:'DISCONNECTED'});}
        catch{if(alive&&!current.signal.aborted)store.publish({...value,supported:false,status:'error',error:'CONNECTION_UNAVAILABLE'});}
      }
      store.reconnect=connect;stores.set(key,store);return store;
    }
    function useSpeed(session,provider,model){const store=React.useMemo(()=>storeFor(session||'',provider||'',model||''),[session,provider,model]),state=React.useSyncExternalStore(store.subscribe,store.getSnapshot);React.useEffect(()=>session&&provider&&model?store.retain():undefined,[store,session,provider,model]);return state;}
    function resultText(state){const result=state.result;if(!result)return '';if(result.status==='error')return t('failed');if(result.status==='aborted')return t('aborted');if(result.mode!=='fast')return '';if(['fast','priority'].includes(result.actual)&&result.confirmed)return t('confirmed');if(result.actual==='default')return t('returnedStandard');return t(result.status==='running'?'awaiting':'unconfirmed');}
    async function set(session,provider,model,mode){return request(provider,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({mode})},session,model);}
    async function refresh(provider,signal){const value=await request(provider,{method:'POST',signal});if(alive)window.dispatchEvent(new CustomEvent('tanuki:gateway-speed-refreshed',{detail:{provider}}));return value;}
    function Bolt(){return h('svg',{viewBox:'0 0 24 24',width:18,height:18,fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'M13 2 4 14h7l-1 8 10-13h-7l1-7z'}));}
    function Control({sessionId,current,locked=false,variant='inline',fallback=null}){
      React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
      const provider=current?.provider,model=current?.model,state=useSpeed(sessionId,provider,model),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),life=React.useRef(false),operations=React.useRef(new Set()),selection=React.useRef(null);
      selection.current=JSON.stringify([sessionId,provider,model]);
      React.useEffect(()=>{life.current=true;return()=>{life.current=false;};},[]);
      React.useEffect(()=>{setBusy(operations.current.has(selection.current));setError('');},[sessionId,provider,model]);
      async function toggle(){
        const token=selection.current;if(locked||!state.supported||state.status!=='ready'||operations.current.has(token))return;
        operations.current.add(token);setBusy(true);setError('');
        try{await set(sessionId,provider,model,state.mode==='fast'?'standard':'fast');}
        catch{if(alive&&life.current&&selection.current===token)setError(t('unavailable'));}
        finally{operations.current.delete(token);if(alive&&life.current&&selection.current===token)setBusy(false);}
      }
      if(!state.compatible||!state.supported&&!['loading','error','unknown'].includes(state.status))return fallback;
      const text=resultText(state),fast=state.mode==='fast',disabled=locked||busy||!state.supported||state.status!=='ready';
      const hint=error||(state.status==='error'?t('unavailable'):state.status==='loading'?t('loading'):!state.supported||state.status!=='ready'?t('notAdvertised'):t(fast?'switchStandard':'switchFast'));
      const title=[t('speed')+' · '+t('mode_'+state.mode),hint,text,t('nextTurn')].filter(Boolean).join(' · ');
      return h('span',{className:'tanuki-gateway-speed','data-variant':variant,'aria-busy':busy},h('button',{type:'button',className:variant==='card'?'tanuki-model-hit tanuki-model-speed':'tanuki-gateway-speed-trigger','data-fast':fast,disabled,title,'aria-label':title,'aria-pressed':fast,onClick:()=>void toggle()},h(Bolt),variant==='inline'?h('span',null,t('mode_'+state.mode)):null));
    }
    function Provider({provider}){
      React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());const shell=ctx.get('tanukiSettingsWindow'),shown=React.useSyncExternalStore(shell.subscribe,shell.getSnapshot),[state,setState]=React.useState(null),[busy,setBusy]=React.useState(false),mounted=React.useRef(false),pending=React.useRef(null);
      React.useEffect(()=>{mounted.current=shown;setBusy(false);if(!shown)return;const read=()=>{pending.current?.abort();const controller=new AbortController();pending.current=controller;void request(provider,{signal:controller.signal}).then(value=>{if(mounted.current&&!controller.signal.aborted)setState(value);}).catch(()=>{});},changed=event=>{if(event.detail?.provider===provider)read();};read();window.addEventListener('tanuki:gateway-speed-refreshed',changed);return()=>{mounted.current=false;pending.current?.abort();window.removeEventListener('tanuki:gateway-speed-refreshed',changed);};},[provider,shown]);
      return h('div',{className:'tanuki-gateway-provider'},h('span',null,t('providerHint')),h('button',{type:'button',disabled:busy||!shown||state?.compatible===false,onClick:async()=>{pending.current?.abort();const controller=new AbortController();pending.current=controller;setBusy(true);try{const value=await refresh(provider,controller.signal);if(mounted.current&&!controller.signal.aborted)setState(value);}catch{if(mounted.current&&!controller.signal.aborted)setState({compatible:true,status:'error'});}finally{if(mounted.current)setBusy(false);}}},t(busy?'loading':'refresh')),state?h('small',{role:'status'},t(!state.compatible?'unsupportedProtocol':state.status==='error'?'unavailable':state.status==='ready'?'readComplete':'notRead')):null);
    }
    const bridge={Control,Provider,refresh,set,resultText};ctx.provide('tanukiGatewaySpeed',bridge);
    const shell=ctx.get('tanukiSettingsWindow');ctx.slots.inject('conversation.input.model',()=>shell.decorate('conversation.input.model',entry=>entry.locale==='model'&&entry.children?.['conversation.input.model.label'],Original=>function NativeWithSpeed(props){const current=React.useSyncExternalStore(fn=>props.directory.subscribe(fn),()=>props.directory.getSnapshot()).current;return h(React.Fragment,null,h(Original,props),props.available?h(Control,{sessionId:props.tanukiSpeedSessionId,current,locked:props.locked}):null);},sessionId=>({tanukiSpeedSessionId:sessionId})));
    const reset=()=>{for(const store of stores.values())void store.reconnect();},off=ctx.on('connection/reset',reset);ctx.effect(()=>{const style=document.createElement('style');style.textContent=".tanuki-gateway-speed{display:inline-flex;position:relative;min-width:0;align-items:center}.tanuki-gateway-speed[data-variant=card]{align-items:stretch}.tanuki-gateway-speed[data-variant=card]>button{width:100%}.tanuki-gateway-speed-trigger{display:flex;align-items:center;gap:3px;border:0;border-radius:7px;padding:3px 6px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}.tanuki-gateway-speed button[data-fast=true]{color:var(--dsw-alias-state-business-primary)}.tanuki-gateway-speed button[data-fast=true]>svg{fill:currentColor}.tanuki-gateway-speed-trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}.tanuki-gateway-speed button:disabled{opacity:.45;cursor:default}.tanuki-gateway-speed button:focus-visible{outline:2px solid var(--dsw-focus-ring-color);outline-offset:1px}.tanuki-gateway-provider{display:flex;align-items:center;gap:7px;flex-wrap:wrap;color:var(--dsw-alias-label-secondary);font-size:11px}.tanuki-gateway-provider>button{border:1px solid var(--dsw-alias-border-l3);border-radius:7px;padding:4px 8px;background:transparent;color:inherit;font:inherit;cursor:pointer}.tanuki-gateway-provider>small{width:100%;color:var(--dsw-alias-label-tertiary)}\n";document.head.appendChild(style);return()=>style.remove();});
    ctx.effect(()=>()=>{alive=false;off();for(const controller of requests)controller.abort();requests.clear();for(const store of stores.values())store.stop();stores.clear();});
  }
  return {name:'tanuki-gateway-speed-ui',inject:['slots','locale','tanukiSettingsWindow'],apply};
});
