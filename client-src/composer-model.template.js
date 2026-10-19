document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,{createPortal}=require('react-dom'),NS='tanukiComposerModel',SEAT='conversation.input.model';
  const emptyPreferences=Object.freeze({}),emptyStore={subscribe:()=>()=>{},getSnapshot:()=>emptyPreferences};
  function Icon({name}){return h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:{bolt:'M13 2 4 14h7l-1 8 10-13h-7l1-7z',detail:'M5 6h14M5 12h10M5 18h14',reset:'M4 4v6h6M4 10a8 8 0 1 1 0 6',chevron:'m9 5 7 7-7 7'}[name]}));}
  function apply(ctx){
    let alive=true;
    const toolboxLocale=(__LOCALE_FACTORY__)(ctx,NS,__LOCALES__),t=toolboxLocale.t;
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=__CSS__;document.head.appendChild(style);return()=>style.remove();});
    const notify=()=>{if(alive)window.dispatchEvent(new CustomEvent('tanuki:notify',{detail:{kind:'error',destination:{page:'settings',section:'tanuki-toolbox',component:'composer'},title:{zh:'模型选择',en:'Model selection'},message:{zh:'设置未能完成，请稍后重试。',en:'Could not apply the selection. Please retry.'}}}));};
    ctx.inject(['modelDirectories','sessions','tanukiModels'],scope=>{
      const models=scope.get('modelDirectories'),sessions=scope.get('sessions'),policy=scope.get('tanukiModels');
      function ModelControl({sessionId,directory,available,locked}){
        React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
        React.useSyncExternalStore(policy.subscribe,policy.getSnapshot);
        const state=React.useSyncExternalStore(fn=>directory.store.subscribe(fn),()=>directory.store.getSnapshot());
        React.useLayoutEffect(()=>policy.retain(directory),[directory]);
        const catalogStore=models.catalog?.store||emptyStore;
        const catalog=React.useSyncExternalStore(fn=>catalogStore.subscribe(fn),()=>catalogStore.getSnapshot());
        const entries=React.useSyncExternalStore(fn=>scope.slots.subscribe(SEAT,fn),()=>scope.slots.entries(SEAT));
        // Reuse the installed provider's actual preference controller; no duplicate RPC schema.
        const preference=React.useMemo(()=>{
          const entry=entries.find(item=>item.locale==='settings.codexSubscription'&&typeof item.inject==='function');
          if(!available||!entry)return null;
          try{const value=entry.inject(sessionId)?.preference;return typeof value?.subscribe==='function'&&typeof value?.getSnapshot==='function'&&typeof value?.set==='function'?value:null;}catch{return null;}
        },[entries,sessionId,available]);
        const preferenceStore=preference||emptyStore,prefs=React.useSyncExternalStore(fn=>preferenceStore.subscribe(fn),()=>preferenceStore.getSnapshot());
        const [open,setOpen]=React.useState(false),[pane,setPane]=React.useState(null),[query,setQuery]=React.useState(''),[draft,setDraft]=React.useState(null),[busy,setBusy]=React.useState(false),[position,setPosition]=React.useState({left:0,top:0}),[optionPosition,setOptionPosition]=React.useState({left:0,top:0});
        const controls=React.useRef(null),trigger=React.useRef(null),popup=React.useRef(null),options=React.useRef(null),mounted=React.useRef(false),operation=React.useRef(false),gesture=React.useRef(null),id=React.useId();
        const groups=state.groups||[],current=state.current,choice=groups.find(group=>group.id===current?.provider)?.models.find(model=>model.id===current?.model),modelBlocked=policy.isDisabled(current);
        const visibleGroups=React.useMemo(()=>groups.map(group=>group.id==='openai-codex'?{...group,models:group.models.filter(model=>model.tanukiDisabled||!prefs.disabledModels?.includes(model.id))}:group),[groups,prefs.disabledModels]);
        const modelLabel=choice?.name||current?.model||t('chooseModel');
        const reasoning=choice?.reasoning,efforts=reasoning&&Array.isArray(reasoning.efforts)?[...(reasoning.defaultEffort===undefined?[{id:undefined,name:t('default')}]:[]),...reasoning.efforts]:[];
        const effortName=level=>!level?t('default'):['none','minimal','low','medium','high','xhigh','max','ultra'].includes(level.id)?t('effort_'+level.id):level.name;
        const effective=current?.reasoningEffort??reasoning?.defaultEffort,index=efforts.findIndex(item=>item.id===effective),displayIndex=draft??Math.max(0,index),effortLabel=index>=0?effortName(efforts[displayIndex]):state.retainedEffort;
        const codex=current?.provider==='openai-codex';
        // Match Codex Subscription's fallback only when its advertised list is absent.
        const fastSupported=codex&&(Array.isArray(prefs.fastModels)?prefs.fastModels.includes(current?.model):typeof current?.model==='string'&&(/^gpt-5\.(?:5|6)(?:$|-)/u.test(current.model)||['gpt-5.4','gpt-6-astra'].includes(current.model)));
        const ultraSupported=codex&&prefs.ultrafastModels?.includes(current?.model),speedSupported=!!preference&&(fastSupported||ultraSupported),fast=speedSupported&&['fast','ultrafast'].includes(prefs.speedMode);
        const detailSupported=!!preference&&codex&&prefs.verbosityModels?.includes(current?.model);
        const detailChoices=['default','low','medium','high'],detailValue=detailChoices.includes(prefs.outputVerbosity)?prefs.outputVerbosity:'default';
        const disabled=!!locked||!available||busy||state.status==='selecting',preferenceDisabled=disabled||modelBlocked||prefs.status!=='ready'||prefs.writable!==true;
        const defaultSelection=catalog.value?.default;
        const resetAvailable=defaultSelection&&groups.some(group=>group.id===defaultSelection.provider&&group.models.some(model=>model.id===defaultSelection.model&&!model.tanukiDisabled));
        React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;operation.current=false;};},[]);
        React.useEffect(()=>{if(available)void directory.load().catch(()=>{});},[directory,available]);
        React.useEffect(()=>{gesture.current=null;setDraft(null);},[current?.provider,current?.model,effective]);
        // A transient host lock prevents writes; it is not a request to dismiss the UI.
        React.useEffect(()=>{if(!available){setOpen(false);setPane(null);setDraft(null);}},[available]);
        React.useEffect(()=>{setOpen(false);setPane(null);setDraft(null);},[sessionId]);
        React.useEffect(()=>{if(pane==='detail'&&!detailSupported)setPane(null);},[pane,detailSupported]);
        function close(){setOpen(false);setPane(null);setDraft(null);trigger.current?.focus({preventScroll:true});}
        React.useLayoutEffect(()=>{
          if(!open)return;
          const place=()=>{
            const anchor=trigger.current?.getBoundingClientRect(),box=popup.current;if(!anchor||!box)return;
            // Include Reset in the anchor: shift right by its fixed width while
            // keeping the popup before the native voice/send controls.
            const right=controls.current?.getBoundingClientRect().right??anchor.right;
            const left=Math.max(8,Math.min(right-box.offsetWidth,window.innerWidth-box.offsetWidth-8));
            const top=Math.max(8,Math.min(anchor.top-box.offsetHeight-8,window.innerHeight-box.offsetHeight-8));
            setPosition(old=>old.left===left&&old.top===top?old:{left,top});
            const list=options.current;if(list){
              const height=list.offsetHeight,width=list.offsetWidth;
              const y=top>=height+16?top-height-6:Math.min(window.innerHeight-height-8,top+box.offsetHeight+6);
              const next={left:Math.max(8,Math.min(left,window.innerWidth-width-8)),top:Math.max(8,y)};
              setOptionPosition(old=>old.left===next.left&&old.top===next.top?old:next);
            }
          };
          const outside=event=>{if(!controls.current?.contains(event.target)&&!popup.current?.contains(event.target))close();};
          const blur=()=>{setOpen(false);setPane(null);setDraft(null);};
          // Saving temporarily disables the focused control; Escape must still work
          // when the browser transfers focus to body during that interval.
          const escape=event=>{if(event.key==='Escape')keydown(event);};
          place();window.addEventListener('resize',place);document.addEventListener('scroll',place,true);document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape,true);window.addEventListener('blur',blur);
          return()=>{window.removeEventListener('resize',place);document.removeEventListener('scroll',place,true);document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);window.removeEventListener('blur',blur);};
        },[open,pane,query,groups]);
        React.useLayoutEffect(()=>{if(open)(options.current?.querySelector('input,button:not(:disabled)')||popup.current?.querySelector('button:not(:disabled)'))?.focus({preventScroll:true});},[open,pane]);
        async function run(action){
          if(!alive||!mounted.current||operation.current||disabled)return;
          operation.current=true;setBusy(true);
          try{await action();}catch{if(alive&&mounted.current)notify();}
          finally{if(alive&&mounted.current){operation.current=false;setBusy(false);setDraft(null);}}
        }
        async function select(selection){
          const before=directory.store.getSnapshot().current;
          if(before?.provider===selection.provider&&before?.model===selection.model&&before?.reasoningEffort===selection.reasoningEffort)return;
          const result=await directory.select(selection);if(!result?.ok)throw new Error('Selection rejected');
        }
        async function setPreferences(patch){
          if(!preference||preference.getSnapshot().writable!==true)throw new Error('Preferences unavailable');
          if(Object.entries(patch).every(([key,value])=>preference.getSnapshot()[key]===value))return;
          await preference.set(patch);if(preference.getSnapshot().error)throw new Error('Preferences rejected');
        }
        function chooseModel(provider,model){if(model.tanukiDisabled)return;void run(()=>select({provider,model:model.id,...(model.reasoning?.defaultEffort===undefined?{}:{reasoningEffort:model.reasoning.defaultEffort})}));}
        function commitEffort(value){
          const level=efforts[Number(value)];if(!level||!current||index===Number(value)||disabled||modelBlocked){setDraft(null);return;}
          void run(()=>select({provider:current.provider,model:current.model,...(level.id===undefined?{}:{reasoningEffort:level.id})}));
        }
        function reset(){void run(async()=>{
          if(!resetAvailable)throw new Error('Default model unavailable');
          await select({...defaultSelection});
          if(!alive||!mounted.current)return;
          if(preference){const latest=preference.getSnapshot();if(latest.speedMode!=='standard'||latest.outputVerbosity!=='default')await setPreferences({speedMode:'standard',outputVerbosity:'default'});}
        });}
        function keydown(event){
          if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(pane)setPane(null);else close();return;}
          if(options.current?.contains(event.target)&&event.target.tagName!=='INPUT'&&['ArrowUp','ArrowDown','Home','End'].includes(event.key)){
            const items=[...options.current.querySelectorAll('button:not(:disabled)')],at=items.indexOf(document.activeElement);
            if(items.length){event.preventDefault();items[event.key==='Home'?0:event.key==='End'?items.length-1:(at+(event.key==='ArrowDown'?1:items.length-1))%items.length].focus();}return;
          }
          if(event.key==='Tab'){
            const nodes=[...popup.current.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(node=>getComputedStyle(node).visibility!=='hidden');
            const at=nodes.indexOf(document.activeElement),next=event.shiftKey?at-1:at+1;
            if(next<0||next>=nodes.length){event.preventDefault();nodes[event.shiftKey?nodes.length-1:0]?.focus();}
          }
        }
        if(!available)return null;
        const buttonProps={type:'button',disabled,className:'tanuki-model-hit'};
        return h(React.Fragment,null,
          h('span',{ref:controls,className:'tanuki-model-controls','aria-busy':busy||state.status==='selecting'},
          h('button',{ref:trigger,type:'button',className:'tanuki-model-trigger','data-tanuki-model-disabled':modelBlocked,title:modelBlocked?t('modelDisabled'):undefined,disabled:!!locked,'aria-haspopup':'dialog','aria-expanded':open,'aria-controls':open?id:undefined,onClick:()=>{if(open)close();else{setOpen(true);void directory.load().catch(notify);}}},h('span',null,modelLabel),effortLabel?h('span',{className:'tanuki-model-trigger-effort'},effortLabel):null,h(Icon,{name:'chevron'})),
          h('button',{...buttonProps,className:'tanuki-model-hit tanuki-model-reset',disabled:disabled||!resetAvailable||(!!preference&&(prefs.status!=='ready'||prefs.writable!==true)),title:t('reset'),'aria-label':t('reset'),onClick:reset},h(Icon,{name:'reset'}))),
          open?createPortal(h('div',{ref:popup,id,role:'dialog','aria-label':t('title'),'aria-busy':busy||state.status==='selecting',className:'tanuki-model-popup',style:position,onKeyDown:keydown},
            h('div',{className:'tanuki-model-card'},
              h('button',{...buttonProps,className:'tanuki-model-hit tanuki-model-speed','data-fast':fast,style:{visibility:speedSupported?'visible':'hidden'},disabled:preferenceDisabled||!speedSupported,title:t(fast?'fastHint':'standardHint'),'aria-label':t('speed'),'aria-pressed':fast,onClick:()=>void run(()=>setPreferences({speedMode:fast?'standard':fastSupported?'fast':'ultrafast'}))},h(Icon,{name:'bolt'})),
              h('button',{...buttonProps,className:'tanuki-model-hit tanuki-model-main','data-tanuki-model-disabled':modelBlocked,title:modelBlocked?t('modelDisabled'):undefined,'aria-haspopup':'menu','aria-expanded':pane==='models',onClick:()=>{setQuery('');setPane(value=>value==='models'?null:'models');}},h('span',{className:'tanuki-model-name'},h('span',null,modelLabel),h(Icon,{name:'chevron'})),h('span',{className:'tanuki-model-effort',style:{visibility:efforts.length?'visible':'hidden'}},effortLabel||t('default'))),
              h('button',{...buttonProps,className:'tanuki-model-hit tanuki-model-detail',style:{visibility:detailSupported?'visible':'hidden'},disabled:preferenceDisabled||!detailSupported,title:t('detail')+' · '+t('detail_'+detailValue),'aria-label':t('detail')+' · '+t('detail_'+detailValue),'aria-haspopup':'menu','aria-expanded':pane==='detail',onClick:()=>setPane(value=>value==='detail'?null:'detail')},h(Icon,{name:'detail'})),
              h('div',{className:'tanuki-model-slider',style:{visibility:efforts.length?'visible':'hidden','--tanuki-progress':(efforts.length>1?displayIndex/(efforts.length-1)*100:0)+'%'}},
                h('div',{className:'tanuki-model-ticks','aria-hidden':true},...efforts.map((level,i)=>h('i',{key:level.id??'default',style:{left:(efforts.length>1?i/(efforts.length-1)*100:0)+'%'}}))),
                h('input',{type:'range',min:0,max:Math.max(0,efforts.length-1),step:1,value:displayIndex,disabled:disabled||modelBlocked||efforts.length<2,'aria-label':t('effort'),'aria-valuetext':effortName(efforts[displayIndex]),title:effortName(efforts[displayIndex]),onChange:event=>setDraft(Number(event.target.value)),onPointerDown:event=>{if(event.button===0){gesture.current=JSON.stringify([current?.provider,current?.model,effective]);event.currentTarget.setPointerCapture(event.pointerId);}},onPointerUp:event=>{const valid=gesture.current===JSON.stringify([current?.provider,current?.model,effective]);gesture.current=null;if(valid)commitEffort(event.currentTarget.value);else setDraft(null);},onPointerCancel:()=>{gesture.current=null;setDraft(null);},onLostPointerCapture:()=>{if(gesture.current!==null){gesture.current=null;setDraft(null);}},onKeyUp:event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))commitEffort(event.currentTarget.value);},onBlur:()=>{gesture.current=null;if(!operation.current)setDraft(null);}}))),
            pane?h('div',{ref:options,role:'menu','aria-label':t(pane==='models'?'chooseModel':'detail'),className:'tanuki-model-options',style:optionPosition},
              pane==='models'?h(React.Fragment,null,h('input',{type:'search',value:query,placeholder:t('search'),'aria-label':t('search'),onChange:event=>setQuery(event.target.value)}),
                ...visibleGroups.map(group=>{const matches=group.models.filter(model=>(model.name+' '+model.id).toLowerCase().includes(query.toLowerCase()));return matches.length?h('div',{key:group.id,role:'group','aria-label':group.name},h('div',{className:'tanuki-model-group'},group.name),...matches.map(model=>h('button',{key:model.id,type:'button',role:'menuitemradio','aria-checked':current?.provider===group.id&&current?.model===model.id,'data-tanuki-model-disabled':!!model.tanukiDisabled,title:model.tanukiDisabled?t('modelDisabled'):undefined,disabled:disabled||!!model.tanukiDisabled,onClick:()=>chooseModel(group.id,model)},h('span',null,model.name,model.tanukiDisabled?h('small',null,t('modelDisabled')):null),current?.provider===group.id&&current?.model===model.id?'✓':null))):null;}),
                !visibleGroups.some(group=>group.models.some(model=>(model.name+' '+model.id).toLowerCase().includes(query.toLowerCase())))?h('p',null,t('noModels')):null):
              detailChoices.map(value=>h('button',{key:value,type:'button',role:'menuitemradio','aria-checked':detailValue===value,disabled:preferenceDisabled,onClick:()=>{void run(()=>setPreferences({outputVerbosity:value}));}},h('span',null,t('detail_'+value)),detailValue===value?'✓':null))):null),document.body):null);
      }
      scope.slots.inject(SEAT,()=>scope.slots.register({name:SEAT,id:'tanuki-composer-model',priority:-1000,locale:NS,inject:sessionId=>({sessionId,directory:models.directoryFor(sessionId),available:sessions.subagentAddress(sessionId)===undefined})},ModelControl));
    });
    ctx.effect(()=>()=>{alive=false;});
  }
  return {name:'tanuki-composer-model',inject:['slots','locale'],apply};
});
