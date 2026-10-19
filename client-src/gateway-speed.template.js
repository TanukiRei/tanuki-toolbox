document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,NS='tanukiGatewaySpeed',empty=Object.freeze({compatible:false,supported:false,status:'unknown',mode:'inherit',result:null});
  function apply(ctx){
    let alive=true;const locale=(__LOCALE_FACTORY__)(ctx,NS,__LOCALES__),t=locale.t,stores=new Map(),requests=new Set();
    const url=(session,provider,model,listen=false)=>new URL('tanuki-toolbox/gateway-speed?'+new URLSearchParams({session:session||'',provider,model:model||'',...listen?{listen:'1'}:{}}),document.baseURI);
    async function request(provider,options={},session='',model=''){
      if(!alive)throw new DOMException('Stopped','AbortError');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000),abort=()=>controller.abort();requests.add(controller);options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort();
      try{const response=await fetch(url(session,provider,model),{...options,signal:controller.signal,credentials:'same-origin',cache:'no-store',headers:{'X-Tanuki-Settings':'1',...options.headers}});if(!response.ok)throw Error(t('unavailable'));const value=await response.json();if(alive)for(const store of stores.values())if(store.provider===provider&&(!session||store.session===session)){if(store.session===session&&store.model===model)store.publish(value);}return value;}finally{clearTimeout(timer);requests.delete(controller);options.signal?.removeEventListener('abort',abort);}
    }
    function storeFor(session,provider,model){
      const key=JSON.stringify([session,provider,model]);if(stores.has(key))return stores.get(key);
      let value=empty,refs=0,controller=null;const listeners=new Set();
      const store={session,provider,model,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},getSnapshot:()=>value,publish:next=>{if(!alive)return;value=next;for(const fn of listeners)fn();},stop:()=>{controller?.abort();controller=null;},retain:()=>{++refs;if(refs===1)connect();return()=>{if(!--refs){store.stop();stores.delete(key);}};}};
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
    const reset=()=>{for(const store of stores.values())void store.reconnect();},off=ctx.on('connection/reset',reset);ctx.effect(()=>{const style=document.createElement('style');style.textContent=__CSS__;document.head.appendChild(style);return()=>style.remove();});
    ctx.effect(()=>()=>{alive=false;off();for(const controller of requests)controller.abort();requests.clear();for(const store of stores.values())store.stop();stores.clear();});
  }
  return {name:'tanuki-gateway-speed-ui',inject:['slots','locale','tanukiSettingsWindow'],apply};
});
