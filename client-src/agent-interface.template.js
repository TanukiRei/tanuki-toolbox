document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement;
  function apply(ctx,{ready}){
    const locale=(__LOCALE_FACTORY__)(ctx,'tanukiAgentInterface',__LOCALES__),t=locale.t;
    let alive=true;const requests=new Set();
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=__CSS__;document.head.appendChild(style);return()=>style.remove();});
    function Connection(){
      React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
      const [info,setInfo]=React.useState(null),[failed,setFailed]=React.useState(false),[retry,setRetry]=React.useState(0),[visible,setVisible]=React.useState(false),[copied,setCopied]=React.useState('');
      const area=React.useRef(null);
      React.useEffect(()=>{let mounted=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);requests.add(controller);setFailed(false);setInfo(null);
        fetch(new URL('tanuki-toolbox/agent-interface',document.baseURI),{credentials:'same-origin',cache:'no-store',headers:{'X-Tanuki-Settings':'1'},signal:controller.signal}).then(async answer=>{if(!answer.ok)throw Error('UNAVAILABLE');return answer.json();}).then(value=>{if(alive&&mounted)setInfo(value);}).catch(()=>{if(alive&&mounted&&!controller.signal.aborted)setFailed(true);else if(alive&&mounted)setFailed(true);}).finally(()=>{clearTimeout(timer);requests.delete(controller);});
        return()=>{mounted=false;controller.abort();clearTimeout(timer);requests.delete(controller);};
      },[retry]);
      const instructions=info?.address?t('instructions',{address:info.address,key:info.key,profile:info.profile}):'';
      const previewInstructions=visible?instructions:instructions.replaceAll(info?.key||'\0',t('hiddenKey'));
      async function copy(kind,value){try{await navigator.clipboard.writeText(value);if(alive)setCopied(kind);}catch{if(area.current){area.current.focus();area.current.select();}setCopied('manual');}}
      const field=(label,value,secret=false)=>h('div',{className:'tanuki-agent-field'},h('label',null,label,h('input',{readOnly:true,type:secret&&!visible?'password':'text',value:value||'','aria-label':label,spellCheck:false,autoComplete:'off'})),secret?h('button',{type:'button',onClick:()=>setVisible(v=>!v)},t(visible?'hide':'show')):null,h('button',{type:'button',disabled:!value,onClick:()=>void copy(secret?'key':'address',value)},t(copied===(secret?'key':'address')?'copied':'copy')));
      if(!info)return h('div',{className:'tanuki-agent-settings'},h('p',{className:'tanuki-settings-note',role:failed?'alert':'status'},t(failed?'unavailable':'loading')),failed?h('button',{type:'button',onClick:()=>setRetry(n=>n+1)},t('refresh')):null);
      return h('div',{className:'tanuki-agent-settings'},h('hr',{className:'tanuki-settings-divider'}),h('p',{className:'tanuki-settings-note'},t('localHint')),
        !info.address?h('p',{role:'alert'},t(info.error==='ADDRESS_IN_USE'?'portBusy':'unavailable')):null,
        field(t('address'),info.address),field(t('key'),info.key,true),
        info.address?h('p',{className:'tanuki-settings-note',role:'status'},t(info.desktop?.state==='ready'?'desktopReady':info.desktop?.state==='waiting'?'desktopWaiting':info.desktop?.state==='unsupported'?'desktopUnsupported':'desktopError')):null,
        h('label',{className:'tanuki-agent-instructions'},h('span',null,t('connectionInstructions')),h('textarea',{ref:area,readOnly:true,value:previewInstructions,spellCheck:false,'aria-label':t('connectionInstructions')})),
        h('div',{className:'tanuki-agent-actions'},h('button',{type:'button',disabled:!instructions,onClick:()=>void copy('instructions',instructions)},t(copied==='instructions'?'copied':'copyInstructions')),h('button',{type:'button',onClick:()=>{setCopied('');setRetry(n=>n+1);}},t('refresh'))),
        copied==='manual'?h('p',{role:'status',className:'tanuki-settings-note'},t('manualCopy')):null,
        h('p',{className:'tanuki-settings-note'},t('retained')));
    }
    ctx.effect(()=>()=>{alive=false;for(const controller of requests)controller.abort();requests.clear();});ready(Connection);
  }
  return {name:'tanuki-agent-interface-settings',inject:['locale'],apply};
});
