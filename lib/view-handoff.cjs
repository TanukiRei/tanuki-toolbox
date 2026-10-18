'use strict';
// A short-lived, inert copy covers the native page while DSH reloads plugins.
// It lives outside React so disposal cannot briefly reveal another page.
function createViewHandoff({window:win,document:doc,css}){
  const key='__tanukiViewHandoffV1';
  function clear(){const state=win[key];if(!state)return;win.clearTimeout(state.timeout);win.clearTimeout(state.readyTimer);state.cover.remove();win.removeEventListener('resize',state.cancel);doc.removeEventListener('click',state.outside,true);delete win[key];}
  function capture(page,owner,revision,leaving=false){
    if(leaving){clear();return;}
    if(!page?.isConnected)return;
    clear();const rect=page.getBoundingClientRect(),style=win.getComputedStyle(page);
    const cover=doc.createElement('div'),copy=page.cloneNode(true),sheet=doc.createElement('style');
    cover.dataset.tanukiHandoff='';cover.setAttribute('aria-hidden','true');cover.inert=true;
    Object.assign(cover.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',zIndex:'10000',overflow:'hidden',background:style.backgroundColor==='rgba(0, 0, 0, 0)'?'var(--dsw-alias-bg-base,#151515)':style.backgroundColor,font:style.font,color:style.color});
    // Keep the previous frame's CSS even when the old plugin fiber retracts it.
    sheet.textContent=css;cover.append(sheet,copy);copy.style.height=rect.height+'px';copy.style.width='100%';copy.style.boxSizing='border-box';copy.style.margin='0';
    for(const element of copy.querySelectorAll('[id]'))element.removeAttribute('id');
    doc.body.append(cover);copy.scrollTop=page.scrollTop;
    const state={cover,owner,revision,scrollTop:page.scrollTop,tab:page.dataset.tanukiCenter,category:page.dataset.tanukiCategory,cancel:clear,outside:event=>{if(!page.contains(event.target)&&!cover.contains(event.target))clear();}};
    state.timeout=win.setTimeout(clear,8000);win[key]=state;
    win.addEventListener('resize',state.cancel);doc.addEventListener('click',state.outside,true);
  }
  function ready(page,owner,revision){
    const state=win[key];if(!state||!page?.isConnected||(state.owner===owner&&revision<=state.revision)||page.dataset.tanukiCenter!==state.tab||page.dataset.tanukiCategory!==state.category)return;
    win.clearTimeout(state.readyTimer);
    state.readyTimer=win.setTimeout(()=>{if(win[key]!==state||!page.isConnected)return;page.scrollTop=state.scrollTop;win.requestAnimationFrame(()=>win.requestAnimationFrame(()=>{if(win[key]===state)clear();}));},250);
  }
  return {capture,ready,clear,pending:()=>!!win[key]};
}
module.exports={createViewHandoff};
