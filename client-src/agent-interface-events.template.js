document.currentScript.__tanukiRegister(function(){
  function apply(ctx){
    let alive=true,controller=null,timer=null,attempt=0,epoch=0;
    async function connect(){
      if(!alive||controller)return;clearTimeout(timer);const current=++epoch,request=new AbortController();controller=request;
      try{const answer=await fetch(new URL('tanuki-toolbox/agent-interface/events',document.baseURI),{credentials:'same-origin',cache:'no-store',headers:{'X-Tanuki-Settings':'1'},signal:request.signal});if(!answer.ok||!answer.body)throw Error('UNAVAILABLE');const reader=answer.body.getReader(),decoder=new TextDecoder();let buffer='';
        try{while(alive&&epoch===current){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});if(buffer.length>8192)throw Error('INVALID_STREAM');let end;while((end=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,end);buffer=buffer.slice(end+2);if(event.startsWith('event: settings')){attempt=0;window.dispatchEvent(new CustomEvent('tanuki:settings-changed'));}}}}finally{try{await reader.cancel();}catch{}reader.releaseLock();}
      }catch{}finally{if(controller===request)controller=null;if(alive&&current===epoch&&++attempt<=3)timer=setTimeout(()=>void connect(),attempt*1500);}
    }
    const reconnect=()=>{if(alive&&!controller){attempt=0;void connect();}};const off=ctx.on('connection/reset',reconnect);window.addEventListener('focus',reconnect);void connect();
    ctx.effect(()=>()=>{alive=false;++epoch;clearTimeout(timer);controller?.abort();off();window.removeEventListener('focus',reconnect);});
  }
  return {name:'tanuki-agent-interface-events',apply};
});
