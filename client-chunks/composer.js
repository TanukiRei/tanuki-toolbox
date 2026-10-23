document.currentScript.__tanukiRegister(function(){
  function apply(ctx,{load}){
    let alive=true,request=null,epoch=0;
    const children=new Map();
    function stop(key){const entry=children.get(key);if(!entry)return;children.delete(key);entry.controller.abort();entry.fiber?.dispose();}
    function start(key){
      if(children.has(key)||!alive)return;
      const entry={controller:new AbortController(),fiber:null};children.set(key,entry);
      load(key,entry.controller.signal).then(module=>{
        if(alive&&children.get(key)===entry&&!entry.controller.signal.aborted)entry.fiber=ctx.plugin(module);
      }).catch(()=>{if(alive&&children.get(key)===entry&&!entry.controller.signal.aborted){children.delete(key);window.dispatchEvent(new CustomEvent('tanuki:notify',{detail:{kind:'error',destination:{page:'settings',section:'tanuki-toolbox',component:'composer'},title:{zh:'会话优化',en:'Conversation Enhancements'},message:{zh:'子功能加载失败，请重新开启后重试。',en:'Feature could not load. Toggle it off and on to retry.'}}}));}});
    }
    async function refresh(){
      const current=++epoch;request?.abort();const controller=new AbortController();request=controller;
      const timer=setTimeout(()=>controller.abort(),10000);
      try{
        const response=await fetch(new URL('tanuki-toolbox/settings',document.baseURI),{credentials:'same-origin',cache:'no-store',signal:controller.signal});
        if(!response.ok)throw new Error('Settings unavailable');const value=await response.json();
        if(!alive||current!==epoch||controller.signal.aborted)return;
        for(const [flag,key] of [['timeStats','composer-clock'],['modelSelection','composer-model'],['fileMenu','composer-files'],['sessionList','composer-list']]){
          if(value.composer?.[flag]===true)start(key);else stop(key);
        }
      }catch{}finally{clearTimeout(timer);if(request===controller)request=null;}
    }
    const changed=()=>void refresh();
    window.addEventListener('tanuki:settings-changed',changed);window.addEventListener('focus',changed);
    const off=ctx.on('connection/reset',changed);void refresh();
    ctx.effect(()=>()=>{alive=false;++epoch;request?.abort();off();window.removeEventListener('tanuki:settings-changed',changed);window.removeEventListener('focus',changed);for(const key of [...children.keys()])stop(key);});
  }
  return {name:'tanuki-composer-runtime',inject:['slots','locale'],apply};
});
