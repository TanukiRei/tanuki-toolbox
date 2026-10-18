document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,NS='tanukiGuardSettings';
  function apply(ctx,{ready}){
    ctx.effect(()=>ctx.locale.register(NS,__LOCALES__));const t=ctx.locale.bind(NS);
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=__CSS__;document.head.appendChild(style);return()=>style.remove();});
    function Settings(){
      React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
      const [report,setReport]=React.useState(null);
      React.useEffect(()=>{
        let alive=true,flight=null;const requests=new Set();
        function refresh(){
          if(!alive||flight)return;
          const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);requests.add(controller);
          flight=fetch(new URL('tanuki-toolbox/status',document.baseURI),{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('Status unavailable');return r.json();}).then(value=>{if(alive)setReport(value.shortcuts);}).catch(()=>{}).finally(()=>{clearTimeout(timer);requests.delete(controller);flight=null;});
        }
        refresh();const interval=setInterval(refresh,4000);
        return()=>{alive=false;clearInterval(interval);for(const controller of requests)controller.abort();};
      },[]);
      const keys={pending:'shortcutPending',enabling:'shortcutEnabling',restoring:'shortcutRestoring',enabled:'shortcutEnabled',restored:'shortcutRestored',none:'shortcutNone',partial:'shortcutPartial',error:'shortcutError'};
      return h('div',{className:'tanuki-shortcut-settings'},h('h4',null,t('shortcutTitle')),h('p',{role:'status'},t(keys[report?.status]||'shortcutPending',{n:String(report?.managed||0)})),h('p',null,t('shortcutBehavior')),h('p',{style:{opacity:.75}},t('shortcutScope')),report?.warnings?.some(w=>w.path)?h('details',null,h('summary',null,t('shortcutDetails')),h('ul',null,...report.warnings.filter(w=>w.path).map((w,i)=>h('li',{key:i},h('span',null,t(w.code==='changed'?'shortcutChanged':w.code==='backup-missing'?'shortcutBackupMissing':'shortcutDenied')),h('div',null,w.path))))):null);
    }
    ready(Settings);
  }
  return {name:'tanuki-guard-settings',inject:['locale'],apply};
});
