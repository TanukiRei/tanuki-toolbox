'use strict';
function createPluginAliases({React,useLocale,json}){
  const h=React.createElement,listeners=new Set(),requests=new Set();
  let alive=true,flight=null,state={ready:false,loading:false,values:Object.create(null)};
  const publish=patch=>{if(!alive)return;state={...state,...patch};for(const fn of [...listeners])fn();};
  const subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
  async function request(options){
    if(!alive)throw new Error('Component stopped');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);requests.add(controller);
    try{return await json('/tanuki-toolbox/plugin-aliases',controller.signal,options);}
    finally{clearTimeout(timer);requests.delete(controller);}
  }
  async function load(){
    if(!alive||state.ready)return state.ready;if(flight)return flight;
    publish({loading:true});
    flight=request().then(value=>{
      if(value?.schema!==1||!value.aliases||Array.isArray(value.aliases)||typeof value.aliases!=='object')throw new Error('Invalid names');
      const values=Object.create(null);for(const [name,alias] of Object.entries(value.aliases))if(typeof alias==='string')values[name]=alias;
      publish({ready:true,values});return alive;
    }).catch(()=>false).finally(()=>{flight=null;publish({loading:false});});return flight;
  }
  const notify=key=>{if(alive)window.dispatchEvent(new CustomEvent('tanuki:notify',{detail:{id:'alias:'+Date.now(),title:{zh:'自定义名称',en:'Custom name'},message:key==='load'?{zh:'暂时无法读取自定义名称，请稍后重试。',en:'Could not load custom names. Please try again.'}:{zh:'名称未能保存，请重试。',en:'The name could not be saved. Please retry.'}}}));};
  async function save(name,alias){
    const result=await request({method:'PUT',body:{name,alias}});
    if(result?.schema!==1||result.name!==name||typeof result.alias!=='string')throw new Error('Invalid saved name');
    if(!alive)return;
    const values=Object.assign(Object.create(null),state.values);
    if(result.alias)values[name]=result.alias;else delete values[name];
    publish({values});
  }
  function Title({name,heading}){
    const model=React.useSyncExternalStore(subscribe,()=>state),value=model.values[name]||'';
    return value?h('button',{type:'button',className:'tanuki-alias-text',title:value,onClick:event=>{event.stopPropagation();heading.querySelector(':scope > button')?.click();}},value):null;
  }
  function Alias({name}){
    const tr=useLocale(),model=React.useSyncExternalStore(subscribe,()=>state),value=model.values[name]||'';
    const [editing,setEditing]=React.useState(false),[draft,setDraft]=React.useState(''),[saving,setSaving]=React.useState(false);
    const input=React.useRef(null),mounted=React.useRef(false),isEditing=React.useRef(false),pending=React.useRef(false),composing=React.useRef(false);
    React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;isEditing.current=false;};},[]);
    React.useLayoutEffect(()=>{if(editing){input.current?.focus();input.current?.select();}},[editing]);
    const cancel=()=>{isEditing.current=false;setEditing(false);setDraft(value);};
    async function finish(){
      if(!alive||!isEditing.current||pending.current)return;
      const alias=Array.from(draft.replace(/[\u0000-\u001f\u007f]/g,' ').trim()).slice(0,120).join('');
      if(alias===value){cancel();return;}
      pending.current=true;setSaving(true);
      try{await save(name,alias);if(alive&&mounted.current){isEditing.current=false;setEditing(false);}}
      catch{if(alive&&mounted.current)notify('save');}
      finally{pending.current=false;if(alive&&mounted.current)setSaving(false);}
    }
    async function edit(){
      if(editing){void finish();return;}
      if(!state.ready&&!await load()){if(mounted.current)notify('load');return;}
      if(!alive||!mounted.current)return;
      setDraft(state.values[name]||'');isEditing.current=true;setEditing(true);
    }
    return h('span',{className:'tanuki-alias-editor','data-editing':editing||undefined,'aria-busy':saving||undefined,onClick:event=>event.stopPropagation(),onKeyDown:event=>event.stopPropagation()},
      editing?h('input',{ref:input,type:'text',className:'tanuki-alias-input',value:draft,maxLength:120,readOnly:saving,'aria-label':tr('aliasLabel'),placeholder:tr('aliasPlaceholder'),title:tr('aliasHint'),autoComplete:'off',spellCheck:false,onChange:event=>setDraft(event.target.value),onCompositionStart:()=>{composing.current=true;},onCompositionEnd:()=>{composing.current=false;},onBlur:()=>{if(!pending.current)cancel();},onKeyDown:event=>{event.stopPropagation();if(composing.current||event.nativeEvent.isComposing||event.keyCode===229)return;if(event.key==='Enter'){event.preventDefault();void finish();}else if(event.key==='Escape'&&!pending.current){event.preventDefault();cancel();}}}):
      h('button',{type:'button',className:'tanuki-alias-edit',disabled:saving||model.loading,'aria-label':tr('aliasEdit'),'aria-expanded':editing,title:tr('aliasEdit'),onClick:()=>void edit()},tr('aliasRename')));

  }
  return {Alias,Title,load,dispose(){alive=false;for(const controller of requests)controller.abort();requests.clear();listeners.clear();state={ready:false,loading:false,values:Object.create(null)};}};
}
module.exports={createPluginAliases};
