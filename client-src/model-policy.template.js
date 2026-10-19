document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,NS='tanukiModelPolicy';
  const key=value=>JSON.stringify([value?.provider,value?.model]);
  function apply(ctx){
    let alive=true,revision=0,flight=null,epoch=0,timer;
    let snapshot=Object.freeze({disabled:new Set(),ready:false});
    const listeners=new Set(),records=new Map();
    const toolboxLocale=(__LOCALE_FACTORY__)(ctx,NS,__LOCALES__),t=toolboxLocale.t;
    const style=document.createElement('style');document.head.appendChild(style);
    function styleRules(){
      const rules=[__CSS__];
      const active=new Set([...records.values()].map(record=>key(record.selection())).filter(value=>snapshot.disabled.has(value)));
      for(const value of active){const [provider,model]=JSON.parse(value),match='[data-provider-id="'+CSS.escape(provider)+'"][data-model-id="'+CSS.escape(model)+'"]';
        rules.push('button:has('+match+'){color:var(--dsw-alias-label-tertiary)!important}button[role="menuitemradio"]:has('+match+'){cursor:not-allowed;pointer-events:none;opacity:.6}');
      }
      style.textContent=rules.join('\n');
    }
    function accept(value){
      if(!alive||value?.schema!==1||!Array.isArray(value.disabled)||value.disabled.length>8192||!value.disabled.every(pair=>Array.isArray(pair)&&pair.length===2&&pair.every(id=>typeof id==='string'&&id.length>0&&id.length<=1024)))return;
      const disabled=new Set(value.disabled.map(pair=>JSON.stringify(pair)));
      if(snapshot.ready&&disabled.size===snapshot.disabled.size&&[...disabled].every(value=>snapshot.disabled.has(value)))return;
      snapshot=Object.freeze({ready:true,disabled});++revision;styleRules();
      for(const record of records.values())record.notify();
      for(const listener of [...listeners])listener();
    }
    function isDisabled(selection){return snapshot.disabled.has(key(selection));}
    function retain(directory){
      let record=records.get(directory);
      if(record){++record.users;return()=>release(directory,record);}
      const store=directory.store,get=store.getSnapshot,select=directory.select;
      const getDescriptor=Object.getOwnPropertyDescriptor(store,'getSnapshot'),selectDescriptor=Object.getOwnPropertyDescriptor(directory,'select');
      let previous,seenRevision=-1,projected,lastChoice;
      function project(){
        const raw=get.call(store);
        if(raw===previous&&seenRevision===revision)return projected;
        previous=raw;seenRevision=revision;
        const current=raw.current,choice=raw.groups?.find(group=>group.id===current?.provider)?.models.find(model=>model.id===current?.model);
        if(choice&&!choice.tanukiDisabled)lastChoice={selection:key(current),model:choice};
        const blocked=isDisabled(current);
        const groups=(raw.groups||[]).map(group=>({...group,models:group.models.filter(model=>!isDisabled({provider:group.id,model:model.id}))})).filter(group=>group.models.length);
        if(blocked){
          let group=groups.find(item=>item.id===current.provider);
          if(!group){group={id:current.provider,name:raw.groups?.find(item=>item.id===current.provider)?.name||current.provider,models:[]};groups.push(group);}
          const remembered=lastChoice?.selection===key(current)?lastChoice.model:null;
          group.models.push({...remembered,id:current.model,name:remembered?.name||current.model,tanukiDisabled:true});
        }
        projected={...raw,groups,tanukiDisabledCurrent:blocked,...blocked?{routable:false}:{}};
        return projected;
      }
      const guardedSelect=function(selection){
        if(isDisabled(selection))return Promise.resolve({ok:false,error:{code:'tanuki/model-disabled',message:t('disabled'),details:{}}});
        return select.call(this,selection);
      };
      record={users:1,selection:()=>get.call(store).current,notify:()=>{const raw=get.call(store);store.set({...raw});},dispose:()=>{
        if(store.getSnapshot===project){if(getDescriptor)Object.defineProperty(store,'getSnapshot',getDescriptor);else delete store.getSnapshot;}
        if(directory.select===guardedSelect){if(selectDescriptor)Object.defineProperty(directory,'select',selectDescriptor);else delete directory.select;}
        record.notify();
      }};
      Object.defineProperty(store,'getSnapshot',{configurable:true,writable:true,value:project});
      Object.defineProperty(directory,'select',{configurable:true,writable:true,value:guardedSelect});
      records.set(directory,record);record.notify();styleRules();
      return()=>release(directory,record);
    }
    function release(directory,record){if(records.get(directory)!==record||--record.users>0)return;records.delete(directory);record.dispose();if(alive)styleRules();}
    const policy={subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},getSnapshot:()=>snapshot,isDisabled,retain};
    ctx.provide('tanukiModels',policy);
    async function refresh(){
      if(!alive)return;flight?.abort();const controller=new AbortController();flight=controller;const generation=++epoch;
      const timeout=setTimeout(()=>controller.abort(),10000);
      try{
        const answer=await fetch(new URL('tanuki-toolbox/model-policy',document.baseURI),{credentials:'same-origin',cache:'no-store',signal:controller.signal});
        if(!answer.ok)throw new Error('Model policy unavailable');
        const value=await answer.json();if(alive&&generation===epoch)accept(value);
      }catch(error){if(alive&&generation===epoch&&!controller.signal.aborted)console.warn('[Tanuki] Model switches unavailable',error);}
      finally{clearTimeout(timeout);if(flight===controller)flight=null;}
    }
    const schedule=()=>{clearTimeout(timer);if(alive)timer=setTimeout(()=>void refresh(),60);};
    const changed=event=>{++epoch;flight?.abort();accept(event.detail);};
    const focus=()=>{if(document.visibilityState==='visible')schedule();};
    const off=ctx.remote.$on('llm/adapters-updated',schedule),reset=ctx.on('connection/reset',schedule);
    window.addEventListener('tanuki:model-policy-changed',changed);window.addEventListener('focus',focus);void refresh();styleRules();
    ctx.inject(['modelDirectories','conversation'],scope=>{
      const models=scope.get('modelDirectories'),conversation=scope.get('conversation');
      function Guard({sessionId,directory}){
        React.useSyncExternalStore(policy.subscribe,policy.getSnapshot);
        React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
        const state=React.useSyncExternalStore(fn=>directory.store.subscribe(fn),()=>directory.store.getSnapshot());
        const blocked=isDisabled(state.current),reason=t('disabled');
        React.useLayoutEffect(()=>retain(directory),[directory]);
        React.useLayoutEffect(()=>{if(alive)styleRules();},[state.current?.provider,state.current?.model,blocked]);
        React.useLayoutEffect(()=>{
          if(!blocked)return;
          const token={},store=conversation.blocks.storeFor(sessionId);
          const update=()=>{const held=store.getSnapshot();if(held===undefined||held.tanukiModelOwner===token)conversation.blocks.set(sessionId,{reason,tanukiModelOwner:token});};
          const off=store.subscribe(update);update();
          return()=>{off();if(store.getSnapshot()?.tanukiModelOwner===token)conversation.blocks.set(sessionId,undefined);};
        },[sessionId,blocked,reason]);
        return blocked?h('span',{'data-tanuki-disabled-model':'',className:'tanuki-disabled-model-notice',role:'status'},reason):null;
      }
      scope.slots.inject('conversation.input.overlay',()=>scope.slots.register({name:'conversation.input.overlay',id:'tanuki-model-policy',locale:NS,inject:sessionId=>({sessionId,directory:models.directoryFor(sessionId)})},Guard));
    });
    ctx.effect(()=>()=>{
      alive=false;clearTimeout(timer);flight?.abort();off();reset();window.removeEventListener('tanuki:model-policy-changed',changed);window.removeEventListener('focus',focus);
      for(const record of records.values())record.dispose();records.clear();listeners.clear();style.remove();
    });
  }
  return {name:'tanuki-model-policy',inject:['slots','locale','remote'],apply};
});
