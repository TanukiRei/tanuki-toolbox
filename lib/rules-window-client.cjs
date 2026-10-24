'use strict';
function startRulesWindow(createEditor,locales){
  const bridge=window.chrome.webview,root=document.getElementById('rules-root');let state={rows:[],ready:false},language='zh',editId=0,saveTimer,dirty=false,alive=true;
  const t=key=>locales[language]?.[key]||locales.en[key]||key,send=value=>{if(alive)bridge.postMessage(value);};
  function render(){editor.update({...state,dirty,saving:dirty});}
  function flush(requestId){clearTimeout(saveTimer);if(dirty||requestId)send({type:requestId?'flushed':'edit',requestId,rows:state.rows,editId});}
  window.addEventListener('error',()=>send({type:'pageError'}));window.addEventListener('unhandledrejection',()=>send({type:'pageError'}));
  const editor=createEditor({root,standalone:true,t,onChange(rows){state={...state,rows,error:null};dirty=true;editId++;render();clearTimeout(saveTimer);saveTimer=setTimeout(()=>flush(),180);},onClose(){flush();send({type:'closed'});},onDetach(){flush();send({type:'attach'});},onDragStart(event){send({type:'drag',grabX:event.clientX,grabY:event.clientY});},onResize(edge){send({type:'resize',edge});},onLimit(){state.error='RULES_TOO_LONG';render();},onRetry(){if(dirty)flush();else send({type:'refresh'});},onFlush(){flush();}});
  function theme(value){language=value.language==='zh'?'zh':value.language==='en'?'en':language;const variables={background:'--dsw-alias-bg-layer-2',foreground:'--dsw-alias-label-primary',muted:'--dsw-alias-label-secondary',tertiary:'--dsw-alias-label-tertiary',border:'--dsw-alias-border-l2',hover:'--dsw-alias-interactive-bg-hover',focus:'--dsw-alias-state-business-primary',error:'--dsw-alias-state-error-primary'};for(const [key,variable]of Object.entries(variables))if(value.theme?.[key])document.documentElement.style.setProperty(variable,value.theme[key]);document.documentElement.lang=language;const rgb=getComputedStyle(root).backgroundColor.match(/\d+(?:\.\d+)?/g);if(rgb&&rgb.length>=3)document.documentElement.style.colorScheme=(+rgb[0]+ +rgb[1]+ +rgb[2])/3<128?'dark':'light';render();}
  bridge.addEventListener('message',event=>{const value=event.data;if(!value||!alive)return;
    if(value.type==='hello'){state={...value,ready:true};dirty=false;theme(value);const css=getComputedStyle(root);send({type:'metrics',radius:parseFloat(css.borderRadius)||15,duration:parseFloat(css.getPropertyValue('--tanuki-rules-motion'))||180});send({type:'uiReady'});}
    else if(value.type==='state'){const rows=dirty?state.rows:value.rows;state={...state,...value,rows,error:dirty?state.error:null};render();}
    else if(value.type==='saved'){if(value.editId===editId){dirty=false;state={...state,revision:value.revision,error:null};}render();}
    else if(value.type==='error'){state.error=value.error||'SAVE_FAILED';render();}
    else if(value.type==='theme')theme(value);
    else if(value.type==='flush')flush(value.requestId);
    else if(value.type==='focus'){root.querySelector('input')?.focus();}
    else if(value.type==='requestClose'){flush();send({type:'closed'});}
  });
  window.addEventListener('blur',()=>flush());window.addEventListener('beforeunload',()=>{clearTimeout(saveTimer);editor.dispose();alive=false;});send({type:'pageReady'});
}
module.exports={startRulesWindow};
