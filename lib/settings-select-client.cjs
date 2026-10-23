'use strict';
// Shared settings-only combobox. Injected into lazy settings chunks, never core.
function createSettingsSelect({React,createPortal,useModalLayer}){
  const h=React.createElement;
  return function SettingsSelect({children,value,defaultValue,disabled=false,onChange,className='',onBlur,placeholder='',...props}){
    const [local,setLocal]=React.useState(defaultValue),[open,setOpen]=React.useState(false),[point,setPoint]=React.useState(null),[active,setActive]=React.useState(-1);
    const trigger=React.useRef(null),popup=React.useRef(null),id=React.useId(),search=React.useRef({text:'',at:0}),frame=React.useRef(0);
    const close=React.useCallback(()=>setOpen(false),[]);useModalLayer(popup,open,close);
    const items=[];function flatten(nodes,group=''){React.Children.forEach(nodes,node=>{if(!React.isValidElement(node))return;if(node.type==='optgroup')flatten(node.props.children,node.props.label);else if(node.type==='option')items.push({value:String(node.props.value??node.props.children??''),label:node.props.children,disabled:!!node.props.disabled,group});else if(node.type===React.Fragment)flatten(node.props.children,group);});}flatten(children);
    const selected=String(value??local??items[0]?.value??''),index=items.findIndex(item=>item.value===selected),text=items[index]?.label||placeholder;
    React.useLayoutEffect(()=>{if(!open)return;if(disabled||trigger.current?.matches(':disabled')){close();return;}
      const place=()=>{const box=trigger.current.getBoundingClientRect(),height=Math.min(300,Math.max(100,innerHeight-24)),width=Math.min(Math.max(box.width,150),innerWidth-16),below=innerHeight-box.bottom-12,above=box.top-12,up=below<160&&above>below;setPoint({left:Math.max(8,Math.min(box.left,innerWidth-width-8)),width,maxHeight:Math.min(height,Math.max(90,up?above:below)),...(up?{bottom:innerHeight-box.top+5}:{top:box.bottom+5})});};
      const scroll=event=>{if(!popup.current?.contains(event.target))close();};place();window.addEventListener('resize',close);document.addEventListener('scroll',scroll,true);
      const outside=event=>{if(!popup.current?.contains(event.target)&&!trigger.current?.contains(event.target))close();};document.addEventListener('pointerdown',outside,true);
      return()=>{window.removeEventListener('resize',close);document.removeEventListener('scroll',scroll,true);document.removeEventListener('pointerdown',outside,true);};
    },[open,disabled]);
    React.useLayoutEffect(()=>{if(!open||!point)return;const at=index>=0&&!items[index].disabled?index:items.findIndex(item=>!item.disabled);setActive(at);const option=popup.current?.querySelector('[data-option="'+at+'"]');option?.focus({preventScroll:true});option?.scrollIntoView({block:'nearest'});},[open,!!point]);
    React.useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
    const choose=at=>{const item=items[at];if(!item||item.disabled)return;setLocal(item.value);close();if(item.value!==selected)onChange?.({target:{value:item.value,name:props.name},currentTarget:{value:item.value,name:props.name}});};
    const focus=at=>{if(at<0)return;setActive(at);const node=popup.current?.querySelector('[data-option="'+at+'"]');node?.focus({preventScroll:true});node?.scrollIntoView({block:'nearest'});};
    const key=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
      if(event.key==='Tab'){event.preventDefault();event.stopPropagation();const owner=trigger.current?.closest('[role="dialog"]')||document.body,nodes=[...owner.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(node=>!popup.current?.contains(node)&&node.getClientRects().length),at=nodes.indexOf(trigger.current),next=nodes[at+(event.shiftKey?-1:1)];close();cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(()=>{frame.current=0;(next||trigger.current)?.focus();});return;}
      const enabled=items.map((item,i)=>item.disabled?-1:i).filter(i=>i>=0),at=enabled.indexOf(active);
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();focus(event.key==='Home'?enabled[0]:event.key==='End'?enabled.at(-1):enabled[(at+(event.key==='ArrowDown'?1:-1)+enabled.length)%enabled.length]);}
      else if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(active);}
      else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey){const now=Date.now();search.current.text=(now-search.current.at<750?search.current.text:'')+event.key.toLocaleLowerCase();search.current.at=now;const needle=search.current.text;focus(items.findIndex(item=>!item.disabled&&String(item.label).toLocaleLowerCase().startsWith(needle)));}
    };
    return h(React.Fragment,null,h('button',{...props,ref:trigger,type:'button',className:'tanuki-settings-select '+className,disabled,role:'combobox','aria-expanded':open,'aria-controls':open?id:undefined,'aria-haspopup':'listbox',onBlur,onClick:()=>{setPoint(null);setOpen(v=>!v);},onKeyDown:event=>{if(['ArrowDown','ArrowUp','Enter',' '].includes(event.key)){event.preventDefault();setPoint(null);setOpen(true);}}},h('span',null,text),h('svg',{width:14,height:14,viewBox:'0 0 16 16',fill:'none',stroke:'currentColor','aria-hidden':true},h('path',{d:'m4 6 4 4 4-4',strokeWidth:1.5,strokeLinecap:'round',strokeLinejoin:'round'}))),open?createPortal(h('div',{id,ref:popup,role:'listbox','aria-label':props['aria-label'],className:'tanuki-settings-select-popup',style:point?{...point,visibility:'visible'}:{visibility:'hidden',left:0,top:0},onKeyDownCapture:key,onScroll:event=>event.stopPropagation()},...items.map((item,i)=>h(React.Fragment,{key:i},item.group&&(i===0||item.group!==items[i-1].group)?h('div',{className:'tanuki-settings-select-group'},item.group):null,h('button',{type:'button',role:'option',tabIndex:i===active?0:-1,'data-option':i,'aria-selected':item.value===selected,disabled:item.disabled,onClick:()=>choose(i),onFocus:()=>setActive(i)},item.label)))),document.body):null);
  };
}
module.exports={createSettingsSelect};
