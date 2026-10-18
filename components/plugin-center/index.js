export const name = 'tanuki-plugin-center';
export function apply(ctx) {
  const profile=ctx.get('profileContext');if(!profile?.dir)return;
  let stopped=false;ctx.effect(()=>()=>{stopped=true;});
  return import('../../lib/plugin-aliases.cjs').then(({default:aliases})=>{if(!stopped)aliases.register(ctx,profile);});
}
