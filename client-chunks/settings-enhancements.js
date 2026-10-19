document.currentScript.__tanukiRegister(function(){
  function apply(ctx,{load}){
    let alive=true,request=null,epoch=0,child=null,speedChild=null,pending=null;
    function stop(){pending?.abort();pending=null;child?.dispose();child=null;speedChild?.dispose();speedChild=null;}
    async function refresh(){
      const current=++epoch;request?.abort();const controller=new AbortController();request=controller;const timer=setTimeout(()=>controller.abort(),10000);
      try{const r=await fetch(new URL('tanuki-toolbox/settings',document.baseURI),{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!r.ok)return;const settings=await r.json();if(!alive||epoch!==current||controller.signal.aborted)return;
        if(settings.settingsEnhancements?.models!==true){stop();return;}
        if(child||pending)return;const loading=new AbortController();pending=loading;
        try{const speed=await load('gateway-speed',loading.signal);if(!alive||pending!==loading||loading.signal.aborted)return;if(!speedChild)speedChild=ctx.plugin(speed);const module=await load('settings-models',loading.signal);if(alive&&pending===loading&&!loading.signal.aborted)child=ctx.plugin(module);}finally{if(pending===loading)pending=null;}
      }catch(error){if(alive&&!controller.signal.aborted)console.warn('[Tanuki] Settings enhancements unavailable',error);}finally{clearTimeout(timer);if(request===controller)request=null;}
    }
    const changed=()=>void refresh();window.addEventListener('tanuki:settings-changed',changed);const off=ctx.on('connection/reset',changed);void refresh();
    ctx.effect(()=>()=>{alive=false;++epoch;request?.abort();stop();off();window.removeEventListener('tanuki:settings-changed',changed);});
  }
  return {name:'tanuki-settings-enhancements',inject:['slots','locale'],apply};
});
