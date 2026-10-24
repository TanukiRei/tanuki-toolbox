'use strict';
// Shared FLIP motion for live list previews. Business state remains in React;
// this helper never moves/reparents DOM nodes or persists an intermediate order.
function createSortMotion({React}){
  return function useSortMotion(){
    const state=React.useRef(null);
    if(!state.current){
      const animations=new Map();let pending=null;
      const cancel=()=>{for(const animation of animations.values())animation.cancel();animations.clear();};
      state.current={
        capture(root,selector){
          if(!root?.isConnected)return;
          const before=new Map([...root.querySelectorAll(selector)].map(node=>[node.dataset.sortMotionKey,node.getBoundingClientRect()]));
          cancel();pending={root,selector,before};
        },
        rect(node){
          const box=node.getBoundingClientRect();
          if(!animations.has(node))return box;
          // Hit testing uses layout positions, not the temporary FLIP transform.
          const transform=getComputedStyle(node).transform;if(transform==='none')return box;
          const matrix=new DOMMatrixReadOnly(transform);
          return {left:box.left-matrix.m41,right:box.right-matrix.m41,top:box.top-matrix.m42,bottom:box.bottom-matrix.m42,width:box.width,height:box.height};
        },
        flush(){
          const frame=pending;pending=null;if(!frame||!frame.root.isConnected)return;
          const nodes=[...frame.root.querySelectorAll(frame.selector)],after=nodes.map(node=>[node,node.getBoundingClientRect()]);
          if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
          for(const [node,box]of after){
            const before=frame.before.get(node.dataset.sortMotionKey);if(!before)continue;
            const x=before.left-box.left,y=before.top-box.top;if(Math.abs(x)+Math.abs(y)<.5||!node.animate)continue;
            const bounce=value=>-Math.sign(value)*Math.min(5,Math.abs(value)*.055);
            const animation=node.animate([
              {transform:`translate(${x}px,${y}px)`,offset:0,easing:'cubic-bezier(.18,.75,.3,1)'},
              {transform:`translate(${bounce(x)}px,${bounce(y)}px)`,offset:.76,easing:'cubic-bezier(.35,0,.35,1)'},
              {transform:'translate(0,0)',offset:1}
            ],{duration:310});
            animations.set(node,animation);
            animation.onfinish=()=>{if(animations.get(node)===animation)animations.delete(node);};
          }
        },
        dispose(){pending=null;cancel();}
      };
    }
    React.useLayoutEffect(()=>state.current.flush());
    React.useLayoutEffect(()=>()=>state.current.dispose(),[]);
    return state.current;
  };
}
module.exports={createSortMotion};
