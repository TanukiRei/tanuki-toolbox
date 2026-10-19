document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),NS='tanukiComposerClock';
  function apply(ctx){
    let alive=true;
    const toolboxLocale=(__LOCALE_FACTORY__)(ctx,NS,__LOCALES__),t=toolboxLocale.t;
    function useLocale(){React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());return t;}
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=__CSS__;document.head.appendChild(style);return()=>style.remove();});
    // Native session-scoped dock is beside ContextMeter, not the workspace row.
    // useChat exposes durable turn/start and turn/end events (not mount times).
    // Owned exclusively by the optional Composer time-statistics subfeature.
    function TurnClock(props){
      if(typeof props.useSession!=='function'||typeof props.useChat!=='function'||typeof props.useProjection!=='function')return null;
      return React.createElement(TurnClockBody,props);
    }
    function TurnClockBody({sessionId,useSession,useChat,useProjection}){
      const clockT=useLocale(),running=useSession(s=>s.running),removed=useSession(s=>s.removed);
      const outline=useProjection('turnOutline');
      const latest=Array.isArray(outline)?outline.at(-1)?.turn:undefined;
      const turn=useChat(s=>{
        const timeline=s.timeline,number=timeline?.turnOrder?.at(-1);
        // Never show an older loaded turn as the current task while paging.
        if(latest===undefined||number!==latest)return undefined;
        return timeline.turns.get(number);
      });
      const start=turn?.start?.time,end=turn?.end?.time,reason=turn?.end?.data?.reason?.kind;
      const validStart=Number.isFinite(start)&&start>=0;
      const active=!removed&&running===true&&validStart&&turn?.status==='open'&&!turn.end;
      // Positive success allow-list: cancelled, errors, repaired/interrupted logs,
      // max-token limits and unknown future reasons must never become green.
      const done=!removed&&running===false&&validStart&&Number.isFinite(end)&&end>=start&&reason==='completed';
      const [now,setNow]=React.useState(Date.now);
      React.useEffect(()=>{
        if(!active)return;
        setNow(Date.now());
        const timer=setInterval(()=>{if(alive)setNow(Date.now());},1000);
        return()=>clearInterval(timer);
      },[sessionId,turn?.turn,start,active]);
      if(!active&&!done)return null;
      const seconds=Math.floor(Math.max(0,(done?end:now)-start)/1000);
      const duration=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':');
      return React.createElement('span',{className:'tanuki-turn-clock','data-state':done?'done':'running','aria-live':'off'},clockT(done?'turnCompleted':'turnRunning')+' '+duration);
    }
    ctx.slots.inject('conversation.composer.dock',()=>ctx.slots.register({name:'conversation.composer.dock',id:'tanuki-turn-clock',locale:NS,order:100},TurnClock));

    ctx.effect(()=>()=>{alive=false;});
  }
  return {name:'tanuki-composer-clock',inject:['slots','locale'],apply};
});
