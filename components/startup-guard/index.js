export const name='tanuki-startup-guard';
export function apply(ctx){
  let stopped=false,dispose;
  const pending=import('../../lib/startup-runtime.js').then(runtime=>{if(!stopped)dispose=runtime.apply(ctx);});
  ctx.effect(()=>async()=>{stopped=true;try{await pending;}catch{}await dispose?.();});
  return pending;
}
