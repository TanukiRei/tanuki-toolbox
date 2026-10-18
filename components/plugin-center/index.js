export const name = 'tanuki-plugin-center';
export function apply(ctx) {
  const profile=ctx.get('profileContext');if(!profile?.dir)return;
  let stopped=false;ctx.effect(()=>()=>{stopped=true;});
  return Promise.all([import('../../lib/plugin-aliases.cjs'),import('../../lib/plugin-artwork.cjs')]).then(([{default:aliases},{default:artwork}])=>{if(!stopped){aliases.register(ctx,profile);artwork.register(ctx,profile);}});
}
