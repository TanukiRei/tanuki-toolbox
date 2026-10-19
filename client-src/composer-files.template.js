document.currentScript.__tanukiRegister(function(require){
  const React=require('react'),h=React.createElement,{createPortal}=require('react-dom'),NS='tanukiComposerFiles';
  function apply(ctx){
    let alive=true,snapshot=null,operation=null;const listeners=new Set(),downloads=new Map();
    const toolboxLocale=(__LOCALE_FACTORY__)(ctx,NS,__LOCALES__),t=toolboxLocale.t;
    ctx.effect(()=>{const style=document.createElement('style');style.textContent=__CSS__;document.head.appendChild(style);return()=>style.remove();});
    function publish(value){if(!alive)return;snapshot=value;for(const fn of listeners)fn();}
    const close=()=>publish(null);
    const basename=path=>path.split(/[\\/]/).filter(Boolean).at(-1)||'file';
    const fail=()=>{if(alive)window.dispatchEvent(new CustomEvent('tanuki:notify',{detail:{kind:'error',destination:{page:'settings',section:'tanuki-toolbox',component:'composer'},title:{zh:'文件操作',en:'File actions'},message:{zh:'文件操作未完成，请检查文件是否仍存在、权限及连接后重试。',en:'The file action failed. Check the file, permissions and connection, then retry.'}}}));};
    async function unwrap(promise,signal){const result=await promise;signal.throwIfAborted();if(!result?.ok)throw new Error(result?.error?.code||'File operation failed');return result.value;}
    async function saveAs(target){
      const controller=new AbortController();operation=controller;let writer,handle,parts=[],offset=0;
      const {signal}=controller,remote=ctx.get('remote')?.workspaceFiles;
      try{
        if(!remote)throw new Error('File service unavailable');
        // Open the chooser before the first await so the click's activation is kept.
        if(typeof window.showSaveFilePicker==='function')handle=await window.showSaveFilePicker({suggestedName:basename(target.path)});
        signal.throwIfAborted();if(!alive)throw new DOMException('Stopped','AbortError');
        const info=await unwrap(remote.stat(target.sessionId,target.path,signal),signal);
        if(!handle&&Number.isFinite(info.bytes)&&info.bytes>128*1024*1024)throw new Error('File exceeds browser download memory limit');
        if(handle){writer=await handle.createWritable();signal.throwIfAborted();}
        while(true){
          const value=await unwrap(remote.readBytes(target.sessionId,target.path,{range:{offset,length:256*1024}},signal),signal);
          if(value.absolutePath!==info.absolutePath||value.version!==info.version||value.offset!==offset)throw new Error('File changed during save');
          const data=value.data;if(!(data instanceof Uint8Array))throw new Error('Invalid binary file response');
          if(!data.length&&!value.eof)throw new Error('Incomplete file response');
          if(writer)await writer.write(data);else{if(offset+data.byteLength>128*1024*1024)throw new Error('File exceeds browser download memory limit');parts.push(data);}
          offset+=data.byteLength;if(value.eof)break;
        }
        const after=await unwrap(remote.stat(target.sessionId,target.path,signal),signal);
        if(after.version!==info.version||after.absolutePath!==info.absolutePath||(Number.isFinite(info.bytes)&&offset!==info.bytes)||(Number.isFinite(after.bytes)&&offset!==after.bytes))throw new Error('File changed during save');
        if(writer){await writer.close();writer=null;}
        else{
          const url=URL.createObjectURL(new Blob(parts,{type:'application/octet-stream'})),link=document.createElement('a');
          link.href=url;link.download=basename(target.path);link.hidden=true;document.body.appendChild(link);link.click();link.remove();
          downloads.set(url,setTimeout(()=>{URL.revokeObjectURL(url);downloads.delete(url);},60000));
        }
      }catch(error){if(writer)await writer.abort().catch(()=>{});if(error?.name!=='AbortError'&&!signal.aborted&&alive)fail();}
      finally{parts.length=0;if(operation===controller)operation=null;}
    }
    async function copy(text){
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}
      const input=document.createElement('textarea'),previous=document.activeElement;input.value=text;input.style.cssText='position:fixed;opacity:0;pointer-events:none';document.body.appendChild(input);input.select();
      try{if(!document.execCommand('copy'))throw new Error('Clipboard unavailable');}finally{input.remove();previous?.focus?.({preventScroll:true});}
    }
    async function choose(key,target){
      if(!alive||operation||!target.card.isConnected)return;
      close();
      try{
        if(key==='preview'){target.preview?.click();return;}
        if(key==='save'){await saveAs(target);return;}
        if(key==='copyPath'){await copy(target.path);return;}
        if(key==='copyName'){await copy(basename(target.path));return;}
        if(key==='more'){target.more?.click();return;}
        const result=await target.onAction(key==='reveal'?'reveal':'open');if(result)throw new Error(String(result));
      }catch{if(alive)fail();}
    }
    function FileHook(props){
      const marker=React.useRef(null),latest=React.useRef(props);latest.current=props;
      React.useLayoutEffect(()=>{
        const card=marker.current?.closest('[data-presented-file]');if(!card)return;
        const show=event=>{
          const current=latest.current,preview=card.querySelector(':scope > button[title]'),path=preview?.getAttribute('title');
          if(!alive||operation||typeof path!=='string'||!path||typeof current.sessionId!=='string'||typeof current.onAction!=='function')return;
          event.preventDefault();event.stopPropagation();
          const more=card.querySelector('button[data-open-path-more]');
          const box=card.getBoundingClientRect();publish({card,preview,more,path,sessionId:current.sessionId,onAction:current.onAction,available:current.available&&!current.pending,x:event.type==='keydown'?box.left+12:event.clientX,y:event.type==='keydown'?box.bottom:event.clientY});
        };
        const keyboard=event=>{if(event.key==='ContextMenu'||event.key==='F10'&&event.shiftKey)show(event);};
        card.addEventListener('contextmenu',show);card.addEventListener('keydown',keyboard);
        return()=>{card.removeEventListener('contextmenu',show);card.removeEventListener('keydown',keyboard);if(snapshot?.card===card)close();};
      },[props.sessionId,props.actionUrl]);
      return h('span',{ref:marker,hidden:true,'aria-hidden':true});
    }
    function Menu(){
      React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
      const target=React.useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn);},()=>snapshot),ref=React.useRef(null);
      const [point,setPoint]=React.useState({left:0,top:0});
      React.useLayoutEffect(()=>{
        if(!target)return;const box=ref.current.getBoundingClientRect(),safeTop=document.documentElement.hasAttribute('data-fullscreen')?8:8+(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dsh-frame-top-clearance'))||(document.documentElement.dataset.platform==='darwin'?48:0));setPoint({left:Math.max(8,Math.min(target.x,innerWidth-box.width-8)),top:Math.max(safeTop,Math.min(target.y,innerHeight-box.height-8))});ref.current.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
        const outside=event=>{if(!ref.current?.contains(event.target))close();},hide=()=>close(),scroll=event=>{if(!ref.current?.contains(event.target))close();};
        document.addEventListener('pointerdown',outside,true);document.addEventListener('scroll',scroll,true);window.addEventListener('resize',hide);window.addEventListener('blur',hide);
        return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',hide);window.removeEventListener('blur',hide);};
      },[target]);
      if(!target)return null;
      const keydown=event=>{
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();target.preview?.focus({preventScroll:true});return;}
        const buttons=[...ref.current.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement);
        if(['ArrowDown','ArrowUp','Home','End','Tab'].includes(event.key)){event.preventDefault();event.stopPropagation();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowUp'||event.key==='Tab'&&event.shiftKey?buttons.length-1:1))%buttons.length;buttons[next]?.focus();}
      };
      const items=['preview','open','save','reveal',...(target.more?['more']:[]),'copyPath','copyName'];
      return createPortal(h('div',{ref,role:'menu','aria-label':t('title'),className:'tanuki-file-menu','data-tanuki-file-menu':'',style:point,onKeyDown:keydown,onContextMenu:event=>event.preventDefault()},h('div',{className:'tanuki-file-menu-name',title:target.path},basename(target.path)),...items.map(key=>h('button',{key,type:'button',role:'menuitem',disabled:['open','reveal','more'].includes(key)&&(!target.available||key==='more'&&target.more?.disabled),onClick:()=>void choose(key,target)},t(key)))),document.body);
    }
    ctx.slots.inject('deliverables.file.actions',()=>ctx.slots.register({name:'deliverables.file.actions',id:'tanuki-file-menu',order:1000,locale:NS,inject:sessionId=>({sessionId})},FileHook));
    ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'tanuki-file-menu',locale:NS},Menu));
    ctx.effect(()=>()=>{alive=false;operation?.abort();operation=null;for(const[url,timer]of downloads){clearTimeout(timer);URL.revokeObjectURL(url);}downloads.clear();snapshot=null;listeners.clear();});
  }
  return {name:'tanuki-composer-files',inject:['slots','locale','remote','remote.workspaceFiles'],apply};
});
