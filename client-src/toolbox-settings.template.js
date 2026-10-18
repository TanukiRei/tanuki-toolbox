document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,NS='tanukiSettings';
  const {Switch}=require('@deepseek-ai/dsh-client-ui-primitives');
  const createAudioPreview=__AUDIO_PREVIEW_FACTORY__;
  // Static component artwork only; never load component business modules for settings icons.
  const componentIcons=__COMPONENT_ICONS__;
  function ComponentIcon({name}){
    return h('img',{className:'tanuki-settings-component-icon',src:componentIcons[name],width:24,height:24,alt:'','aria-hidden':true});
  }
  const divider=short=>h('hr',{className:'tanuki-settings-divider'+(short?' tanuki-settings-divider-short':''),'aria-hidden':true});
  function SettingsCard({name,title,description,control,children,t,onCollapse}){
    const [expanded,setExpanded]=React.useState(false),[mounted,setMounted]=React.useState(false),button=React.useRef(null),id=React.useId();
    const hasDetails=React.Children.toArray(children).length>0;
    function collapse(fromBottom=false){
      setExpanded(false);onCollapse?.();
      if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)setMounted(false);
      if(fromBottom)button.current?.focus({preventScroll:true});
    }
    const chevron=h('svg',{viewBox:'0 0 24 24',width:16,height:16,fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:'m6 9 6 6 6-6'}));
    return h('section',{className:'tanuki-settings-card','data-tanuki-setting':name},
      h('header',{className:'tanuki-settings-header'},h('h3',null,h(ComponentIcon,{name}),h('span',null,title)),h('div',{className:'tanuki-settings-header-actions'},
        hasDetails?h('button',{ref:button,type:'button',className:'tanuki-settings-expand','aria-expanded':expanded,'aria-controls':id,'aria-label':t(expanded?'collapseSettings':'expandSettings')+' · '+title,title:t(expanded?'collapseSettings':'expandSettings'),onClick:()=>{if(expanded)collapse();else{setMounted(true);setExpanded(true);}}},chevron):null,control)),
      description?h('p',{className:'tanuki-settings-description'},description):null,
      hasDetails?h('div',{id,className:'tanuki-settings-fold','data-expanded':expanded,'aria-hidden':!expanded,inert:!expanded,onTransitionEnd:event=>{if(event.target===event.currentTarget&&event.propertyName==='grid-template-rows'&&!expanded)setMounted(false);}},
        h('div',{className:'tanuki-settings-fold-inner'},mounted?h(React.Fragment,null,children,h('button',{type:'button',className:'tanuki-settings-collapse',onClick:()=>collapse(true)},t('collapseSettings'),chevron)):null)):null);
  }
  function apply(ctx,{ready}){
    let alive=true;const requests=new Set(),decoders=new Set(),previews=new Set();
    ctx.effect(()=>ctx.locale.register(NS,__LOCALES__));const t=ctx.locale.bind(NS);
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=__CSS__;document.head.appendChild(style);return()=>style.remove();});
    async function request(path,options={}){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);requests.add(controller);
      try{const r=await fetch(new URL('tanuki-toolbox/'+path,document.baseURI),{...options,credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'X-Tanuki-Settings':'1',...options.headers}});if(!r.ok)throw new Error(String(r.status));return await r.json();}
      finally{clearTimeout(timer);requests.delete(controller);}
    }
    function Settings({view}={}){
      React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
      const [settings,setSettings]=React.useState(null),[rows,setRows]=React.useState([]),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(false),[volume,setVolume]=React.useState(100),[switchBusy,setSwitchBusy]=React.useState(false),[permission,setPermission]=React.useState(()=>typeof window.Notification==='function'?window.Notification.permission:'unsupported');
      const generation=React.useRef(0),operation=React.useRef(false),switchLock=React.useRef(false),preview=React.useRef(null),fileInput=React.useRef(null),refreshRows=React.useRef(null);
      const cancel=()=>{for(const controller of requests)controller.abort();for(const decoder of decoders)void decoder.close().catch(()=>{});decoders.clear();};
      React.useEffect(()=>{++generation.current;let mounted=true,read=0;const player=createAudioPreview({baseURI:document.baseURI});preview.current=player;previews.add(player);
        const refresh=async()=>{const token=++read;try{const r=await ctx.remote.pluginManager.listPlugins();if(alive&&mounted&&token===read&&r.ok)setRows(r.value);}catch{}};refreshRows.current=refresh;void refresh();const off=ctx.remote.$on('plugin-manager/changed',refresh);const syncPermission=()=>{if(alive&&mounted)setPermission(typeof window.Notification==='function'?window.Notification.permission:'unsupported');};window.addEventListener('focus',syncPermission);
        request('settings').then(s=>{if(alive&&mounted){setSettings(s);setVolume(s.island.volume);}}).catch(()=>{if(alive&&mounted)setError(true);});
        return()=>{mounted=false;++generation.current;operation.current=false;switchLock.current=false;refreshRows.current=null;cancel();off();window.removeEventListener('focus',syncPermission);player.dispose();previews.delete(player);if(preview.current){preview.current.dispose();previews.delete(preview.current);preview.current=null;}};
      },[]);
      async function run(action){
        if(operation.current||!alive)return;operation.current=true;const epoch=generation.current,valid=()=>alive&&epoch===generation.current;setBusy(true);setError(false);preview.current?.stop();
        try{const value=await action(valid);if(!valid()||!value)return;setSettings(value);setVolume(value.island.volume);if(value.island.soundEnabled===false&&preview.current){preview.current.dispose();previews.delete(preview.current);preview.current=null;}window.dispatchEvent(new CustomEvent('tanuki:settings-changed'));}
        catch{if(valid())setError(true);}finally{if(valid()){operation.current=false;setBusy(false);}}
      }
      const change=(path,options)=>run(()=>request(path,options));
      const patch=island=>change('settings',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({island})});
      async function toggle(row,enabled){
        if(switchLock.current||!alive||!row||row.entryId===undefined||row.readOnlyReason!==undefined)return;
        switchLock.current=true;setSwitchBusy(true);setError(false);const epoch=generation.current,valid=()=>alive&&epoch===generation.current;
        try{const r=await ctx.remote.pluginManager.setPluginEnabled(row.entryId,enabled);if(!valid())return;if(!r.ok)throw new Error('Toggle failed');await refreshRows.current?.();}
        catch{if(valid())setError(true);}finally{if(valid()){switchLock.current=false;setSwitchBusy(false);}}
      }
      function audition(value){
        if(busy||!settings)return;if(settings.island.soundEnabled===false||value===0){preview.current?.stop();return;}if(!preview.current){preview.current=createAudioPreview({baseURI:document.baseURI});previews.add(preview.current);}const epoch=generation.current;
        // Invoke synchronously in the input gesture; the shared module unlocks audio before awaiting I/O.
        try{Promise.resolve(preview.current.play({volume:value,audio:settings.island.audio})).then(ok=>{if(ok===false&&alive&&generation.current===epoch)setError(true);}).catch(()=>{if(alive&&generation.current===epoch)setError(true);});}catch{setError(true);}
      }
      function toggleSystemNotifications(enabled){
        if(!enabled){void patch({systemNotifications:false});return;}
        void run(async valid=>{
          if(typeof window.Notification!=='function'){setPermission('unsupported');return;}
          let permission=window.Notification.permission;
          if(permission==='default'){
            setPermission('pending');
            try{permission=await window.Notification.requestPermission();}
            catch{if(valid())setPermission(window.Notification.permission);throw new Error('Permission request failed');}
          }
          if(!valid())return;
          setPermission(permission);
          return request('settings',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({island:{systemNotifications:permission==='granted'}})});
        });
      }
      async function upload(event){
        const file=event.target.files?.[0];event.target.value='';if(!file)return;
        const ext=file.name.split('.').pop().toLowerCase(),type={mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg'}[ext];
        if(!type||file.size>5*1024*1024||!file.size){setError(true);return;}
        await run(async valid=>{let decoder;try{
          const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw new Error('Audio decoding unavailable');decoder=new Audio();decoders.add(decoder);
          const bytes=await file.arrayBuffer();if(!valid())return;await decoder.decodeAudioData(bytes);
        }finally{if(decoder&&decoders.delete(decoder))void decoder.close().catch(()=>{});}
        if(!valid())return;return request('settings/audio',{method:'PUT',headers:{'content-type':type,'x-audio-name':encodeURIComponent(file.name)},body:file});});
      }
      const names=view==='composer'?['composer']:['startup-guard','sidebar','home','composer','dynamic-island','plugin-center'];
      const localized=text=>text===undefined?'':ctx.locale.resolveText(text);
      return h('div',{className:'tanuki-base-settings'},h('h2',{className:'tanuki-settings-title'},h('span',null,t('title')),h('small',{className:'tanuki-settings-version'},'v'+__VERSION__)),error?h('p',{role:'alert'},t('error')):null,
        ...names.map(key=>{const row=rows.find(r=>r.moduleName==='dsh-local-plugin-center/'+key),title=localized(row?.meta?.title)||t(key),description=localized(row?.meta?.description);return h(SettingsCard,{key,name:key,title,description,t,onCollapse:()=>preview.current?.stop(),control:h(Switch,{checked:!!row?.enabled,label:t('toggle')+' '+title,disabled:switchBusy||!row||row.entryId===undefined||row.readOnlyReason!==undefined,onChange:enabled=>void toggle(row,enabled)})},
          key==='composer'?h('div',{className:'tanuki-composer-settings'},divider(false),...['timeStats','modelSelection','fileMenu'].map((flag,index)=>h(React.Fragment,{key:flag},index>0?divider(true):null,h('div',{className:'tanuki-bubble-setting'},h('div',null,h('span',null,t(flag)),h('p',{className:'tanuki-settings-note'},t(flag+'Hint'))),h(Switch,{checked:settings?.composer?.[flag]===true,label:t(flag),disabled:busy||!settings,onChange:enabled=>change('settings',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({composer:{[flag]:enabled}})})}))))):null,
          key==='dynamic-island'?divider(false):null,
          key==='dynamic-island'?h(React.Fragment,null,
            h('fieldset',{className:'tanuki-notification-categories',disabled:busy||!settings},h('legend',null,t('categories')),...['plugins','tasks','updates'].map(category=>h('label',{key:category},h('input',{type:'checkbox',checked:settings?.island.categories?.[category]!==false,onChange:e=>patch({categories:{...(settings?.island.categories||{plugins:true,tasks:true,updates:true}),[category]:e.target.checked}})}),t('category_'+category)))),
            divider(true),
            h('div',{className:'tanuki-system-permission'},h('div',{className:'tanuki-settings-subheader'},h('h4',null,t('systemNotifications')),h(Switch,{checked:settings?.island.systemNotifications===true&&permission==='granted',label:t('systemNotifications'),disabled:busy||!settings||permission==='pending'||permission==='unsupported',onChange:toggleSystemNotifications})),['denied','pending','unsupported'].includes(permission)?h('p',{className:'tanuki-settings-note',role:'status'},t('permission_'+permission)):null),
            divider(true),
            h('div',{className:'tanuki-bubble-setting'},h('div',null,h('span',null,t('bubbles'))),h(Switch,{checked:settings?.island.bubbles!==false,label:t('bubbles'),disabled:busy||!settings,onChange:bubbles=>patch({bubbles})})),
            divider(true),
            h('div',{className:'tanuki-sound-setting'},h('div',{className:'tanuki-settings-subheader'},h('h4',null,t('sound')),h(Switch,{checked:settings?.island.soundEnabled!==false,label:t('sound'),disabled:busy||!settings,onChange:soundEnabled=>patch({soundEnabled})})),h('label',{className:'tanuki-volume'},h('span',null,t('volume')),h('output',null,volume+'%'),h('input',{type:'range',min:0,max:100,step:1,value:volume,disabled:busy||!settings,'aria-label':t('volume'),onChange:e=>setVolume(Number(e.target.value)),onPointerUp:e=>audition(Number(e.currentTarget.value)),onPointerCancel:()=>preview.current?.stop(),onKeyUp:e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))audition(Number(e.currentTarget.value));}})),
            h('div',{className:'tanuki-sound-file'},h('h5',{className:'tanuki-sound-name'},settings?.island.audio?.name||t('defaultSound'))),h('input',{ref:fileInput,type:'file',hidden:true,accept:'.mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/ogg',disabled:busy||!settings,onChange:upload}),
            h('div',{className:'tanuki-audio-actions'},h('button',{type:'button',disabled:busy||!settings||volume===settings.island.volume,onClick:()=>patch({volume})},t('save')),h('button',{type:'button',disabled:busy||!settings,onClick:()=>fileInput.current?.click()},t('choose')),h('button',{type:'button',disabled:busy||!settings,onClick:()=>change('settings/audio',{method:'DELETE'})},t('restore'))),h('p',{className:'tanuki-settings-note'},t('audioLimit')))):
          null); }));
    }
    ctx.effect(()=>()=>{alive=false;for(const request of requests)request.abort();requests.clear();for(const decoder of decoders)void decoder.close().catch(()=>{});decoders.clear();for(const preview of previews)preview.dispose();previews.clear();});ready(Settings);
  }
  return {name:'tanuki-base-settings',inject:['locale','remote','remote.pluginManager'],apply};
});
