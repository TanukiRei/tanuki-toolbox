'use strict';
// One same-document history entry represents the entire plugin detail view.
// Back exits nested component settings and returns to the plugin list.
function createDetailNavigation({window:win,hasDetail,goList}){
  const key='tanukiPluginDetail',owner=Math.random().toString(36).slice(2);
  let open=false,suppress=false,disposed=false;
  const ours=()=>win.history.state?.[key]?.owner===owner;
  function sync(){
    if(disposed)return;
    const detail=hasDetail();
    if(suppress){if(!detail){suppress=false;open=false;}return;}
    if(detail&&!open){
      open=true;
      const state={...(win.history.state||{}),[key]:{owner}};
      if(win.history.state?.[key])win.history.replaceState(state,'');else win.history.pushState(state,'');
    }else if(!detail&&open){open=false;if(ours())win.history.back();}
  }
  const pop=()=>{if(hasDetail()&&!ours()){suppress=true;open=false;goList();}};
  const back=()=>{if(!hasDetail())return false;if(ours())win.history.back();else{open=false;suppress=true;goList();}return true;};
  const keys=event=>{if(event.altKey&&!event.ctrlKey&&!event.metaKey&&event.key==='ArrowLeft'&&hasDetail()){event.preventDefault();event.stopPropagation();back();}};
  win.addEventListener('popstate',pop);win.addEventListener('keydown',keys,true);sync();
  return {sync,back,dispose(){disposed=true;win.removeEventListener('popstate',pop);win.removeEventListener('keydown',keys,true);if(ours()){const state={...win.history.state};delete state[key];win.history.replaceState(state,'');}}};
}
module.exports={createDetailNavigation};
