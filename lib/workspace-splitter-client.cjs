'use strict';
function createWorkspaceSplitter({window,document,frame,getWidth,getLimits,preview,commit,clearPreview,label}){
  const handle=document.createElement('div');handle.setAttribute('data-tanuki-workspace-splitter','');
  handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.tabIndex=0;
  let alive=true,enabled=false,drag=null,raf=null;
  const clamp=value=>{const bounds=getLimits();return Math.round(Math.max(bounds.min,Math.min(bounds.max,value)));};
  const paint=()=>{raf=null;if(alive&&drag)preview(clamp(drag.startWidth+drag.x-drag.startX));};
  function finish(save){
    if(!drag)return;
    const active=drag;
    window.cancelAnimationFrame(raf);raf=null;
    const changed=active.x!==active.startX;
    if(save&&changed)paint();
    const width=getWidth();drag=null;window.cancelAnimationFrame(raf);raf=null;
    frame.removeAttribute('data-tanuki-workspace-resizing');
    window.removeEventListener('keydown',cancelKey,true);window.removeEventListener('blur',blur);
    try{if(handle.hasPointerCapture(active.id))handle.releasePointerCapture(active.id);}catch{}
    if(save&&changed)commit(width);else clearPreview();
  }
  const cancelKey=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(false);}};
  const blur=()=>finish(true);
  const down=event=>{
    if(!enabled||drag||event.button!==0||event.isPrimary===false)return;
    event.preventDefault();event.stopPropagation();handle.focus({preventScroll:true});
    drag={id:event.pointerId,startX:event.clientX,x:event.clientX,startWidth:getWidth()};
    try{handle.setPointerCapture(event.pointerId);}catch{drag=null;return;}
    frame.setAttribute('data-tanuki-workspace-resizing','');
    window.addEventListener('keydown',cancelKey,true);window.addEventListener('blur',blur);
  };
  const move=event=>{if(!drag||event.pointerId!==drag.id)return;drag.x=event.clientX;if(raf===null)raf=window.requestAnimationFrame(paint);};
  const up=event=>{if(drag?.id===event.pointerId){drag.x=event.clientX;finish(true);}};
  const cancel=event=>{if(drag?.id===event.pointerId)finish(false);};
  const lost=event=>{if(drag?.id===event.pointerId)finish(true);};
  const key=event=>{
    if(!enabled||drag)return;
    const bounds=getLimits(),step=event.shiftKey?40:10;
    const target=event.key==='ArrowLeft'?getWidth()-step:event.key==='ArrowRight'?getWidth()+step:event.key==='Home'?bounds.min:event.key==='End'?bounds.max:null;
    if(target===null)return;event.preventDefault();event.stopPropagation();commit(clamp(target));
  };
  const events={pointerdown:down,pointermove:move,pointerup:up,pointercancel:cancel,lostpointercapture:lost,keydown:key};
  for(const [event,fn]of Object.entries(events))handle.addEventListener(event,fn);
  frame.appendChild(handle);
  return {
    sync(show){
      enabled=show;if(!show)finish(false);
      handle.hidden=!show;handle.tabIndex=show?0:-1;handle.setAttribute('aria-label',label());handle.title=label();
      const bounds=getLimits();handle.setAttribute('aria-valuemin',String(bounds.min));handle.setAttribute('aria-valuemax',String(bounds.max));handle.setAttribute('aria-valuenow',String(Math.round(getWidth())));
    },
    cancel(){finish(false);},
    dispose(){finish(false);alive=false;window.cancelAnimationFrame(raf);for(const [event,fn]of Object.entries(events))handle.removeEventListener(event,fn);handle.remove();frame.removeAttribute('data-tanuki-workspace-resizing');}
  };
}
module.exports={createWorkspaceSplitter};
