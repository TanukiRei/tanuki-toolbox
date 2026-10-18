export const name = 'tanuki-dynamic-island';
export function apply(ctx) {
  const profile=ctx.get('profileContext');if(!profile?.dir)return;
  let stopped=false,dispose;
  const pending=import('../../lib/notifications.cjs').then(async({default:notifications})=>{
    if(stopped)return;
    dispose=notifications.watch(ctx,profile);
    const {default:routes}=await import('../../lib/read-routes.cjs');
    if(!stopped)routes.register(ctx,{notifications:()=>notifications.read(profile)});
  });
  ctx.effect(()=>async()=>{stopped=true;try{await pending;}catch{}await dispose?.();});
  return pending;
}
